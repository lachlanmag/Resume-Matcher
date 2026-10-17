"""Tests for improvement-record upsert behavior."""

import pytest

from app.database import Database


@pytest.fixture
async def db(tmp_path):
    database = Database(db_path=tmp_path / "test_db.db")
    yield database
    await database.close()


async def test_upsert_improvement_updates_job_id(db):
    """Upserting a tailored resume must replace stale job context."""
    tailored_resume_id = "tailored-1"

    await db.create_improvement(
        original_resume_id="original-1",
        tailored_resume_id=tailored_resume_id,
        job_id="jobA",
        improvements=[{"suggestion": "old"}],
    )
    seeded = await db.get_improvement_by_tailored_resume(tailored_resume_id)
    assert seeded is not None
    assert seeded["job_id"] == "jobA"

    await db.upsert_improvement(
        original_resume_id="original-1",
        tailored_resume_id=tailored_resume_id,
        job_id="jobB",
        improvements=[{"suggestion": "new"}],
    )

    updated = await db.get_improvement_by_tailored_resume(tailored_resume_id)
    assert updated is not None
    assert updated["job_id"] == "jobB"
    assert updated["improvements"] == [{"suggestion": "new"}]
