"""Length planning and safety-net enforcement for tailored resumes."""

from __future__ import annotations

import copy
import json
import re
from typing import Any

from app.schemas.models import (
    DEFAULT_BULLETS_PER_JOB_MAX,
    DEFAULT_BULLETS_PER_JOB_MIN,
    DEFAULT_TARGET_PAGES,
    TailorLengthSettings,
)

# Conservative heuristics (approximate vs frontend PaginatedPreview).
DEFAULT_WORDS_PER_PAGE = 380
DEFAULT_WORDS_PER_BULLET = 28
OVERHEAD_WORDS_BASE = 120

_DENSITY_COMPACT = 0.85
_DENSITY_SPARSE = 1.12


def default_tailor_length_settings() -> TailorLengthSettings:
    return TailorLengthSettings()


def tailor_length_settings_from_config(stored: dict[str, Any]) -> TailorLengthSettings:
    """Build settings from config.json keys with defaults."""
    return TailorLengthSettings(
        target_pages=int(stored.get("tailor_target_pages", DEFAULT_TARGET_PAGES)),
        bullets_per_job_min=int(
            stored.get("tailor_bullets_per_job_min", DEFAULT_BULLETS_PER_JOB_MIN)
        ),
        bullets_per_job_max=int(
            stored.get("tailor_bullets_per_job_max", DEFAULT_BULLETS_PER_JOB_MAX)
        ),
    )


def tailor_length_settings_from_resume_doc(resume: dict[str, Any]) -> TailorLengthSettings | None:
    raw = resume.get("tailor_settings")
    if not isinstance(raw, dict):
        return None
    try:
        return TailorLengthSettings.model_validate(raw)
    except Exception:
        return None


def resolve_tailor_length_settings(
    *,
    request_settings: TailorLengthSettings | None,
    resume: dict[str, Any] | None,
    config: dict[str, Any] | None,
) -> TailorLengthSettings:
    if request_settings is not None:
        return request_settings
    if resume is not None:
        from_resume = tailor_length_settings_from_resume_doc(resume)
        if from_resume is not None:
            return from_resume
    if config is not None:
        return tailor_length_settings_from_config(config)
    return default_tailor_length_settings()


def _density_multiplier(template_settings: dict[str, Any] | None) -> float:
    if not template_settings:
        return 1.0
    multiplier = 1.0
    if template_settings.get("compactMode"):
        multiplier *= _DENSITY_COMPACT
    font_size = template_settings.get("fontSize") or {}
    if isinstance(font_size, dict):
        base = font_size.get("base", 3)
        if isinstance(base, (int, float)) and base > 3:
            multiplier *= _DENSITY_COMPACT
        elif isinstance(base, (int, float)) and base < 3:
            multiplier *= _DENSITY_SPARSE
    return multiplier


def estimate_words_per_page(template_settings: dict[str, Any] | None = None) -> int:
    wpp = DEFAULT_WORDS_PER_PAGE
    return max(200, int(wpp * _density_multiplier(template_settings)))


def estimate_overhead_words(resume_data: dict[str, Any]) -> int:
    total = OVERHEAD_WORDS_BASE
    summary = resume_data.get("summary", "")
    if isinstance(summary, str):
        total += len(summary.split())
    for key in ("education", "personalProjects"):
        for entry in resume_data.get(key, []) or []:
            if not isinstance(entry, dict):
                continue
            desc = entry.get("description")
            if isinstance(desc, list):
                total += sum(len(str(d).split()) for d in desc)
            elif isinstance(desc, str):
                total += len(desc.split())
    additional = resume_data.get("additional") or {}
    if isinstance(additional, dict):
        for field in ("technicalSkills", "languages", "certificationsTraining", "awards"):
            items = additional.get(field, [])
            if isinstance(items, list):
                total += sum(len(str(item).split()) for item in items)
    return total


