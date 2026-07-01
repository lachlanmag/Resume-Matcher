"""Pydantic models for tailored resume feedback."""

from typing import Literal

from pydantic import BaseModel, Field

FeedbackCategory = Literal["gap", "risk", "clarification", "improvement", "ats"]


class FeedbackQuestion(BaseModel):
    question_id: str
    category: FeedbackCategory
    prompt: str
    context: str = ""


class ResumeFeedback(BaseModel):
    report_markdown: str
    questions: list[FeedbackQuestion] = Field(default_factory=list)
    answers: dict[str, str] = Field(default_factory=dict)
    generated_at: str
    applied_at: str | None = None


class FeedbackGenerateRequest(BaseModel):
    replace: bool = False


class FeedbackAnswersPatch(BaseModel):
    answers: dict[str, str]


class FeedbackApplyRequest(BaseModel):
    improved_data: dict  # ResumeData-shaped dict from accepted preview
