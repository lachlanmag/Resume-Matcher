"""Integration tests for per-resume tailor length settings endpoints."""

import copy
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.models import ImproveDiffResult


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed_tailored_resume(isolated_db, sample_resume):
    """Master + tailored resume + job + improvement (apply-length prerequisites)."""
    master = await isolated_db.create_resume(
        content=json.dumps(sample_resume),
        is_master=True,
        processed_data=copy.deepcopy(sample_resume),
        processing_status="ready",
    )
    tailored = await isolated_db.create_resume(
        content=json.dumps(sample_resume),
        is_master=False,
        parent_id=master["resume_id"],
        processed_data=copy.deepcopy(sample_resume),
        processing_status="ready",
    )
    job = await isolated_db.create_job(
        content="We need a Senior Backend Engineer with Python and AWS experience.",
        resume_id=tailored["resume_id"],
    )
    await isolated_db.create_improvement(
        original_resume_id=master["resume_id"],
        tailored_resume_id=tailored["resume_id"],
        job_id=job["job_id"],
        improvements=[],
    )
    return master, tailored, job


class TestPatchTailorSettings:
    """PATCH /api/v1/resumes/{resume_id}/tailor-settings"""

    async def test_persists_settings_on_tailored_resume(self, isolated_db, sample_resume):
        _, tailored, _ = await _seed_tailored_resume(isolated_db, sample_resume)
        resume_id = tailored["resume_id"]

        async with _client() as client:
            resp = await client.patch(
                f"/api/v1/resumes/{resume_id}/tailor-settings",
                json={
                    "target_pages": 2,
                    "bullets_per_job_min": 2,
                    "bullets_per_job_max": 4,
                },
            )

        assert resp.status_code == 200
        settings = resp.json()["data"]["tailor_settings"]
        assert settings == {
            "target_pages": 2,
            "bullets_per_job_min": 2,
            "bullets_per_job_max": 4,
        }

        stored = await isolated_db.get_resume(resume_id)
        assert stored["tailor_settings"] == settings

    async def test_partial_patch_merges_with_existing_settings(
        self, isolated_db, sample_resume
    ):
        _, tailored, _ = await _seed_tailored_resume(isolated_db, sample_resume)
        resume_id = tailored["resume_id"]
        await isolated_db.update_resume(
            resume_id,
            {
                "tailor_settings": {
                    "target_pages": 1,
                    "bullets_per_job_min": 2,
                    "bullets_per_job_max": 5,
                }
            },
        )

        async with _client() as client:
            resp = await client.patch(
                f"/api/v1/resumes/{resume_id}/tailor-settings",
                json={"target_pages": 3},
            )

        assert resp.status_code == 200
        settings = resp.json()["data"]["tailor_settings"]
        assert settings["target_pages"] == 3
        assert settings["bullets_per_job_min"] == 2
        assert settings["bullets_per_job_max"] == 5

    async def test_rejects_master_resume(self, isolated_db, sample_resume):
        master, _, _ = await _seed_tailored_resume(isolated_db, sample_resume)

        async with _client() as client:
            resp = await client.patch(
                f"/api/v1/resumes/{master['resume_id']}/tailor-settings",
                json={"target_pages": 2},
            )

        assert resp.status_code == 400
        assert "tailored" in resp.json()["detail"].lower()

    async def test_unknown_resume_returns_404(self, isolated_db):
        async with _client() as client:
            resp = await client.patch(
                "/api/v1/resumes/missing-id/tailor-settings",
                json={"target_pages": 2},
            )

        assert resp.status_code == 404


class TestApplyTailorLength:
    """POST /api/v1/resumes/{resume_id}/apply-tailor-length"""

    async def test_persists_settings_and_processed_data(
        self, isolated_db, sample_resume
    ):
        _, tailored, _ = await _seed_tailored_resume(isolated_db, sample_resume)
        resume_id = tailored["resume_id"]

        with patch(
            "app.routers.resumes.generate_length_selection_diffs",
            new_callable=AsyncMock,
            return_value=ImproveDiffResult(changes=[]),
        ):
            async with _client() as client:
                resp = await client.post(
                    f"/api/v1/resumes/{resume_id}/apply-tailor-length",
                    json={"target_pages": 1, "bullets_per_job_min": 2, "bullets_per_job_max": 3},
                )

        assert resp.status_code == 200
        body = resp.json()
        assert body["resume_id"] == resume_id
        assert body["resume_preview"]["summary"] == sample_resume["summary"]

        stored = await isolated_db.get_resume(resume_id)
        assert stored["tailor_settings"] == {
            "target_pages": 1,
            "bullets_per_job_min": 2,
            "bullets_per_job_max": 3,
        }
        assert stored["processed_data"]["summary"] == sample_resume["summary"]

    async def test_rejects_master_resume(self, isolated_db, sample_resume):
        master, _, _ = await _seed_tailored_resume(isolated_db, sample_resume)

        async with _client() as client:
            resp = await client.post(
                f"/api/v1/resumes/{master['resume_id']}/apply-tailor-length",
            )

        assert resp.status_code == 400
        assert "tailored" in resp.json()["detail"].lower()

    async def test_requires_improvement_record(self, isolated_db, sample_resume):
        master = await isolated_db.create_resume(
            content=json.dumps(sample_resume),
            is_master=True,
            processed_data=copy.deepcopy(sample_resume),
            processing_status="ready",
        )
        tailored = await isolated_db.create_resume(
            content=json.dumps(sample_resume),
            is_master=False,
            parent_id=master["resume_id"],
            processed_data=copy.deepcopy(sample_resume),
            processing_status="ready",
        )

        async with _client() as client:
            resp = await client.post(
                f"/api/v1/resumes/{tailored['resume_id']}/apply-tailor-length",
            )

        assert resp.status_code == 400
        assert "job context" in resp.json()["detail"].lower()
