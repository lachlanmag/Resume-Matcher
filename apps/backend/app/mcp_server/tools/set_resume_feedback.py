from datetime import datetime, timezone
from typing import Any

from mcp.server.mcpserver.exceptions import ToolError

from app.database import db
from app.mcp_server.tools._feedback import ensure_feedback_enabled, require_tailored
from app.mcp_server.tools._shared import guard
from app.schemas.feedback import FeedbackQuestion, ResumeFeedback
from app.services.feedback import validate_report_headings


@guard
async def set_resume_feedback(
    resume_id: str,
    report_markdown: str,
    questions: list[FeedbackQuestion],
) -> dict[str, Any]:
    """Store hiring feedback you wrote for a tailored resume (get_resume_feedback first).

    report_markdown must use every heading in report_headings as a markdown heading.
    questions are what you need the user to clarify; each has a unique question_id, a
    category, a prompt and optional context. Replaces any earlier feedback and clears the
    user's answers. The app shows the report and lets the user answer the questions.
    """
    ensure_feedback_enabled()
    await require_tailored(resume_id)
    if not report_markdown.strip():
        raise ToolError("report_markdown is empty.")
    try:
        validate_report_headings(report_markdown)
    except ValueError as e:
        raise ToolError(str(e)) from e
    ids = [q.question_id for q in questions]
    if len(set(ids)) != len(ids) or any(not i.strip() for i in ids):
        raise ToolError("Each question needs a unique, non-empty question_id.")
    feedback = ResumeFeedback(
        report_markdown=report_markdown,
        questions=questions,
        answers={},
        generated_at=datetime.now(timezone.utc).isoformat(),
        applied_at=None,
    )
    await db.update_resume(resume_id, {"resume_feedback": feedback.model_dump()})
    return {"resume_id": resume_id, "questions": len(questions), "saved": True}
