"""MCP tools for the fork's features: tailoring length, Re-tailor in place, feedback."""

import copy
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.config_cache import invalidate_config_cache
from app.database import Database
from app.services.feedback import REQUIRED_REPORT_HEADINGS
from tests.ats_fixtures import render
from tests.integration.test_mcp_server import (
    _job,
    _master,
    call,
    call_error,
    connect,
    shared_module,
)

pytestmark = pytest.mark.integration

LENGTH = {"target_pages": 1, "bullets_per_job_min": 2, "bullets_per_job_max": 3}
REPORT = "\n\n".join(f"## {heading}\n\nText." for heading in REQUIRED_REPORT_HEADINGS)
QUESTIONS = [
    {"question_id": "q1", "category": "gap", "prompt": "Did you use Kubernetes?"},
    {"question_id": "q2", "category": "ats", "prompt": "Any certifications?"},
]


def _with_bullets(resume: dict[str, Any], count: int) -> dict[str, Any]:
    data = copy.deepcopy(resume)
    job = data["workExperience"][0]
    job["description"] = [f"Built service {i} in Python." for i in range(count)]
    job["descriptionStyles"] = ["bullet"] * count
    return data


async def _tailored(
    mcp: Any, master: dict[str, Any], job_id: str, **extra: Any
) -> dict:
    return await call(
        mcp,
        "save_tailored_resume",
        {
            "source_resume_id": master["resume_id"],
            "job_id": job_id,
            "resume_data": master["resume_data"],
            **extra,
        },
    )


async def test_tailor_and_verify_stores_length_and_checks_it(
    isolated_db: Database,
    monkeypatch: pytest.MonkeyPatch,
    sample_resume: dict[str, Any],
    sample_job_description: str,
    sample_job_keywords: dict[str, Any],
) -> None:
    monkeypatch.setattr(
        shared_module,
        "render_resume_pdf",
        AsyncMock(return_value=render("single-column")),
    )
    async with connect() as mcp:
        master = await _master(mcp, _with_bullets(sample_resume, 6))
        job_id = await _job(mcp, sample_job_description, sample_job_keywords)
        too_many = await call(
            mcp,
            "tailor_and_verify",
            {
                "source_resume_id": master["resume_id"],
                "job_id": job_id,
                "resume_data": master["resume_data"],
                "tailor_length_settings": LENGTH,
            },
        )
        fixed = copy.deepcopy(master["resume_data"])
        fixed["workExperience"][0]["description"] = fixed["workExperience"][0][
            "description"
        ][:3]
        fixed["workExperience"][0]["descriptionStyles"] = ["bullet"] * 3
        await call(
            mcp,
            "update_resume",
            {"resume_id": too_many["resume"]["resume_id"], "resume_data": fixed},
        )
        rechecked = await call(
            mcp, "verify_resume", {"resume_id": too_many["resume"]["resume_id"]}
        )

    saved = await isolated_db.get_resume(too_many["resume"]["resume_id"])
    assert saved["tailor_settings"] == LENGTH
    assert too_many["max_pages"] == 1  # target_pages is the default page limit
    assert "bullets_per_job" in too_many["issues"]
    assert too_many["bullet_count_problems"][0]["index"] == 0
    assert too_many["bullet_count_problems"][0]["bullets"] == 6
    assert "bullets_per_job" not in rechecked["issues"]


async def test_length_defaults_to_settings_and_short_jobs_without_more_bullets_pass(
    isolated_db: Database,
    monkeypatch: pytest.MonkeyPatch,
    sample_resume: dict[str, Any],
    sample_job_description: str,
    sample_job_keywords: dict[str, Any],
) -> None:
    monkeypatch.setattr(
        shared_module,
        "render_resume_pdf",
        AsyncMock(return_value=render("single-column")),
    )
    async with connect() as mcp:
        master = await _master(mcp, _with_bullets(sample_resume, 1))
        job_id = await _job(mcp, sample_job_description, sample_job_keywords)
        result = await call(
            mcp,
            "tailor_and_verify",
            {
                "source_resume_id": master["resume_id"],
                "job_id": job_id,
                "resume_data": master["resume_data"],
            },
        )
    saved = await isolated_db.get_resume(result["resume"]["resume_id"])
    # No settings given: the app's defaults (Settings) are stored, as in-app tailoring does.
    assert saved["tailor_settings"] == {
        "target_pages": 2,
        "bullets_per_job_min": 3,
        "bullets_per_job_max": 5,
    }
    # One bullet, but the master has no more for that job: not a problem.
    assert not any(p["index"] == 0 for p in result["bullet_count_problems"])


