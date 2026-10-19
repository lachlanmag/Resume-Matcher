from typing import Any

from app.config_cache import get_content_language, load_config
from app.mcp_server.tools._feedback import require_tailored, stored_feedback
from app.mcp_server.tools._shared import guard
from app.prompts import APPLY_FEEDBACK_TRUTHFULNESS_RULES, get_language_name
from app.prompts.templates import TAILORED_RESUME_FEEDBACK_PROMPT
from app.services.cover_letter import _resolve_feature_prompt
from app.services.feedback import REQUIRED_REPORT_HEADINGS


@guard
async def get_resume_feedback(resume_id: str) -> dict[str, Any]:
    """Get a tailored resume's hiring feedback, the user's answers, and how to write it.

    feedback is null until set_resume_feedback stores one. answers maps question_id to
    what the user typed in the app. instructions is the user's feedback prompt (custom or
    default): follow it, filling {job_description} from get_resume_job, {resume_data} from
    get_resume and {output_language} from output_language. apply_rules govern
    apply_resume_feedback.
    """
    resume, _ = await require_tailored(resume_id)
    feedback = stored_feedback(resume)
    template, _ = _resolve_feature_prompt(
        "resume_feedback_prompt", TAILORED_RESUME_FEEDBACK_PROMPT
    )
    answers = feedback.answers if feedback else {}
    return {
        "resume_id": resume_id,
        "enabled": bool(load_config().get("enable_resume_feedback", True)),
        "feedback": feedback.model_dump() if feedback else None,
        "unanswered_question_ids": [
            q.question_id
            for q in (feedback.questions if feedback else [])
            if not answers.get(q.question_id, "").strip()
        ],
        "output_language": get_language_name(get_content_language()),
        "report_headings": list(REQUIRED_REPORT_HEADINGS),
        "question_categories": ["gap", "risk", "clarification", "improvement", "ats"],
        "instructions": template,
        "apply_rules": APPLY_FEEDBACK_TRUTHFULNESS_RULES,
    }
