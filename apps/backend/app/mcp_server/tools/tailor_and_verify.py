import logging
from typing import Any

from app.mcp_server.tools._shared import (
    ensure_within_size_limit,
    guard,
    require_job,
    require_resume,
    require_structured,
    resolve_tailor_length,
    store_tailored_resume,
    tailoring_report,
)
from app.mcp_server.tools.verify_resume import MaxPages, verify
from app.schemas import ResumeData
from app.schemas.models import PageFitSettings, TailorLengthSettings

logger = logging.getLogger(__name__)


@guard
async def tailor_and_verify(
    source_resume_id: str,
    job_id: str,
    resume_data: ResumeData,
    title: str | None = None,
    print_settings: PageFitSettings | None = None,
    max_pages: MaxPages = None,
    track_application: bool = True,
    tailor_length_settings: TailorLengthSettings | None = None,
    replace_resume_id: str | None = None,
) -> dict[str, Any]:
    """Validate, save and verify a tailored resume you wrote, in one call.

    If validation fails nothing is written and saved is false. Otherwise the resume is saved
    and the result includes the same report as verify_resume. If verification itself fails
    after the save, the result has saved true and verify_error instead of the report: do not
    save again, call verify_resume. Fix issues with update_resume, then call verify_resume.

    tailor_length_settings (target_pages, bullets_per_job_min/max) defaults to the source's,
    else the user's Settings; it is stored on the resume, max_pages defaults to its
    target_pages, and bullets_per_job flags jobs outside the range. replace_resume_id
    rewrites that tailored resume of the same source in place (Re-tailor): same id and
    tracker card, no new card.
    """
    source = await require_resume(source_resume_id)
    job = await require_job(job_id)
    candidate = resume_data.model_dump()
    ensure_within_size_limit(candidate)
    validation = tailoring_report(require_structured(source), candidate)
    if not validation["valid"]:
        return {"saved": False, "validation": validation}
    saved = await store_tailored_resume(
        source,
        job,
        candidate,
        title,
        track_application,
        tailor_length=resolve_tailor_length(source, tailor_length_settings),
        replace_resume_id=replace_resume_id,
    )
    try:
        tailored = await require_resume(saved["resume_id"])
        report = await verify(
            tailored, job_id, print_settings or PageFitSettings(), max_pages
        )
    except Exception as e:  # noqa: BLE001 - the resume is already saved
        logger.error("Verify failed after saving %s: %s", saved["resume_id"], e)
        return {
            "saved": True,
            "resume": saved,
            "validation": validation,
            "verify_error": (
                "Verification failed after the resume was saved. Do not save "
                "again; call verify_resume with the saved resume_id."
            ),
        }
    return {"saved": True, "resume": saved, "validation": validation, **report}
