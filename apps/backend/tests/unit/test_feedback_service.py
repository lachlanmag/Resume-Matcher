"""Unit tests for feedback service helpers."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.feedback import (
    _format_answers_block,
    _validate_report_headings,
    build_apply_preview,
    generate_structured_feedback,
)

VALID_REPORT_MARKDOWN = """
## Candidate summary
Strong backend fit.

## Strengths
- Python experience

## Concerns or gaps
- Limited cloud exposure

## Tailoring quality
Well targeted.

## Role fit score
8/10

## ATS assessment
Good keyword coverage.

## ATS optimization recommendations
Add more metrics.

## Hiring recommendation
Proceed to interview.

## Interview focus areas
System design.

## Resume improvement suggestions
Quantify impact.

## Gaps and questions for the candidate
See structured questions.
"""


class TestValidateReportHeadings:
    def test_accepts_all_required_headings(self) -> None:
        report = """
## Candidate summary
## Strengths
## Concerns or gaps
## Tailoring quality
## Role fit score
## ATS assessment
## ATS optimization recommendations
## Hiring recommendation
## Interview focus areas
## Resume improvement suggestions
## Gaps and questions for the candidate
"""
        _validate_report_headings(report)

    def test_raises_when_required_heading_is_missing(self) -> None:
        report = """
## Candidate summary
## Strengths
## Tailoring quality
"""
        with pytest.raises(ValueError, match="Concerns or gaps"):
            _validate_report_headings(report)


class TestFormatAnswersBlock:
    def test_includes_question_prompts_and_answers(self) -> None:
        questions = [
            {"question_id": "q1", "prompt": "What was the scope?"},
            {"question_id": "q2", "prompt": "Which tools did you use?"},
        ]
        answers = {"q1": "Led a migration for 3 teams."}

        result = _format_answers_block(questions, answers)

        assert "Q1 [q1]: What was the scope?" in result
        assert "A1: Led a migration for 3 teams." in result
        assert "Q2 [q2]: Which tools did you use?" in result
        assert "A2: (No answer provided)" in result

    def test_handles_empty_questions(self) -> None:
        assert (
            _format_answers_block([], {}) == "No clarification questions were provided."
        )


class TestGenerateStructuredFeedback:
    @patch("app.services.feedback.complete_json", new_callable=AsyncMock)
    async def test_rejects_invalid_questions(self, mock_complete_json) -> None:
        mock_complete_json.return_value = {
            "report_markdown": VALID_REPORT_MARKDOWN,
            "questions": [
                {
                    "question_id": "q1",
                    "category": "not-a-valid-category",
                    "prompt": "What tools did you use?",
                }
            ],
        }

        with pytest.raises(ValueError, match="malformed 'questions'"):
            await generate_structured_feedback(
                resume_data={"summary": "Backend engineer"},
                job_description="Python role",
            )

    @patch("app.services.feedback.complete_json", new_callable=AsyncMock)
    async def test_accepts_valid_questions(self, mock_complete_json) -> None:
        mock_complete_json.return_value = {
            "report_markdown": VALID_REPORT_MARKDOWN,
            "questions": [
                {
                    "question_id": "q1",
                    "category": "gap",
                    "prompt": "What was the scope?",
                    "context": "",
                }
            ],
        }

        result = await generate_structured_feedback(
            resume_data={"summary": "Backend engineer"},
            job_description="Python role",
        )

        assert result["questions"][0]["question_id"] == "q1"
        assert result["answers"] == {}
        assert result["applied_at"] is None


class TestBuildApplyPreview:
    @patch("app.services.feedback.complete_json", new_callable=AsyncMock)
    async def test_preserves_multi_role_work_experience_from_master(
        self, mock_complete_json
    ) -> None:
        master_data = {
            "workExperience": [
                {
                    "id": 1,
                    "company": "Example Industries",
                    "roles": [
                        {"id": 1, "title": "Product Owner", "years": "2021-2023"},
                        {"id": 2, "title": "Senior Business Analyst", "years": "2019-2021"},
                    ],
                    "description": ["Led product strategy"],
                }
            ]
        }
        tailored_data = {
            "workExperience": [
                {
                    "id": 1,
                    "company": "Example Industries",
                    "title": "Product Owner",
                    "years": "2021-2023",
                    "description": ["Led product strategy"],
                }
            ]
        }
        mock_complete_json.return_value = {
            "changes": [
                {
                    "path": "workExperience[0].description",
                    "action": "replace_list",
                    "original": ["Led product strategy"],
                    "value": ["Led product strategy across platform modules"],
                    "reason": "Clarified scope per candidate answer",
                }
            ],
            "strategy_notes": "Description only.",
        }

        result = await build_apply_preview(
            resume_data=tailored_data,
            original_resume_data=master_data,
            job_description="Product Owner role",
            report_markdown=VALID_REPORT_MARKDOWN,
            questions=[],
            answers={},
        )

        roles = result["improved_data"]["workExperience"][0]["roles"]
        assert len(roles) == 2
        assert roles[0]["title"] == "Product Owner"
        assert roles[1]["title"] == "Senior Business Analyst"
        assert result["improved_data"]["workExperience"][0]["description"] == [
            "Led product strategy across platform modules"
        ]
