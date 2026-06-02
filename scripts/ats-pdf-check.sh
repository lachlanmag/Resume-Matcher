#!/usr/bin/env bash
# ATS extraction quality check for resume PDFs.
# Usage: ./scripts/ats-pdf-check.sh /path/to/resume.pdf

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/resume.pdf"
  exit 1
fi

PDF_PATH="$1"

if [[ ! -f "$PDF_PATH" ]]; then
  echo "ERROR: File not found: $PDF_PATH"
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
EXTRACTED_TEXT="$WORK_DIR/extracted.txt"

extract_with_pdfminer() {
  python3 - "$PDF_PATH" "$EXTRACTED_TEXT" <<'PY'
import sys
from pathlib import Path

try:
    from pdfminer.high_level import extract_text
except Exception as exc:
    raise SystemExit(f"pdfminer is unavailable: {exc}")

pdf_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
text = extract_text(str(pdf_path)) or ""
out_path.write_text(text, encoding="utf-8")
PY
}

if command -v pdftotext >/dev/null 2>&1; then
  pdftotext -layout "$PDF_PATH" "$EXTRACTED_TEXT"
else
  echo "WARN: pdftotext not found, falling back to pdfminer extraction."
  extract_with_pdfminer
fi

if [[ ! -s "$EXTRACTED_TEXT" ]]; then
  echo "ERROR: Extracted text is empty. PDF is likely image-based or inaccessible to ATS."
  exit 1
fi

require_term() {
  local term="$1"
  if ! rg -qi --fixed-strings "$term" "$EXTRACTED_TEXT"; then
    echo "ERROR: Missing expected term: $term"
    exit 1
  fi
}

get_first_line() {
  local term="$1"
  rg -in --fixed-strings "$term" "$EXTRACTED_TEXT" | awk -F: 'NR==1 { print $1 }'
}

# Baseline sections most ATS parsers expect
require_term "experience"
require_term "education"
require_term "skills"

experience_line="$(get_first_line "experience")"
education_line="$(get_first_line "education")"
skills_line="$(get_first_line "skills")"

if [[ -z "$experience_line" || -z "$education_line" || -z "$skills_line" ]]; then
  echo "ERROR: Could not determine section order."
  exit 1
fi

if (( experience_line > education_line )); then
  echo "WARN: Education appears before Experience in extracted text."
fi
if (( skills_line < experience_line )); then
  echo "WARN: Skills appears before Experience in extracted text."
fi

echo "PASS: ATS extraction check completed."
echo "Info: extracted text size $(wc -c < "$EXTRACTED_TEXT") bytes"