async def test_replace_resume_id_rewrites_in_place_without_a_new_card(
    isolated_db: Database,
    sample_resume: dict[str, Any],
    sample_job_description: str,
    sample_job_keywords: dict[str, Any],
) -> None:
    async with connect() as mcp:
        master = await _master(mcp, sample_resume)
        job_id = await _job(mcp, sample_job_description, sample_job_keywords)
        first = await _tailored(mcp, master, job_id, title="First")
        revised = copy.deepcopy(master["resume_data"])
        revised["summary"] = "Backend engineer building Python FastAPI services."
        replaced = await _tailored(
            mcp,
            {**master, "resume_data": revised},
            job_id,
            title="Second",
            replace_resume_id=first["resume_id"],
            tailor_length_settings=LENGTH,
        )
        other_master = await _master(mcp, {**sample_resume, "summary": "Other track."})
        wrong_source = await call_error(
            mcp,
            "save_tailored_resume",
            {
                "source_resume_id": other_master["resume_id"],
                "job_id": job_id,
                "resume_data": other_master["resume_data"],
                "replace_resume_id": first["resume_id"],
            },
        )
        missing = await call_error(
            mcp,
            "save_tailored_resume",
            {
                "source_resume_id": master["resume_id"],
                "job_id": job_id,
                "resume_data": master["resume_data"],
                "replace_resume_id": "no-such-resume",
            },
        )

    assert replaced["resume_id"] == first["resume_id"] and replaced["replaced"] is True
    assert "application_id" not in replaced
    stored = await isolated_db.get_resume(first["resume_id"])
    assert stored["processed_data"]["summary"] == revised["summary"]
    assert stored["title"] == "Second" and stored["tailor_settings"] == LENGTH
    assert len(await isolated_db.list_applications()) == 1
    tailored = [r for r in await isolated_db.list_resumes() if not r["is_master"]]
    assert [r["resume_id"] for r in tailored] == [first["resume_id"]]
    assert "tailored resume of source_resume_id" in wrong_source
    assert "not found" in missing


async def test_feedback_round_trip_with_the_users_answers(
    isolated_db: Database,
    sample_resume: dict[str, Any],
    sample_job_description: str,
    sample_job_keywords: dict[str, Any],
) -> None:
    async with connect() as mcp:
        master = await _master(mcp, sample_resume)
        job_id = await _job(mcp, sample_job_description, sample_job_keywords)
        tailored = await _tailored(mcp, master, job_id)
        rid = tailored["resume_id"]

        empty = await call(mcp, "get_resume_feedback", {"resume_id": rid})
        bad = await call_error(
            mcp,
            "set_resume_feedback",
            {
                "resume_id": rid,
                "report_markdown": "## Strengths\n\nOnly one.",
                "questions": [],
            },
        )
        dup = await call_error(
            mcp,
            "set_resume_feedback",
            {
                "resume_id": rid,
                "report_markdown": REPORT,
                "questions": [QUESTIONS[0]] * 2,
            },
        )
        not_tailored = await call_error(
            mcp, "get_resume_feedback", {"resume_id": master["resume_id"]}
        )
        await call(
            mcp,
            "set_resume_feedback",
            {"resume_id": rid, "report_markdown": REPORT, "questions": QUESTIONS},
        )
        # The user answers one question in the app.
        await isolated_db.update_resume(
            rid,
            {
                "resume_feedback": {
                    **(await isolated_db.get_resume(rid))["resume_feedback"],
                    "answers": {"q1": "Yes, ran our staging cluster."},
                }
            },
        )
        read = await call(mcp, "get_resume_feedback", {"resume_id": rid})

        current = (await call(mcp, "get_resume", {"resume_id": rid}))["resume_data"]
        renamed = copy.deepcopy(current)
        renamed["personalInfo"]["name"] = "Someone Else"
        rejected = await call(
            mcp, "apply_resume_feedback", {"resume_id": rid, "resume_data": renamed}
        )
        revised = copy.deepcopy(current)
        revised["summary"] = "Backend engineer who ran a staging Kubernetes cluster."
        applied = await call(
            mcp, "apply_resume_feedback", {"resume_id": rid, "resume_data": revised}
        )

    assert empty["feedback"] is None and empty["enabled"] is True
    assert "{job_description}" in empty["instructions"] and empty["apply_rules"]
    assert empty["report_headings"] == list(REQUIRED_REPORT_HEADINGS)
    assert "missing required heading" in bad
    assert "unique" in dup
    assert "only for tailored resumes" in not_tailored
    assert read["feedback"]["answers"] == {"q1": "Yes, ran our staging cluster."}
    assert read["unanswered_question_ids"] == ["q2"]
    assert rejected["saved"] is False and rejected["validation"]["violations"]
    assert applied["saved"] is True and "summary" in applied["changed_fields"]
    stored = await isolated_db.get_resume(rid)
    assert stored["processed_data"]["summary"] == revised["summary"]
    assert stored["resume_feedback"]["applied_at"]
    assert stored["resume_feedback"]["answers"] == {
        "q1": "Yes, ran our staging cluster."
    }


async def test_feedback_respects_the_settings_switch(
    isolated_db: Database,
    sample_resume: dict[str, Any],
    sample_job_description: str,
    sample_job_keywords: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    feedback_module = __import__(
        "app.mcp_server.tools._feedback", fromlist=["load_config"]
    )
    monkeypatch.setattr(
        feedback_module, "load_config", lambda: {"enable_resume_feedback": False}
    )
    async with connect() as mcp:
        master = await _master(mcp, sample_resume)
        job_id = await _job(mcp, sample_job_description, sample_job_keywords)
        rid = (await _tailored(mcp, master, job_id))["resume_id"]
        message = await call_error(
            mcp,
            "set_resume_feedback",
            {"resume_id": rid, "report_markdown": REPORT, "questions": QUESTIONS},
        )
    invalidate_config_cache()
    assert "turned off" in message
    assert (await isolated_db.get_resume(rid)).get("resume_feedback") is None
