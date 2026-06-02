import pytest

from app.database import Database


def test_upsert_improvement_updates_job_id(tmp_path):
    """Upserting a tailored resume must replace stale job context."""
    db_path = tmp_path / "test_database.json"
    db = Database(db_path=db_path)

    tailored_resume_id = "tailored-1"

    # Seed an older improvement record for the same tailored resume.
    db.create_improvement(
        original_resume_id="original-1",
        tailored_resume_id=tailored_resume_id,
        job_id="jobA",
        improvements=[{"suggestion": "old"}],
    )
    seeded = db.get_improvement_by_tailored_resume(tailored_resume_id)
    assert seeded is not None
    assert seeded["job_id"] == "jobA"

    # Upsert should remove/replace the old record.
    db.upsert_improvement(
        original_resume_id="original-1",
        tailored_resume_id=tailored_resume_id,
        job_id="jobB",
        improvements=[{"suggestion": "new"}],
    )

    updated = db.get_improvement_by_tailored_resume(tailored_resume_id)
    assert updated is not None
    assert updated["job_id"] == "jobB"
    assert updated["improvements"] == [{"suggestion": "new"}]

