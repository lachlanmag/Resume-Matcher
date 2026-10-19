import copy
import json
from datetime import datetime, timezone
from typing import Any

from mcp.server.mcpserver.exceptions import ToolError

from app.database import db
from app.mcp_server.tools._feedback import require_tailored, stored_feedback
from app.mcp_server.tools._shared import (
    canonical,
    ensure_within_size_limit,
    guard,
    require_structured,
    summary,
    tailoring_report,
)
from app.routers.resumes import _grounding_master_data
from app.schemas import ResumeData
from app.schemas.work_experience import finalize_tailored_work_experience
from app.services.resume_preservation import grounding_review_warnings


@guard
async def apply_resume_feedback(
    resume_id: str, resume_data: ResumeData
) -> dict[str, Any]:
    """Save a tailored resume revised from its feedback and the user's answers.

    Start from get_resume and change only what the feedback and answers support
    (get_resume_feedback apply_rules). New facts must come from the user's answers.
    Rejected, with nothing written, if it breaks preservation rules against the current
    resume (personalInfo, employers, roles, dates). On success the feedback is marked
    applied, as when the user applies it in the app.
    """
    resume, _ = await require_tailored(resume_id)
    feedback = stored_feedback(resume)
    if feedback is None:
        raise ToolError("This resume has no feedback yet: set_resume_feedback first.")
    current = require_structured(resume)
    candidate = canonical(resume_data)
    ensure_within_size_limit(candidate)
    report = tailoring_report(current, candidate)
    if not report["valid"]:
        return {"saved": False, "validation": report}
    master = await _grounding_master_data(resume)
    data = finalize_tailored_work_experience(master, copy.deepcopy(candidate))
    applied = feedback.model_copy(
        update={"applied_at": datetime.now(timezone.utc).isoformat()}
    )
    updated = await db.update_resume(
        resume_id,
        {
            "content": json.dumps(data, indent=2),
            "content_type": "json",
            "processed_data": data,
            "processing_status": "ready",
            "resume_feedback": applied.model_dump(),
        },
    )
    return {
        "saved": True,
        "resume": summary(updated),
        "changed_fields": report["changed_fields"],
        # Advisory: facts the master does not show must come from the user's answers.
        "grounding_warnings": grounding_review_warnings(master, data) if master else [],
    }
