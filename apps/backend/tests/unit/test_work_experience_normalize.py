"""Tests for work experience legacy wrap (no auto-merge)."""

from app.schemas.models import Experience, ResumeData
from app.schemas.work_experience import (
    compare_work_experience_identity,
    experience_role_titles,
    normalize_experience_entry,
    normalize_work_experience_list,
    preserve_work_experience_identity,
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


def test_compare_identity_warns_on_role_title_change():
    orig = {
        "company": "Acme",
        "roles": [{"title": "Engineer", "years": "2020 - Present"}],
    }
    res = {
        "company": "Acme",
        "roles": [{"title": "VP of Engineering", "years": "2020 - Present"}],
    }
    warnings = compare_work_experience_identity(orig, res, 0)
    assert any("roles[0].title" in w for w in warnings)


def test_preserve_restores_multi_role_when_tailored_flattens():
    original = [
        {
            "id": 3,
            "company": "For The Record",
            "roles": [
                {"id": 1, "title": "Product Owner", "years": "Sep 2021 - Nov 2023"},
                {"id": 2, "title": "Senior Business Analyst", "years": "Jul 2019 - Sep 2021"},
            ],
            "description": ["Original bullet"],
        }
    ]
    tailored = [
        {
            "id": 3,
            "company": "For The Record",
            "title": "Product Owner",
            "years": "Sep 2021 - Nov 2023",
            "description": ["Tailored bullet"],
        }
    ]
    result = preserve_work_experience_identity(original, tailored)
    assert len(result) == 1
    assert len(result[0]["roles"]) == 2
    assert result[0]["roles"][0]["title"] == "Product Owner"
    assert result[0]["roles"][1]["title"] == "Senior Business Analyst"
    assert result[0]["description"] == ["Tailored bullet"]
    assert "title" not in result[0]
    assert "years" not in result[0]


def test_preserve_restores_single_entry_when_tailored_splits_company():
    original = [
        {
            "id": 1,
            "company": "Acme",
            "roles": [
                {"id": 1, "title": "Engineer I", "years": "2019 - 2021"},
                {"id": 2, "title": "Engineer II", "years": "2021 - Present"},
            ],
            "description": ["Shared bullets"],
        }
    ]
    tailored = [
        {
            "company": "Acme",
            "title": "Engineer I",
            "years": "2019 - 2021",
            "description": ["Tailored shared bullets"],
        },
        {
            "company": "Acme",
            "title": "Engineer II",
            "years": "2021 - Present",
            "description": ["Extra split entry"],
        },
    ]
    result = preserve_work_experience_identity(original, tailored)
    assert len(result) == 1
    assert len(result[0]["roles"]) == 2
    assert result[0]["description"] == ["Tailored shared bullets"]


def test_preserve_keeps_tailored_descriptions_per_index():
    original = [
        {
            "company": "Co A",
            "roles": [{"title": "PM", "years": "2023"}],
            "description": ["Old A"],
        },
        {
            "company": "Co B",
            "roles": [{"title": "BA", "years": "2020"}],
            "description": ["Old B"],
        },
    ]
    tailored = [
        {"company": "Co A", "title": "PM", "description": ["New A"]},
        {"company": "Co B", "title": "BA", "description": ["New B"]},
        {"company": "Co C", "title": "Extra", "description": ["Dropped"]},
    ]
    result = preserve_work_experience_identity(original, tailored)
    assert len(result) == 2
    assert result[0]["company"] == "Co A"
    assert result[0]["description"] == ["New A"]
    assert result[1]["company"] == "Co B"
    assert result[1]["description"] == ["New B"]


def test_compare_identity_ignores_role_order_when_pairs_match():
    orig = {
        "company": "Acme",
        "roles": [
            {"title": "Engineer I", "years": "2019 - 2021"},
            {"title": "Engineer II", "years": "2021 - Present"},
        ],
    }
    res = {
        "company": "Acme",
        "roles": [
            {"title": "Engineer I", "years": "2019 - 2021"},
            {"title": "Engineer II", "years": "2021 - Present"},
        ],
    }
    assert compare_work_experience_identity(orig, res, 0) == []
