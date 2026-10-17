"""Unit tests for tailor length planning and enforcement."""

import copy

import pytest

from app.schemas.models import TailorLengthSettings
from app.services.tailor_length import (
    allocate_job_bullet_counts,
    build_length_constraints_block,
    enforce_tailor_length,
    estimate_total_bullet_budget,
    plan_per_job_bullet_targets,
    resolve_tailor_length_settings,
    tailor_length_settings_from_config,
    work_experience_job_count,
)


class TestAllocateJobBulletCounts:
    def test_all_max_when_budget_allows(self):
        assert allocate_job_bullet_counts(3, 3, 5, 20) == [5, 5, 5]

    def test_min_then_recent_get_extra(self):
        # 3 jobs, min 3, max 5, budget 10 -> 3+3+4 = 10 (recent first for extras)
        assert allocate_job_bullet_counts(3, 3, 5, 10) == [4, 3, 3]

    def test_budget_below_min_peels_oldest(self):
        # 3 jobs, min 3, budget 5 -> peel from oldest (index 2) first; recent job keeps more
        assert allocate_job_bullet_counts(3, 3, 5, 5) == [3, 2, 0]

    def test_empty_jobs(self):
        assert allocate_job_bullet_counts(0, 3, 5, 10) == []


class TestResolveSettings:
    def test_request_overrides_config(self):
        req = TailorLengthSettings(target_pages=1, bullets_per_job_min=2, bullets_per_job_max=4)
        resolved = resolve_tailor_length_settings(
            request_settings=req,
            resume=None,
            config={"tailor_target_pages": 3},
        )
        assert resolved.target_pages == 1

    def test_config_defaults(self):
        settings = tailor_length_settings_from_config({})
        assert settings.target_pages == 2
        assert settings.bullets_per_job_min == 3
        assert settings.bullets_per_job_max == 5


class TestPlanPerJobBulletTargets:
    def test_job_count_ignores_non_dict_slots(self):
        data = {
            "workExperience": [
                {"company": "Recent", "description": ["a"]},
                "invalid",
                {"company": "Older", "description": ["b"]},
            ]
        }
        assert work_experience_job_count(data) == 2
        assert len(plan_per_job_bullet_targets(data, TailorLengthSettings())) == 2

    def test_constraints_map_targets_to_dict_jobs_not_array_index(self):
        data = {
            "workExperience": [
                {"company": "Recent", "description": ["a"]},
                "invalid",
                {"company": "Older", "description": ["b1", "b2", "b3"]},
            ]
        }
        settings = TailorLengthSettings()
        targets = [2, 4]
        block = build_length_constraints_block(data, settings, targets)
        assert "workExperience[0]" in block and "target 2 bullets" in block
        assert "workExperience[2]" in block and "target 4 bullets" in block
        assert "workExperience[1]" not in block


class TestBuildLengthConstraintsBlock:
    def test_includes_per_job_targets(self):
        master = {
            "workExperience": [
                {"company": "Acme", "description": ["a", "b", "c", "d"]},
                {"company": "Beta", "description": ["e", "f"]},
            ]
        }
        settings = TailorLengthSettings()
        targets = [4, 3]
        block = build_length_constraints_block(master, settings, targets)
        assert "workExperience[0]" in block
        assert "target 4 bullets" in block
        assert "pool has 4" in block
        assert "replace_list" in block


class TestEnforceTailorLength:
    def test_page_limit_trims_oldest_job_with_gap_in_work_array(self):
        """Non-dict slots in workExperience must not block trimming higher indices."""
        master = {
            "workExperience": [
                {"company": "Recent", "description": ["r1", "r2", "r3"]},
                "invalid-slot",
                {"company": "Oldest", "description": ["o1", "o2", "o3"]},
            ]
        }
        tailored = copy.deepcopy(master)
        # Inflate word count so page safety net runs (very low page target)
        tailored["summary"] = " ".join(["word"] * 400)
        settings = TailorLengthSettings(
            target_pages=1, bullets_per_job_min=1, bullets_per_job_max=3
        )
        result, warnings = enforce_tailor_length(tailored, master, settings)
        oldest = result["workExperience"][2]["description"]
        assert len(oldest) < 3
        assert any("workExperience[2]" in w for w in warnings)

    def test_trims_excess_bullets(self):
        master = {
            "workExperience": [
                {"company": "A", "description": ["m1", "m2", "m3", "m4", "m5", "m6"]},
            ]
        }
        tailored = copy.deepcopy(master)
        tailored["workExperience"][0]["description"] = [
            "m1", "m2", "m3", "m4", "m5", "m6"
        ]
        settings = TailorLengthSettings(target_pages=1, bullets_per_job_min=2, bullets_per_job_max=3)
        result, warnings = enforce_tailor_length(tailored, master, settings)
        assert len(result["workExperience"][0]["description"]) <= 3
        assert warnings


class TestEstimateBulletBudget:
    def test_positive_budget(self):
        data = {"summary": "Short summary.", "workExperience": [{"description": ["a"]}]}
        settings = TailorLengthSettings(target_pages=2)
        budget = estimate_total_bullet_budget(data, settings)
        assert budget > 0
