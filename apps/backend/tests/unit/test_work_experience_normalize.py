"""Tests for work experience legacy wrap (no auto-merge)."""

from app.schemas.models import Experience, ResumeData
from app.schemas.work_experience import (
    experience_role_titles,
    normalize_experience_entry,
    normalize_work_experience_list,
)


def test_legacy_flat_row_wraps_to_single_role():
    raw = {
        "id": 1,
        "title": "Product Manager",
        "company": "Felix",
        "years": "Nov 2023 - Nov 2025",
        "description": ["Owned roadmap"],
    }
    normalized = normalize_experience_entry(raw)
    assert normalized["company"] == "Felix"
    assert len(normalized["roles"]) == 1
    assert normalized["roles"][0]["title"] == "Product Manager"
    assert normalized["roles"][0]["years"] == "Nov 2023 - Nov 2025"
    assert normalized["description"] == ["Owned roadmap"]
    assert "title" not in normalized
    assert "years" not in normalized


def test_multi_role_shape_preserved():
    raw = {
        "id": 3,
        "company": "For The Record",
        "roles": [
            {"id": 1, "title": "Product Owner", "years": "Sep 2021 - Nov 2023"},
            {"id": 2, "title": "Senior Business Analyst", "years": "Jul 2019 - Sep 2021"},
        ],
        "description": ["Led product strategy"],
    }
    normalized = normalize_experience_entry(raw)
    assert len(normalized["roles"]) == 2
    assert normalized["description"] == ["Led product strategy"]


def test_same_company_rows_are_not_merged():
    entries = [
        {"id": 1, "company": "Felix", "title": "PM", "years": "2023", "description": ["a"]},
        {"id": 2, "company": "Felix", "title": "BA", "years": "2020", "description": ["b"]},
    ]
    normalized = normalize_work_experience_list(entries)
    assert len(normalized) == 2
    assert normalized[0]["roles"][0]["title"] == "PM"
    assert normalized[1]["roles"][0]["title"] == "BA"
    assert normalized[0]["description"] == ["a"]
    assert normalized[1]["description"] == ["b"]


def test_roles_with_empty_title_inherit_legacy_fields():
    raw = {
        "id": 1,
        "title": "Engineer",
        "company": "Co",
        "years": "2020",
        "roles": [{"id": 1, "title": "", "years": ""}],
        "description": [],
    }
    normalized = normalize_experience_entry(raw)
    assert normalized["roles"][0]["title"] == "Engineer"
    assert normalized["roles"][0]["years"] == "2020"


def test_template_placeholder_title_is_cleared():
    raw = {
        "id": 1,
        "title": "YOUR POSITION TITLE",
        "company": "Co",
        "years": "Jan 2020 - Present",
        "description": [],
    }
    normalized = normalize_experience_entry(raw)
    assert normalized["roles"][0]["title"] == ""


def test_experience_role_titles_joins_roles_and_falls_back_to_legacy():
    multi = {
        "roles": [
            {"title": "Engineer I"},
            {"title": "Engineer II"},
        ]
    }
    assert experience_role_titles(multi) == "Engineer I; Engineer II"

    legacy = {"title": "Engineer"}
    assert experience_role_titles(legacy) == "Engineer"


def test_resume_data_model_normalizes_work_experience():
    data = ResumeData.model_validate(
        {
            "personalInfo": {"name": "Test"},
            "workExperience": [
                {
                    "id": 1,
                    "title": "Engineer",
                    "company": "Co",
                    "years": "2020",
                    "description": [],
                }
            ],
        }
    )
    assert data.workExperience[0].roles[0].title == "Engineer"
    assert data.workExperience[0].company == "Co"
