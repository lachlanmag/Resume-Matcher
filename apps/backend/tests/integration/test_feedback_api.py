"""Integration tests for tailored resume feedback endpoints."""

import copy
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

SAMPLE_FEEDBACK = {
    "report_markdown": "## Candidate summary\nStrong backend fit.\n",
    "questions": [
        {
            "question_id": "q1",
            "category": "gap",
            "prompt": "What was the scope of the migration?",
            "context": "",
        },
        {
            "question_id": "q2",
            "category": "clarification",
            "prompt": "Which cloud tools did you use?",
            "context": "",
        },
    ],
    "answers": {"q1": "Led a migration for 3 teams."},
    "generated_at": "2026-06-30T12:00:00Z",
    "applied_at": None,
}


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def mock_job_record():
    return {
        "job_id": "job-456",
        "content": "Senior Backend Engineer with Python, FastAPI, and AWS experience.",
        "resume_id": "tailored-123",
        "created_at": "2026-01-01T00:00:00Z",
    }


@pytest.fixture
def mock_improvement_record(mock_job_record):
    return {
        "improvement_id": "imp-789",
        "original_resume_id": "master-001",
        "tailored_resume_id": "tailored-123",
        "job_id": mock_job_record["job_id"],
        "improvements": [],
        "created_at": "2026-01-01T00:00:00Z",
    }


@pytest.fixture
def mock_tailored_resume_record(sample_resume):
    """A tailored resume DB record with parent_id and processed_data."""
    return {
        "resume_id": "tailored-123",
        "content": json.dumps(sample_resume),
        "content_type": "json",
        "filename": "resume.pdf",
        "is_master": False,
        "parent_id": "master-001",
        "processed_data": copy.deepcopy(sample_resume),
        "processing_status": "ready",
        "cover_letter": None,
        "outreach_message": None,
        "title": "Backend Engineer at TechCorp",
        "original_markdown": None,
        "resume_feedback": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }


@pytest.fixture
def mock_master_resume_record(sample_resume):
    """Master resume record (no parent_id)."""
    return {
        "resume_id": "master-001",
        "content": json.dumps(sample_resume),
        "content_type": "json",
        "filename": "resume.pdf",
        "is_master": True,
        "parent_id": None,
        "processed_data": copy.deepcopy(sample_resume),
        "processing_status": "ready",
        "cover_letter": None,
        "outreach_message": None,
        "title": None,
        "original_markdown": "# Jane Doe\nSenior Backend Engineer",
        "resume_feedback": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }


def _wire_tailored_db(
    mock_db,
    resume_record,
    job_record,
    improvement_record,
    master_record=None,
):
    records = {resume_record["resume_id"]: resume_record}
    if master_record is not None:
        records[master_record["resume_id"]] = master_record

    async def get_resume_side_effect(resume_id):
        return records.get(resume_id)

    mock_db.get_resume.side_effect = get_resume_side_effect
    mock_db.get_improvement_by_tailored_resume.return_value = improvement_record
    mock_db.get_job.return_value = job_record


