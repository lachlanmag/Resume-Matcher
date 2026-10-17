"""Unit tests for PDF ATS extractability checks."""

from types import SimpleNamespace
from unittest.mock import patch

from app.pdf import evaluate_pdf_ats_extractability


class _FakePage:
    def __init__(self, text: str):
        self._text = text

    def extract_text(self) -> str:
        return self._text


def test_evaluate_pdf_ats_extractability_returns_error_when_text_empty() -> None:
    with patch("app.pdf.PdfReader") as mock_reader:
        mock_reader.return_value = SimpleNamespace(pages=[_FakePage(""), _FakePage("")])
        warnings, errors = evaluate_pdf_ats_extractability(b"%PDF-fake")

    assert warnings == []
    assert errors == [
        "Extracted text is empty. PDF may be image-based or inaccessible to ATS."
    ]


def test_evaluate_pdf_ats_extractability_returns_warning_for_risky_section_order() -> None:
    extracted = "\n".join(
        [
            "Jane Doe",
            "Education",
            "MIT",
            "Skills",
            "Python, FastAPI",
            "Experience",
            "Acme Corp",
        ]
    )
    with patch("app.pdf.PdfReader") as mock_reader:
        mock_reader.return_value = SimpleNamespace(pages=[_FakePage(extracted)])
        warnings, errors = evaluate_pdf_ats_extractability(b"%PDF-fake")

    assert errors == []
    assert "Education appears before Experience in extracted text." in warnings
    assert "Skills appears before Experience in extracted text." in warnings
