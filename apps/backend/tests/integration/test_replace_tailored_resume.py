"""replace_resume_id: re-tailor an existing tailored resume in place, atomically."""

import json
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.database import Database, ReplaceTargetError
from app.models import Improvement
from app.routers import resumes
from app.schemas.models import ResumeData
from tests.integration.test_confirmation_transactions import (  # noqa: F401 - fixture
    confirmation_client,
    preview_payload,
)


async def _improvement_rows(database: Database) -> list[Improvement]:
    async with database._session() as session:
        return list((await session.execute(select(Improvement))).scalars())


async def _second_preview(
    client: AsyncClient, payload: dict[str, Any]
) -> dict[str, Any]:
    """A fresh preview for the same master + job (a re-tailor run)."""
    response = await client.post(
        "/api/v1/resumes/improve/preview",
        json={"resume_id": payload["resume_id"], "job_id": payload["job_id"]},
    )
    assert response.status_code == 200, response.text
    preview = response.json()["data"]
    return {
        **payload,
        "preview_id": preview["preview_id"],
        "improved_data": preview["resume_preview"],
        "improvements": preview["improvements"],
    }


async def test_confirm_with_replace_updates_the_tailored_resume_in_place(
    isolated_db: Database,
    confirmation_client: AsyncClient,
    sample_resume: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = await preview_payload(isolated_db, confirmation_client, sample_resume)
    first = await confirmation_client.post(
        "/api/v1/resumes/improve/confirm", json=payload
    )
    assert first.status_code == 200, first.text
    tailored_id = first.json()["data"]["resume_id"]
    formatting = {"template": "modern", "pageSize": "A4"}
    await isolated_db.update_resume(tailored_id, {"template_settings": formatting})

    async def retitle(*_args: Any, **_kwargs: Any) -> str:
        return "Engineer v2 @ Acme"

    monkeypatch.setattr(resumes, "generate_resume_title", retitle)
    second_payload = await _second_preview(confirmation_client, payload)
    second = await confirmation_client.post(
        "/api/v1/resumes/improve/confirm",
        json={**second_payload, "replace_resume_id": tailored_id},
    )

    assert second.status_code == 200, second.text
    assert second.json()["data"]["resume_id"] == tailored_id
    # Master + the one tailored resume; nothing inserted.
    assert len(await isolated_db.list_resumes()) == 2
    replaced = await isolated_db.get_resume(tailored_id)
    assert replaced["title"] == "Engineer v2 @ Acme"
    # The resume's own formatting survives a re-tailor.
    assert replaced["template_settings"] == formatting
    improvements = await _improvement_rows(isolated_db)
    assert [row.tailored_resume_id for row in improvements] == [tailored_id]
    # No second tracker card for the same tailored resume.
    assert len(await isolated_db.list_applications()) == 1


async def test_confirm_rejects_replace_target_from_another_master(
    isolated_db: Database,
    confirmation_client: AsyncClient,
    sample_resume: dict[str, Any],
) -> None:
    payload = await preview_payload(isolated_db, confirmation_client, sample_resume)
    data = ResumeData.model_validate(sample_resume).model_dump()
    stranger = await isolated_db.create_resume(
        content=json.dumps(data),
        content_type="json",
        is_master=False,
        parent_id="some-other-master",
        processed_data=data,
        processing_status="ready",
    )
    before = await isolated_db.get_resume(stranger["resume_id"])

    rejected = await confirmation_client.post(
        "/api/v1/resumes/improve/confirm",
        json={**payload, "replace_resume_id": stranger["resume_id"]},
    )

    assert rejected.status_code == 400
    assert await isolated_db.get_resume(stranger["resume_id"]) == before
    assert len(await isolated_db.list_resumes()) == 2
    assert await _improvement_rows(isolated_db) == []
    # The failed transaction released the claim: the same preview still confirms.
    retried = await confirmation_client.post(
        "/api/v1/resumes/improve/confirm", json=payload
    )
    assert retried.status_code == 200, retried.text


async def test_confirm_replace_target_not_found_is_404(
    isolated_db: Database,
    confirmation_client: AsyncClient,
    sample_resume: dict[str, Any],
) -> None:
    payload = await preview_payload(isolated_db, confirmation_client, sample_resume)
    response = await confirmation_client.post(
        "/api/v1/resumes/improve/confirm",
        json={**payload, "replace_resume_id": "missing"},
    )
    assert response.status_code == 404
    assert len(await isolated_db.list_resumes()) == 1


async def test_create_tailored_resume_replaces_in_place(
    isolated_db: Database, sample_resume: dict[str, Any]
) -> None:
    data = ResumeData.model_validate(sample_resume).model_dump()
    master = await isolated_db.create_resume_atomic_master(
        content=json.dumps(data), processed_data=data, processing_status="ready"
    )
    job = await isolated_db.create_job("Python engineer at Acme")
    fields = {
        "content": json.dumps(data),
        "content_type": "json",
        "filename": "tailored_resume",
        "is_master": False,
        "parent_id": master["resume_id"],
        "processed_data": data,
        "processing_status": "ready",
        "title": "v1",
        "template_settings": {"template": "modern"},
    }
    first = await isolated_db.create_tailored_resume(
        request_id="r1",
        original_resume_id=master["resume_id"],
        job_id=job["job_id"],
        resume_fields=fields,
        improvements=[],
    )

    replaced = await isolated_db.create_tailored_resume(
        request_id="r2",
        original_resume_id=master["resume_id"],
        job_id=job["job_id"],
        resume_fields={**fields, "title": "v2", "template_settings": None},
        improvements=[{"suggestion": "x", "lineNumber": None}],
        replace_resume_id=first["resume_id"],
    )

    assert replaced["resume_id"] == first["resume_id"]
    assert replaced["title"] == "v2"
    assert replaced["template_settings"] == {"template": "modern"}
    rows = await _improvement_rows(isolated_db)
    assert [(row.request_id, row.tailored_resume_id) for row in rows] == [
        ("r2", first["resume_id"])
    ]

    with pytest.raises(ReplaceTargetError) as excinfo:
        await isolated_db.create_tailored_resume(
            request_id="r3",
            original_resume_id=master["resume_id"],
            job_id=job["job_id"],
            resume_fields=fields,
            improvements=[],
            replace_resume_id=master["resume_id"],
        )
    assert not excinfo.value.not_found
    # The rejected write left nothing behind.
    assert [row.request_id for row in await _improvement_rows(isolated_db)] == ["r2"]
    assert len(await isolated_db.list_resumes()) == 2
