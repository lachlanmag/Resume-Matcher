"""Shared checks for the resume-feedback tools."""

from typing import Any

from mcp.server.mcpserver.exceptions import ToolError
from pydantic import ValidationError

from app.config_cache import load_config
from app.database import db
from app.mcp_server.tools._shared import require_resume
from app.schemas.feedback import ResumeFeedback


def ensure_feedback_enabled() -> None:
    if not load_config().get("enable_resume_feedback", True):
        raise ToolError("Resume feedback is turned off in Settings.")


async def require_tailored(resume_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """The tailored resume and its improvement record (job and source links)."""
    resume = await require_resume(resume_id)
    improvement = await db.get_improvement_by_tailored_resume(resume_id)
    if not resume.get("parent_id") or not improvement:
        raise ToolError(
            "Feedback is only for tailored resumes (saved with tailor_and_verify)."
        )
    return resume, improvement


def stored_feedback(resume: dict[str, Any]) -> ResumeFeedback | None:
    raw = resume.get("resume_feedback")
    if not raw:
        return None
    try:
        return ResumeFeedback.model_validate(raw)
    except ValidationError as e:
        raise ToolError("The stored feedback is invalid; write it again.") from e
