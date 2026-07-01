"""Unit tests for feedback service helpers."""

import pytest

from app.services.feedback import _format_answers_block, _validate_report_headings


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
