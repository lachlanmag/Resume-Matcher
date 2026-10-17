"""Cross-language normalization contract (shared JSON fixtures)."""

import json
from pathlib import Path

import pytest

from app.schemas.work_experience import normalize_experience_entry

_FIXTURE_PATH = (
    Path(__file__).resolve().parents[4]
    / "tests"
    / "fixtures"
    / "work_experience_normalization.json"
)


def _load_cases() -> list[dict]:
    with _FIXTURE_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


@pytest.mark.parametrize("case", _load_cases(), ids=lambda case: case["name"])
def test_normalization_matches_shared_fixture(case: dict) -> None:
    assert normalize_experience_entry(case["input"]) == case["expected"]
