"""Work experience normalization (legacy flat row → job with roles).

Normalization contract is shared with the frontend (`lib/utils/work-experience.ts`).
Keep both in sync; golden cases live in `tests/fixtures/work_experience_normalization.json`.
"""

from __future__ import annotations

import copy
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


def preserve_work_experience_identity(
    original_entries: Any,
    tailored_entries: Any,
) -> list[dict[str, Any]]:
    """Restore employer identity from original; keep tailored descriptions.

    Used after LLM tailoring/refinement to undo flattened or split multi-role
    entries while preserving edited bullet text.
    """
    if not isinstance(original_entries, list):
        return normalize_work_experience_list(tailored_entries)

    tailored_list = tailored_entries if isinstance(tailored_entries, list) else []
    preserved: list[dict[str, Any]] = []

    for index, orig_entry in enumerate(original_entries):
        if not isinstance(orig_entry, dict):
            continue

        orig_normalized = normalize_experience_entry(orig_entry)
        tailored_entry = (
            tailored_list[index] if index < len(tailored_list) else None
        )
        if isinstance(tailored_entry, dict) and "description" in tailored_entry:
            desc = tailored_entry["description"]
            if isinstance(desc, list):
                tailored_description = copy.deepcopy(desc)
            elif desc is None:
                tailored_description = []
            else:
                tailored_description = [copy.deepcopy(desc)]
        else:
            # Missing tailored row or no description field — keep master/original pool.
            tailored_description = copy.deepcopy(
                orig_normalized.get("description", [])
            )

        preserved.append(
            {
                "id": orig_normalized.get("id", 0),
                "company": orig_normalized.get("company", ""),
                "location": orig_normalized.get("location"),
                "roles": copy.deepcopy(orig_normalized.get("roles", [])),
                "description": tailored_description,
            }
        )

    return preserved


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


def roles_identity_pairs(entry: dict[str, Any]) -> list[tuple[str, str]]:
    """Stable (title, years) pairs for identity comparison."""
    normalized = normalize_experience_entry(entry)
    pairs: list[tuple[str, str]] = []
    for role in normalized.get("roles", []):
        if isinstance(role, dict):
            pairs.append(
                (_coerce_str(role.get("title")), _coerce_str(role.get("years")))
            )
    return pairs


def compare_work_experience_identity(
    orig: dict[str, Any], res: dict[str, Any], index: int
) -> list[str]:
    """Return warnings when company or role title/years change."""
    warnings: list[str] = []

    orig_company = _coerce_str(orig.get("company"))
    res_company = _coerce_str(res.get("company"))
    if orig_company and orig_company != res_company:
        warnings.append(
            f"Identity field changed: workExperience[{index}].company "
            f"('{orig_company}' → '{res_company}')"
        )

    orig_roles = roles_identity_pairs(orig)
    res_roles = roles_identity_pairs(res)
    if len(orig_roles) != len(res_roles):
        warnings.append(
            f"Identity field changed: workExperience[{index}].roles "
            f"(count {len(orig_roles)} → {len(res_roles)})"
        )

    for role_idx, (orig_pair, res_pair) in enumerate(zip(orig_roles, res_roles)):
        for field_name, orig_val, res_val in (
            ("title", orig_pair[0], res_pair[0]),
            ("years", orig_pair[1], res_pair[1]),
        ):
            if orig_val and orig_val != res_val:
                warnings.append(
                    f"Identity field changed: workExperience[{index}].roles[{role_idx}].{field_name} "
                    f"('{orig_val}' → '{res_val}')"
                )

    return warnings
