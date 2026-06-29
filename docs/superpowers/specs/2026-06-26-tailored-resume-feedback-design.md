# Tailored resume feedback

**Date:** 2026-06-26
**Branch:** `feature/tailored-resume-feedback`
**Status:** Approved — see implementation plan
**Plan:** `docs/superpowers/plans/2026-06-26-tailored-resume-feedback.md`

## Problem

After AI tailoring, users often review the result manually before applying. There is no in-app feedback step that evaluates a **tailored resume against its job description** the way a hiring manager or ATS would.

Cover letter and outreach already have on-demand generation for tailored resumes. Feedback is the missing companion feature.

## Prior art (manual workflow)

A common external workflow looks like this:

1. Run an HR-style resume review prompt against the tailored resume and target job description
2. Receive structured markdown feedback: strengths, gaps, ATS analysis, hiring recommendation, interview questions, improvement suggestions
3. User supplies corrections or clarifications where the resume is ambiguous
4. Re-run the review or apply edits manually

That flow works best when **gaps and questions for the candidate** are a first-class section, so the user can resolve ambiguity before editing.

## Goals

- On-demand feedback for tailored resumes (has `parent_id` + linked job), similar to cover letter generation
- Default prompt in `TAILORED_RESUME_FEEDBACK_PROMPT` (`apps/backend/app/prompts/templates.py`)
- Optional user override via feature prompts config (same placeholder contract as cover letter)
- Builder UI tab on tailored resumes only
- Plain markdown output (human-readable report, not JSON diffs)

## Non-goals

- Persisting feedback reports to the database
- Auto-applying suggested edits to the resume
- Replacing the improve/tailor pipeline
- Auto-generating feedback during the tailor flow (on-demand only)

## Draft prompt

**Constant:** `TAILORED_RESUME_FEEDBACK_PROMPT` in `apps/backend/app/prompts/templates.py`

**Required placeholders** (for future feature-prompt validation):

| Placeholder | Source |
|---|---|
| `{job_description}` | Linked job record |
| `{resume_data}` | Tailored resume JSON |
| `{output_language}` | Content language setting |

**Adaptations from a generic HR + ATS review prompt:**

| Generic review prompt | Tailored feedback prompt |
|---|---|
| Role baseline when no JD is provided | JD-specific role fit throughout |
| ATS keyword baseline without a JD | N/A (tailored resumes always have a JD) |
| Resume improvement suggestions | Same, plus **Tailoring quality** section |
| (often implicit) | **Gaps and questions for the candidate** section |

**Tailoring quality** flags common post-tailor issues: JD-flavoured language without evidence, keywords listed in skills but not demonstrated in experience, and missing high-priority JD terms that the resume should address with real accomplishments.

## Proposed API

```
POST /api/v1/resumes/{id}/generate-feedback
  → { content: string }   # markdown, not persisted
```

Implemented as `POST /resumes/{id}/generate-feedback` (same response shape as cover letter generation).

```
GET/PUT /api/v1/config/feature-prompts
  → add resume_feedback_prompt + resume_feedback_default
```

## Proposed UI

- Builder tab on tailored resumes: **Feedback** (alongside Cover Letter, Outreach, JD Match)
- `GeneratePrompt`-style empty state when no feedback generated yet
- Render markdown report in a scroll panel; copy action
- Settings: extend Feature Prompts section with feedback override + reset to default

## Test plan (when implemented)

- [ ] Rejects feedback request for master resume (400)
- [ ] Rejects when no job context on tailored resume (400)
- [ ] Returns markdown using default prompt
- [ ] Custom prompt override validated for required placeholders (422)
- [ ] Empty override falls back to default
