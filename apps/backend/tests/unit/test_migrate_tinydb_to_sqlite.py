"""Unit tests for TinyDB → SQLite migration."""

import pytest

from app.database import Database


def _write_tinydb(path, resumes, jobs=None, improvements=None):
    from tinydb import TinyDB

    jobs = jobs or []
    improvements = improvements or []
    tdb = TinyDB(path)
    try:
        tdb.table("resumes").insert_multiple(resumes)
        if jobs:
            tdb.table("jobs").insert_multiple(jobs)
        if improvements:
            tdb.table("improvements").insert_multiple(improvements)
    finally:
        tdb.close()


@pytest.fixture
def migration_env(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "data_dir", tmp_path)
    return tmp_path


class TestMigrateTinydbToSqlite:
    async def test_imports_from_migrated_file_when_sqlite_empty(
        self, migration_env, tmp_path
    ):
        from app.scripts.migrate_tinydb_to_sqlite import migrate

        migrated_path = migration_env / "database.json.migrated"
        _write_tinydb(
            migrated_path,
            resumes=[
                {
                    "resume_id": "resume-1",
                    "content": "Jane Doe",
                    "content_type": "md",
                    "is_master": True,
                    "processing_status": "ready",
                    "created_at": "2026-01-01T00:00:00Z",
                    "updated_at": "2026-01-01T00:00:00Z",
                }
            ],
            jobs=[
                {
                    "job_id": "job-1",
                    "content": "Backend engineer role",
                    "resume_id": "resume-1",
                    "created_at": "2026-01-01T00:00:00Z",
                }
            ],
        )

        test_db = Database(db_path=tmp_path / "resume_matcher.db")
        try:
            result = await migrate(database=test_db)
            assert result["status"] == "migrated"
            assert result["resumes"] == 1
            assert result["jobs"] == 1

            stats = await test_db.get_stats()
            assert stats["total_resumes"] == 1
            assert stats["total_jobs"] == 1

            resume = await test_db.get_resume("resume-1")
            assert resume is not None
            assert resume["is_master"] is True
            assert migrated_path.exists()
        finally:
            await test_db.close()

    async def test_prefers_live_legacy_file_over_migrated(self, migration_env, tmp_path):
        from app.scripts.migrate_tinydb_to_sqlite import migrate

        live_path = migration_env / "database.json"
        migrated_path = migration_env / "database.json.migrated"

        _write_tinydb(
            migrated_path,
            resumes=[
                {
                    "resume_id": "old-resume",
                    "content": "old",
                    "content_type": "md",
                    "is_master": True,
                    "processing_status": "ready",
                    "created_at": "2026-01-01T00:00:00Z",
                    "updated_at": "2026-01-01T00:00:00Z",
                }
            ],
        )
        _write_tinydb(
            live_path,
            resumes=[
                {
                    "resume_id": "live-resume",
                    "content": "live",
                    "content_type": "md",
                    "is_master": True,
                    "processing_status": "ready",
                    "created_at": "2026-01-02T00:00:00Z",
                    "updated_at": "2026-01-02T00:00:00Z",
                }
            ],
        )

        test_db = Database(db_path=tmp_path / "resume_matcher.db")
        try:
            result = await migrate(database=test_db)
            assert result["status"] == "migrated"
            resume = await test_db.get_resume("live-resume")
            assert resume is not None
            assert await test_db.get_resume("old-resume") is None
            assert not live_path.exists()
            assert migrated_path.exists()
        finally:
            await test_db.close()

    async def test_no_legacy_file_when_both_missing(self, migration_env, tmp_path):
        from app.scripts.migrate_tinydb_to_sqlite import migrate

        test_db = Database(db_path=tmp_path / "resume_matcher.db")
        try:
            result = await migrate(database=test_db)
            assert result == {"status": "no_legacy_file"}
        finally:
            await test_db.close()
