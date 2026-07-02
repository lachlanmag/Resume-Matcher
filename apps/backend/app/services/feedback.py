"""Structured feedback generation and feedback-application preview service."""

import copy
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.llm import complete_json
from app.prompts import (
    APPLY_FEEDBACK_PROMPT,
    APPLY_FEEDBACK_TRUTHFULNESS_RULES,
    get_language_name,
)
from app.prompts.templates import TAILORED_RESUME_FEEDBACK_PROMPT
from app.schemas.feedback import ResumeFeedback
from app.schemas.models import ResumeChange
from app.schemas.work_experience import finalize_tailored_work_experience
from app.services.cover_letter import _resolve_feature_prompt
from app.services.improver import apply_diffs, calculate_resume_diff

logger = logging.getLogger(__name__)

_REQUIRED_REPORT_HEADINGS: tuple[str, ...] = (
    "Candidate summary",
    "Strengths",
    "Concerns or gaps",
    "Tailoring quality",
    "Role fit score",
    "ATS assessment",
    "ATS optimization recommendations",
    "Hiring recommendation",
    "Interview focus areas",
    "Resume improvement suggestions",
    "Gaps and questions for the candidate",
)


async def generate_structured_feedback(
    resume_data: dict[str, Any],
    job_description: str,
    language: str = "en",
) -> dict[str, Any]:
    """Generate structured tailored-resume feedback with markdown report and questions."""
    output_language = get_language_name(language)

    template, is_custom = _resolve_feature_prompt(
        "resume_feedback_prompt", TAILORED_RESUME_FEEDBACK_PROMPT
    )
    try:
        prompt = template.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data, ensure_ascii=False),
            output_language=output_language,
        )
    except (KeyError, IndexError, ValueError) as e:
        if not is_custom:
            raise
        logger.warning(
            "Custom resume feedback prompt failed to format (%s); falling back to default",
            e,
        )
        prompt = TAILORED_RESUME_FEEDBACK_PROMPT.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data, ensure_ascii=False),
            output_language=output_language,
        )

    result = await complete_json(
        prompt=prompt,
        system_prompt=(
            "You are an HR representative at a SaaS company. "
            "Review tailored resumes objectively and provide actionable feedback."
        ),
        max_tokens=8192,
        schema_type="feedback",
    )

    report_markdown = result.get("report_markdown")
    questions = result.get("questions")

    if not isinstance(report_markdown, str) or not report_markdown.strip():
        logger.error(
            "Feedback generation returned invalid report_markdown: %r",
            type(report_markdown),
        )
        raise ValueError(
            "Invalid feedback output: missing non-empty 'report_markdown'."
        )
    if not isinstance(questions, list):
        logger.error(
            "Feedback generation returned invalid questions type: %r",
            type(questions),
        )
        raise ValueError("Invalid feedback output: missing list 'questions'.")

    _validate_report_headings(report_markdown)

    payload = {
        "report_markdown": report_markdown,
        "questions": questions,
        "answers": {},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "applied_at": None,
    }
    try:
        validated = ResumeFeedback.model_validate(payload)
    except ValidationError as e:
        logger.error("Feedback generation returned invalid questions: %s", e)
        raise ValueError(
            "Invalid feedback output: malformed 'questions'."
        ) from e

    return validated.model_dump()


async def build_apply_preview(
    resume_data: dict[str, Any],
    job_description: str,
    report_markdown: str,
    questions: list[dict[str, Any]] | list[Any],
    answers: dict[str, str],
    language: str = "en",
    original_resume_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate and apply feedback-driven resume diffs, then return a preview diff."""
    output_language = get_language_name(language)
    answers_block = _format_answers_block(questions, answers)

    prompt = APPLY_FEEDBACK_PROMPT.format(
        output_language=output_language,
        truthfulness_rules=APPLY_FEEDBACK_TRUTHFULNESS_RULES,
        job_description=job_description,
        resume_data=json.dumps(resume_data, ensure_ascii=False),
        report_markdown=report_markdown,
        answers_block=answers_block,
    )

    result = await complete_json(
        prompt=prompt,
        system_prompt=(
            "You are an expert resume editor. Apply candidate clarifications "
            "truthfully and output only valid JSON diffs."
        ),
        max_tokens=8192,
        schema_type="diff",
    )

    raw_changes = result.get("changes")
    if not isinstance(raw_changes, list):
        logger.error("Apply preview returned non-list changes: %r", type(raw_changes))
        raise ValueError("Invalid feedback apply output: 'changes' must be a list.")

    changes: list[ResumeChange] = []
    malformed_changes = 0
    for raw in raw_changes:
        if not isinstance(raw, dict):
            malformed_changes += 1
            continue
        try:
            changes.append(
                ResumeChange(
                    path=str(raw.get("path", "")),
                    action=raw.get("action", "replace"),
                    original=raw.get("original"),
                    value=raw.get("value", ""),
                    reason=str(raw.get("reason", "")),
                )
            )
        except Exception as e:
            malformed_changes += 1
            logger.warning("Skipping malformed feedback apply change: %s (%s)", raw, e)

    if malformed_changes:
        logger.error("Apply preview had malformed changes: %d", malformed_changes)
        raise ValueError(
            f"Invalid feedback apply output: {malformed_changes} malformed change(s)."
        )

    improved_data, _applied, _rejected = apply_diffs(copy.deepcopy(resume_data), changes)
    improved_data = finalize_tailored_work_experience(
        original_resume_data, improved_data
    )
    diff_summary, detailed_changes = calculate_resume_diff(resume_data, improved_data)

    return {
        "improved_data": improved_data,
        "diff_summary": diff_summary.model_dump(),
        "detailed_changes": [change.model_dump() for change in detailed_changes],
        "strategy_notes": str(result.get("strategy_notes", "")),
    }


def _format_answers_block(
    questions: list[dict[str, Any]] | list[Any],
    answers: dict[str, str],
) -> str:
    """Render question prompts and candidate answers into a prompt-ready block."""
    if not questions:
        return "No clarification questions were provided."

    lines: list[str] = []
    for index, question in enumerate(questions, start=1):
        if isinstance(question, dict):
            question_id = str(question.get("question_id", f"q{index}"))
            prompt = str(question.get("prompt", "")).strip()
        else:
            question_id = str(getattr(question, "question_id", f"q{index}"))
            prompt = str(getattr(question, "prompt", "")).strip()

        answer = answers.get(question_id, "").strip()
        display_prompt = prompt or "No prompt provided."
        display_answer = answer or "(No answer provided)"
        lines.append(f"Q{index} [{question_id}]: {display_prompt}")
        lines.append(f"A{index}: {display_answer}")
        lines.append("")

    return "\n".join(lines).strip()


def _validate_report_headings(report_markdown: str) -> None:
    """Ensure the feedback markdown includes all required report headings."""
    missing: list[str] = []
    for heading in _REQUIRED_REPORT_HEADINGS:
        pattern = rf"^[ \t]*#{{1,6}}[ \t]*{re.escape(heading)}[ \t]*:?[ \t]*$"
        if not re.search(pattern, report_markdown, flags=re.IGNORECASE | re.MULTILINE):
            missing.append(heading)

    if missing:
        raise ValueError(
            "Feedback report is missing required heading(s): "
            + ", ".join(missing)
        )
