"""Cover letter, outreach message, resume title, and feedback generation."""

import json
import logging
from typing import Any

from app.config import load_config_file
from app.llm import complete
from app.prompts.templates import (
    COVER_LETTER_PROMPT,
    GENERATE_TITLE_PROMPT,
    OUTREACH_MESSAGE_PROMPT,
    TAILORED_RESUME_FEEDBACK_PROMPT,
)
from app.prompts import get_language_name


def _resolve_feature_prompt(
    custom_key: str,
    default_template: str,
) -> tuple[str, bool]:
    """Resolve a feature-prompt template at runtime.

    Returns ``(template, is_custom)``. If the stored custom prompt is
    empty or absent, returns the default template. The ``is_custom`` flag
    lets callers decide whether to fall back to the default on a format
    failure (defensive — save-time validation should have caught a
    malformed custom prompt).
    """
    stored = load_config_file()
    custom = (stored.get(custom_key) or "").strip()
    if not custom:
        return default_template, False
    return custom, True


async def generate_cover_letter(
    resume_data: dict[str, Any],
    job_description: str,
    language: str = "en",
) -> str:
    """Generate a cover letter based on resume and job description.

    Args:
        resume_data: Structured resume data (ResumeData format)
        job_description: Target job description text
        language: Output language code (en, es, zh, ja)

    Returns:
        Generated cover letter as plain text
    """
    output_language = get_language_name(language)

    template, is_custom = _resolve_feature_prompt(
        "cover_letter_prompt", COVER_LETTER_PROMPT
    )
    try:
        prompt = template.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data),
            output_language=output_language,
        )
    except (KeyError, IndexError, ValueError) as e:
        # str.format() raises KeyError for unknown placeholders, IndexError for
        # positional out-of-range, and ValueError for unmatched/invalid braces
        # (e.g., ``{foo``). If the failing template is the built-in default,
        # something is broken upstream and the caller should see it — re-raise.
        # If it's a user-supplied custom prompt, fall back to the default with a
        # warning so generation doesn't crash on out-of-band disk edits.
        if not is_custom:
            raise
        logging.warning(
            "Custom cover letter prompt failed to format (%s); falling back to default",
            e,
        )
        prompt = COVER_LETTER_PROMPT.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data),
            output_language=output_language,
        )

    result = await complete(
        prompt=prompt,
        system_prompt="You are a professional career coach and resume writer. Write compelling, personalized cover letters.",
        max_tokens=2048,
    )

    return result.strip()


async def generate_outreach_message(
    resume_data: dict[str, Any],
    job_description: str,
    language: str = "en",
) -> str:
    """Generate a cold outreach message for networking.

    Args:
        resume_data: Structured resume data (ResumeData format)
        job_description: Target job description text
        language: Output language code (en, es, zh, ja)

    Returns:
        Generated outreach message as plain text
    """
    output_language = get_language_name(language)

    template, is_custom = _resolve_feature_prompt(
        "outreach_message_prompt", OUTREACH_MESSAGE_PROMPT
    )
    try:
        prompt = template.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data),
            output_language=output_language,
        )
    except (KeyError, IndexError, ValueError) as e:
        # See generate_cover_letter for rationale on the exception set.
        if not is_custom:
            raise
        logging.warning(
            "Custom outreach message prompt failed to format (%s); falling back to default",
            e,
        )
        prompt = OUTREACH_MESSAGE_PROMPT.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data),
            output_language=output_language,
        )

    result = await complete(
        prompt=prompt,
        system_prompt="You are a professional networking coach. Write genuine, engaging cold outreach messages.",
        max_tokens=1024,
    )

    return result.strip()


async def generate_tailored_resume_feedback(
    resume_data: dict[str, Any],
    job_description: str,
    language: str = "en",
) -> str:
    """Generate HR-style feedback for a tailored resume against a job description.

    Args:
        resume_data: Structured resume data (ResumeData format)
        job_description: Target job description text
        language: Output language code (en, es, zh, ja, pt)

    Returns:
        Markdown feedback report
    """
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
        logging.warning(
            "Custom resume feedback prompt failed to format (%s); falling back to default",
            e,
        )
        prompt = TAILORED_RESUME_FEEDBACK_PROMPT.format(
            job_description=job_description,
            resume_data=json.dumps(resume_data, ensure_ascii=False),
            output_language=output_language,
        )

    result = await complete(
        prompt=prompt,
        system_prompt=(
            "You are an HR representative at a SaaS company. "
            "Review tailored resumes objectively and provide actionable feedback."
        ),
        max_tokens=8192,
    )

    return result.strip()


async def generate_resume_title(
    job_description: str,
    language: str = "en",
) -> str:
    """Generate a short descriptive title from a job description.

    Args:
        job_description: Target job description text
        language: Output language code (en, es, zh, ja)

    Returns:
        Generated title like "Senior Frontend Engineer @ Stripe"
    """
    output_language = get_language_name(language)

    prompt = GENERATE_TITLE_PROMPT.format(
        job_description=job_description,
        output_language=output_language,
    )

    result = await complete(
        prompt=prompt,
        system_prompt="You extract job titles and company names from job descriptions.",
        max_tokens=60,
        temperature=0.3,
    )

    # Strip quotes and whitespace, truncate to 80 chars
    title = result.strip().strip("\"'")
    return title[:80]
