"""LLM prompt templates for applying tailored resume feedback."""

from app.prompts.templates import (
    CRITICAL_TRUTHFULNESS_RULES,
    DEFAULT_IMPROVE_PROMPT_ID,
)

APPLY_FEEDBACK_TRUTHFULNESS_RULES = CRITICAL_TRUTHFULNESS_RULES[
    DEFAULT_IMPROVE_PROMPT_ID
]

APPLY_FEEDBACK_PROMPT = """You are a professional resume writer updating a tailored resume based on candidate clarifications.

IMPORTANT: Write in {output_language}.

{truthfulness_rules}

Job Description:
{job_description}

Current Resume (JSON):
{resume_data}

Feedback report summary:
{report_markdown}

Candidate clarifications (Q&A):
{answers_block}

Apply ONLY factual improvements supported by the clarifications or existing resume content. Do not invent metrics, tools, or experience.

Return a JSON diff object with the same shape used for resume improvement diffs: a "changes" array of objects with path, action, original, value, and reason fields that modify workExperience descriptions, summary, skills, or other relevant sections. Use actions replace, append, reorder, add_skill, or replace_list. Each change MUST include the original text copied exactly for verification.

PATHS you can target:
- "summary"
- "workExperience[i].description[j]" or "workExperience[i].description" (append / replace_list)
- "personalProjects[i].description[j]" or "personalProjects[i].description"
- "education[i].description"
- "additional.technicalSkills", "additional.languages", "additional.certificationsTraining", "additional.awards"

Do NOT target: personalInfo, dates/years, company names, education degree/institution/years, customSections.

Output this exact JSON format, nothing else:
{{
  "changes": [
    {{
      "path": "workExperience[0].description[1]",
      "action": "replace",
      "original": "the exact original text at this path",
      "value": "the improved text",
      "reason": "why this change helps"
    }}
  ],
  "strategy_notes": "brief summary of edits applied from clarifications"
}}

Output JSON only."""