class TestFeedbackGenerate:
    """POST /api/v1/resumes/{resume_id}/feedback/generate"""

    @pytest.fixture(autouse=True)
    def enable_feedback_feature(self):
        with patch(
            "app.routers.resumes._load_config",
            return_value={"enable_resume_feedback": True},
        ):
            yield

    @patch("app.routers.resumes.generate_structured_feedback", new_callable=AsyncMock)
    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_generate_persists_feedback(
        self,
        mock_db,
        mock_gen,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        mock_gen.return_value = SAMPLE_FEEDBACK
        _wire_tailored_db(
            mock_db,
            mock_tailored_resume_record,
            mock_job_record,
            mock_improvement_record,
        )
        mock_db.update_resume.return_value = {
            **mock_tailored_resume_record,
            "resume_feedback": SAMPLE_FEEDBACK,
        }

        async with client:
            resp = await client.post(
                "/api/v1/resumes/tailored-123/feedback/generate",
                json={"replace": False},
            )

        assert resp.status_code == 200
        assert resp.json()["data"] == SAMPLE_FEEDBACK
        mock_gen.assert_awaited_once()
        mock_db.update_resume.assert_called_once_with(
            "tailored-123",
            {"resume_feedback": SAMPLE_FEEDBACK},
        )

    @patch("app.routers.resumes.generate_structured_feedback", new_callable=AsyncMock)
    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_returns_existing_without_replace(
        self,
        mock_db,
        mock_gen,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        resume_with_feedback = {
            **mock_tailored_resume_record,
            "resume_feedback": SAMPLE_FEEDBACK,
        }
        _wire_tailored_db(
            mock_db,
            resume_with_feedback,
            mock_job_record,
            mock_improvement_record,
        )

        async with client:
            resp = await client.post(
                "/api/v1/resumes/tailored-123/feedback/generate",
                json={"replace": False},
            )

        assert resp.status_code == 200
        assert resp.json()["data"] == SAMPLE_FEEDBACK
        mock_gen.assert_not_called()
        mock_db.update_resume.assert_not_called()

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_rejects_master_resume(
        self,
        mock_db,
        client,
        mock_master_resume_record,
    ):
        mock_db.get_resume.return_value = mock_master_resume_record

        async with client:
            resp = await client.post(
                "/api/v1/resumes/master-001/feedback/generate",
                json={"replace": False},
            )

        assert resp.status_code == 400
        assert "tailored" in resp.json()["detail"].lower()

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_rejects_when_feature_disabled(
        self,
        mock_db,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        _wire_tailored_db(
            mock_db,
            mock_tailored_resume_record,
            mock_job_record,
            mock_improvement_record,
        )

        with patch(
            "app.routers.resumes._load_config",
            return_value={"enable_resume_feedback": False},
        ):
            async with client:
                resp = await client.post(
                    "/api/v1/resumes/tailored-123/feedback/generate",
                    json={"replace": False},
                )

        assert resp.status_code == 400
        assert "disabled" in resp.json()["detail"].lower()
        mock_db.update_resume.assert_not_called()

    @patch("app.routers.resumes.generate_structured_feedback", new_callable=AsyncMock)
    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_generate_rejects_invalid_llm_output(
        self,
        mock_db,
        mock_gen,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        mock_gen.side_effect = ValueError(
            "Invalid feedback output: malformed 'questions'."
        )
        _wire_tailored_db(
            mock_db,
            mock_tailored_resume_record,
            mock_job_record,
            mock_improvement_record,
        )

        async with client:
            resp = await client.post(
                "/api/v1/resumes/tailored-123/feedback/generate",
                json={"replace": False},
            )

        assert resp.status_code == 500
        assert "generate" in resp.json()["detail"].lower()
        mock_db.update_resume.assert_not_called()


class TestFeedbackAnswers:
    """PATCH /api/v1/resumes/{resume_id}/feedback/answers"""

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_patch_merges_answers(
        self,
        mock_db,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        existing_feedback = {
            **SAMPLE_FEEDBACK,
            "answers": {"q1": "Led a migration for 3 teams."},
        }
        resume_with_feedback = {
            **mock_tailored_resume_record,
            "resume_feedback": existing_feedback,
        }
        _wire_tailored_db(
            mock_db,
            resume_with_feedback,
            mock_job_record,
            mock_improvement_record,
        )
        mock_db.update_resume.return_value = resume_with_feedback

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/tailored-123/feedback/answers",
                json={"answers": {"q2": "Used AWS ECS and Terraform."}},
            )

        assert resp.status_code == 200
        answers = resp.json()["data"]["answers"]
        assert answers["q1"] == "Led a migration for 3 teams."
        assert answers["q2"] == "Used AWS ECS and Terraform."
        mock_db.update_resume.assert_called_once()
        update_payload = mock_db.update_resume.call_args[0][1]
        assert update_payload["resume_feedback"]["answers"] == answers

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_rejects_unknown_question_id(
        self,
        mock_db,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        resume_with_feedback = {
            **mock_tailored_resume_record,
            "resume_feedback": SAMPLE_FEEDBACK,
        }
        _wire_tailored_db(
            mock_db,
            resume_with_feedback,
            mock_job_record,
            mock_improvement_record,
        )

        async with client:
            resp = await client.patch(
                "/api/v1/resumes/tailored-123/feedback/answers",
                json={"answers": {"unknown_q": "Some answer"}},
            )

        assert resp.status_code == 400
        assert "unknown_q" in resp.json()["detail"].lower()
        mock_db.update_resume.assert_not_called()


class TestFeedbackApply:
    """POST /api/v1/resumes/{resume_id}/feedback/apply-preview and /apply"""

    @patch("app.routers.resumes.build_apply_preview", new_callable=AsyncMock)
    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_apply_preview_returns_diff(
        self,
        mock_db,
        mock_preview,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
        sample_resume,
    ):
        improved_data = copy.deepcopy(sample_resume)
        improved_data["summary"] = "Updated summary after feedback apply preview."
        preview_payload = {
            "improved_data": improved_data,
            "diff_summary": {
                "total_changes": 1,
                "skills_added": 0,
                "skills_removed": 0,
                "descriptions_modified": 0,
                "certifications_added": 0,
                "high_risk_changes": 0,
            },
            "detailed_changes": [
                {
                    "path": "summary",
                    "action": "replace",
                    "original": sample_resume["summary"],
                    "value": improved_data["summary"],
                    "reason": "Clarified scope per candidate answer",
                }
            ],
            "strategy_notes": "Focused on summary only.",
        }
        mock_preview.return_value = preview_payload

        resume_with_feedback = {
            **mock_tailored_resume_record,
            "resume_feedback": SAMPLE_FEEDBACK,
        }
        _wire_tailored_db(
            mock_db,
            resume_with_feedback,
            mock_job_record,
            mock_improvement_record,
        )

        async with client:
            resp = await client.post(
                "/api/v1/resumes/tailored-123/feedback/apply-preview",
            )

        assert resp.status_code == 200
        assert resp.json()["data"] == preview_payload
        mock_preview.assert_awaited_once()

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_apply_updates_resume(
        self,
        mock_db,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
        sample_resume,
    ):
        improved_data = copy.deepcopy(sample_resume)
        improved_data["summary"] = "Updated summary from feedback apply."

        resume_with_feedback = {
            **mock_tailored_resume_record,
            "resume_feedback": SAMPLE_FEEDBACK,
        }
        _wire_tailored_db(
            mock_db,
            resume_with_feedback,
            mock_job_record,
            mock_improvement_record,
        )

        async def update_side_effect(resume_id, updates):
            return {**resume_with_feedback, **updates}

        mock_db.update_resume.side_effect = update_side_effect

        async with client:
            resp = await client.post(
                "/api/v1/resumes/tailored-123/feedback/apply",
                json={"improved_data": improved_data},
            )

        assert resp.status_code == 200
        mock_db.update_resume.assert_called_once()
        resume_id, update_payload = mock_db.update_resume.call_args[0]
        assert resume_id == "tailored-123"
        assert update_payload["processed_data"]["summary"] == improved_data["summary"]
        assert update_payload["processing_status"] == "ready"
        assert update_payload["resume_feedback"]["applied_at"] is not None

        data = resp.json()["data"]
        assert data["resume_id"] == "tailored-123"
        assert data["processed_resume"]["summary"] == improved_data["summary"]
        assert data["resume_feedback"]["applied_at"] is not None

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_apply_preserves_multi_role_work_experience(
        self,
        mock_db,
        client,
        mock_tailored_resume_record,
        mock_job_record,
        mock_improvement_record,
    ):
        master_data = {
            "personalInfo": {"name": "Jane Doe"},
            "summary": "Product leader.",
            "workExperience": [
                {
                    "id": 1,
                    "company": "Example Industries",
                    "location": "New York, NY",
                    "roles": [
                        {
                            "id": 1,
                            "title": "Product Owner",
                            "years": "Sep 2021 - Nov 2023",
                        },
                        {
                            "id": 2,
                            "title": "Senior Business Analyst",
                            "years": "Jul 2019 - Sep 2021",
                        },
                    ],
                    "description": ["Led product strategy"],
                }
            ],
            "education": [],
            "personalProjects": [],
            "additional": {
                "technicalSkills": [],
                "languages": [],
                "certificationsTraining": [],
                "awards": [],
            },
            "sectionMeta": [],
            "customSections": {},
        }
        master_record = {
            "resume_id": "master-001",
            "processed_data": master_data,
        }
        flattened_apply_payload = {
            "personalInfo": master_data["personalInfo"],
            "summary": "Product leader with clarified scope.",
            "workExperience": [
                {
                    "id": 1,
                    "company": "Example Industries",
                    "location": "New York, NY",
                    "title": "Product Owner",
                    "years": "Sep 2021 - Nov 2023",
                    "description": ["Led product strategy across platform modules"],
                }
            ],
            "education": [],
            "personalProjects": [],
            "additional": master_data["additional"],
            "sectionMeta": [],
            "customSections": {},
        }

        resume_with_feedback = {
            **mock_tailored_resume_record,
            "processed_data": flattened_apply_payload,
            "resume_feedback": SAMPLE_FEEDBACK,
        }
        _wire_tailored_db(
            mock_db,
            resume_with_feedback,
            mock_job_record,
            mock_improvement_record,
            master_record=master_record,
        )

        async def update_side_effect(resume_id, updates):
            return {**resume_with_feedback, **updates}

        mock_db.update_resume.side_effect = update_side_effect

        async with client:
            resp = await client.post(
                "/api/v1/resumes/tailored-123/feedback/apply",
                json={"improved_data": flattened_apply_payload},
            )

        assert resp.status_code == 200
        update_payload = mock_db.update_resume.call_args[0][1]
        roles = update_payload["processed_data"]["workExperience"][0]["roles"]
        assert len(roles) == 2
        assert roles[0]["title"] == "Product Owner"
        assert roles[1]["title"] == "Senior Business Analyst"
        assert update_payload["processed_data"]["workExperience"][0]["description"] == [
            "Led product strategy across platform modules"
        ]
