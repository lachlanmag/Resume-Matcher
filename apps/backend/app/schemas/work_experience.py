"""Work experience normalization (legacy flat row → job with roles)."""

from __future__ import annotations

from typing import Any

_TEMPLATE_PLACEHOLDER_VALUES = frozenset(
    {
        "your position title",
        "your job title",
        "position title",
        "job title",
        "your company name",
        "company name",
        "your company",
        "dates employed",
        "date range",
        "your location",
        "location",
    }
)


def normalize_experience_entry(data: Any) -> dict[str, Any]:
    """Wrap legacy flat experience rows; never merge separate entries."""
    if not isinstance(data, dict):
        return {
            "id": 0,
            "company": "",
            "location": None,
            "roles": [{"id": 1, "title": "", "years": ""}],
            "description": [],
        }

    entry = dict(data)
    roles_raw = entry.get("roles")

    if isinstance(roles_raw, list) and len(roles_raw) > 0:
        roles = [_normalize_role(role, index) for index, role in enumerate(roles_raw)]
        legacy_title = _coerce_str(entry.get("title"))
        legacy_years = _coerce_str(entry.get("years"))
        if legacy_title and not any(role.get("title") for role in roles):
            roles[0] = {**roles[0], "title": legacy_title}
        if legacy_years and not any(role.get("years") for role in roles):
            roles[0] = {**roles[0], "years": legacy_years}
    else:
        title = _coerce_str(entry.get("title"))
        years = _coerce_str(entry.get("years"))
        roles = [{"id": 1, "title": title, "years": years}]

    normalized: dict[str, Any] = {
        "id": entry.get("id", 0),
        "company": _coerce_str(entry.get("company")),
        "location": entry.get("location"),
        "roles": roles,
        "description": entry.get("description", []),
    }
    if normalized["location"] == "":
        normalized["location"] = None
    return normalized


def normalize_work_experience_list(entries: Any) -> list[dict[str, Any]]:
    """Normalize each work experience entry; preserve array length (no merging)."""
    if not isinstance(entries, list):
        return []
    return [normalize_experience_entry(entry) for entry in entries]


def _normalize_role(role: Any, index: int) -> dict[str, Any]:
    if not isinstance(role, dict):
        return {"id": index + 1, "title": "", "years": ""}
    role_id = role.get("id", index + 1)
    return {
        "id": role_id if isinstance(role_id, int) else index + 1,
        "title": _coerce_str(role.get("title")),
        "years": _coerce_str(role.get("years")),
    }


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    if text.strip().casefold() in _TEMPLATE_PLACEHOLDER_VALUES:
        return ""
    return text


def experience_role_titles(entry: dict[str, Any]) -> str:
    """Joined role titles for labels; falls back to legacy top-level title."""
    roles = entry.get("roles")
    titles: list[str] = []
    if isinstance(roles, list):
        for role in roles:
            if isinstance(role, dict):
                title = _coerce_str(role.get("title"))
                if title:
                    titles.append(title)
    if not titles:
        legacy = _coerce_str(entry.get("title"))
        if legacy:
            titles.append(legacy)
    return "; ".join(titles)