def estimate_total_bullet_budget(
    resume_data: dict[str, Any],
    settings: TailorLengthSettings,
    template_settings: dict[str, Any] | None = None,
) -> int:
    """Max work-experience bullets that fit within the page target."""
    words_per_page = estimate_words_per_page(template_settings)
    total_words = settings.target_pages * words_per_page
    overhead = estimate_overhead_words(resume_data)
    remaining = max(0, total_words - overhead)
    return max(0, remaining // DEFAULT_WORDS_PER_BULLET)


def allocate_job_bullet_counts(
    job_count: int,
    bullets_min: int,
    bullets_max: int,
    total_bullet_budget: int | None = None,
) -> list[int]:
    """Allocate per-job bullet targets (index 0 = most recent)."""
    if job_count <= 0:
        return []

    if total_bullet_budget is None:
        return [bullets_max] * job_count

    budget = total_bullet_budget
    counts = [bullets_min] * job_count

    if budget >= job_count * bullets_max:
        return [bullets_max] * job_count

    if budget < job_count * bullets_min:
        counts = [bullets_min] * job_count
        excess = job_count * bullets_min - budget
        for idx in range(job_count - 1, -1, -1):
            while excess > 0 and counts[idx] > 0:
                counts[idx] -= 1
                excess -= 1
        return counts

    remaining = budget - job_count * bullets_min
    idx = 0
    while remaining > 0:
        progressed = False
        for i in range(job_count):
            if counts[i] < bullets_max:
                counts[i] += 1
                remaining -= 1
                progressed = True
                if remaining <= 0:
                    break
        if not progressed:
            break

    return counts


def _work_job_indices(work: list[Any]) -> list[int]:
    """Array indices of dict workExperience entries (index 0 = most recent)."""
    return [i for i, entry in enumerate(work) if isinstance(entry, dict)]


def work_experience_job_count(resume_data: dict[str, Any]) -> int:
    """Number of valid dict jobs in workExperience (excludes gaps / invalid slots)."""
    work = resume_data.get("workExperience") or []
    return len(_work_job_indices(work))


def plan_per_job_bullet_targets(
    resume_data: dict[str, Any],
    settings: TailorLengthSettings,
    template_settings: dict[str, Any] | None = None,
    *,
    budget_resume_data: dict[str, Any] | None = None,
) -> list[int]:
    """Per-job bullet targets in dict-job order (index 0 = most recent valid job).

    ``resume_data`` determines which workExperience slots are jobs (dict entries).
    ``budget_resume_data`` optionally supplies content used to estimate page budget
    (defaults to ``resume_data``).
    """
    job_count = work_experience_job_count(resume_data)
    if job_count == 0:
        return []
    budget_source = budget_resume_data if budget_resume_data is not None else resume_data
    budget = estimate_total_bullet_budget(budget_source, settings, template_settings)
    return allocate_job_bullet_counts(
        job_count,
        settings.bullets_per_job_min,
        settings.bullets_per_job_max,
        budget,
    )


def _job_label(entry: dict[str, Any], index: int) -> str:
    company = str(entry.get("company", "") or "").strip()
    roles = entry.get("roles")
    title = ""
    if isinstance(roles, list) and roles:
        first = roles[0]
        if isinstance(first, dict):
            title = str(first.get("title", "") or "").strip()
    if not title:
        title = str(entry.get("title", "") or "").strip()
    label = company or f"Job {index + 1}"
    if title:
        return f"{label} — {title}"
    return label


def build_length_constraints_block(
    master_data: dict[str, Any],
    settings: TailorLengthSettings,
    per_job_targets: list[int],
    template_settings: dict[str, Any] | None = None,
) -> str:
    """Human-readable length constraints for LLM prompts."""
    wpp = estimate_words_per_page(template_settings)
    approx_words = settings.target_pages * wpp
    lines = [
        "LENGTH CONSTRAINTS (must follow; page limit takes precedence over bullet counts):",
        f"- Target length: {settings.target_pages} page(s) (~{approx_words} words total).",
        f"- Bullets per job: {settings.bullets_per_job_min}–{settings.bullets_per_job_max} "
        "(allocated per role below).",
        "- The Original Resume is the MASTER: each workExperience[i].description is the full "
        "candidate pool for that role.",
        "- SELECT the best JD-aligned bullets from each pool; rephrase for fit. Do NOT keep "
        "bullets only because they appear first.",
        "- Use action \"replace_list\" on workExperience[i].description to set the full chosen list.",
        "- Do not invent facts, metrics, or responsibilities not supported by the master pool.",
        "",
        "Per-role targets (index 0 = most recent job):",
    ]
    work = master_data.get("workExperience") or []
    job_indices = _work_job_indices(work)
    for job_idx, array_i in enumerate(job_indices):
        entry = work[array_i]
        pool = entry.get("description") or []
        pool_size = len(pool) if isinstance(pool, list) else 0
        target = (
            per_job_targets[job_idx]
            if job_idx < len(per_job_targets)
            else settings.bullets_per_job_min
        )
        lines.append(
            f"  - workExperience[{array_i}] ({_job_label(entry, array_i)}): "
            f"target {target} bullets (pool has {pool_size})"
        )
    return "\n".join(lines)


def _normalize_bullet(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()).casefold()


def _master_pool_for_job(master_data: dict[str, Any], index: int) -> list[str]:
    work = master_data.get("workExperience") or []
    if index >= len(work) or not isinstance(work[index], dict):
        return []
    desc = work[index].get("description") or []
    if not isinstance(desc, list):
        return []
    return [str(d) for d in desc if str(d).strip()]


def _truncate_job_descriptions(
    data: dict[str, Any],
    targets: list[int],
    master_data: dict[str, Any],
) -> list[str]:
    warnings: list[str] = []
    work = data.get("workExperience") or []
    job_indices = _work_job_indices(work)
    for job_idx, array_i in enumerate(job_indices):
        entry = work[array_i]
        target = targets[job_idx] if job_idx < len(targets) else targets[-1] if targets else 0
        desc = entry.get("description")
        if not isinstance(desc, list):
            continue
        if len(desc) <= target:
            continue
        master_pool = {
            _normalize_bullet(b) for b in _master_pool_for_job(master_data, array_i)
        }
        # Prefer keeping tailored bullets not in master last when trimming
        def sort_key(idx: int) -> tuple[int, int]:
            bullet = str(desc[idx])
            in_master = _normalize_bullet(bullet) in master_pool
            return (0 if in_master else 1, idx)

        keep_indices = sorted(range(len(desc)), key=sort_key)[:target]
        keep_indices.sort()
        entry["description"] = [desc[j] for j in keep_indices]
        warnings.append(
            f"Safety net: trimmed workExperience[{array_i}] from {len(desc)} to {target} bullets"
        )
    return warnings


def enforce_tailor_length(
    data: dict[str, Any],
    master_data: dict[str, Any],
    settings: TailorLengthSettings,
    template_settings: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[str]]:
    """Safety-net enforcement after LLM tailoring. Returns (data, warnings)."""
    result = copy.deepcopy(data)
    warnings: list[str] = []

    work = result.get("workExperience") or []
    if work_experience_job_count(result) == 0:
        return result, warnings

    targets = plan_per_job_bullet_targets(result, settings, template_settings)
    warnings.extend(_truncate_job_descriptions(result, targets, master_data))

    # Re-check word budget; trim oldest array slots first (highest index = oldest job)
    wpp = estimate_words_per_page(template_settings)
    max_words = settings.target_pages * wpp
    word_count = _count_resume_words(result)
    if word_count > max_words:
        for i in range(len(work) - 1, -1, -1):
            if word_count <= max_words:
                break
            entry = work[i]
            if not isinstance(entry, dict):
                continue
            desc = entry.get("description")
            if isinstance(desc, list) and len(desc) > 0:
                desc.pop()
                word_count = _count_resume_words(result)
                warnings.append(
                    f"Safety net: removed oldest bullet from workExperience[{i}] for page limit"
                )

    return result, warnings


def _count_resume_words(data: dict[str, Any]) -> int:
    total = 0
    summary = data.get("summary", "")
    if isinstance(summary, str):
        total += len(summary.split())
    for key in ("workExperience", "personalProjects", "education"):
        for entry in data.get(key, []) or []:
            if not isinstance(entry, dict):
                continue
            desc = entry.get("description")
            if isinstance(desc, list):
                total += sum(len(str(d).split()) for d in desc)
            elif isinstance(desc, str):
                total += len(desc.split())
    return total


def serialize_original_list(original: list[str] | None) -> str | None:
    if original is None:
        return None
    return json.dumps(original, ensure_ascii=False)


def parse_original_list(original: str | list[str] | None) -> list[str] | None:
    if original is None:
        return None
    if isinstance(original, list):
        return original
    try:
        parsed = json.loads(original)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
    except (json.JSONDecodeError, TypeError):
        pass
    return None
