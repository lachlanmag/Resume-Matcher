# Tailored Resume Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand HR-style feedback for tailored resumes (markdown report vs job description), mirroring cover letter/outreach generation.

**Architecture:** Default prompt lives in `TAILORED_RESUME_FEEDBACK_PROMPT`. `generate_tailored_resume_feedback()` in `cover_letter.py` uses the same `_resolve_feature_prompt` + placeholder contract as cover letter. `POST /resumes/{id}/generate-feedback` returns markdown without persisting it. Builder gets a **Feedback** tab; Settings gets an optional prompt override.

**Tech Stack:** FastAPI, LiteLLM `complete()`, Next.js 16, React 19, existing Swiss UI primitives.

**Spec:** `docs/superpowers/specs/2026-06-26-tailored-resume-feedback-design.md`

---

## Phase A — Backend service and endpoint

### Task A1: Add `generate_tailored_resume_feedback`

**Files:**
- Modify: `apps/backend/app/services/cover_letter.py`
- Modify: `apps/backend/app/prompts/templates.py` (prompt already added on branch)

- [ ] Add `generate_tailored_resume_feedback()` using `TAILORED_RESUME_FEEDBACK_PROMPT`, `_resolve_feature_prompt("resume_feedback_prompt", ...)`, `max_tokens=8192`, system prompt for HR reviewer role.

### Task A2: Add `POST /resumes/{id}/generate-feedback`

**Files:**
- Modify: `apps/backend/app/routers/resumes.py`

- [ ] Mirror cover letter endpoint guards (tailored resume, improvement record, job, processed_data).
- [ ] Return `GenerateContentResponse` with markdown; do **not** persist to database.

---

## Phase B — Feature prompt config

### Task B1: Extend schemas and config router

**Files:**
- Modify: `apps/backend/app/schemas/models.py`
- Modify: `apps/backend/app/routers/config.py`

- [ ] Add `resume_feedback_prompt` + `resume_feedback_default` to GET/PUT `/config/feature-prompts`.
- [ ] Validate placeholders on non-empty PUT (422 with field `resume_feedback_prompt`).

### Task B2: Integration tests

**Files:**
- Modify: `apps/backend/tests/integration/test_config_api.py`

- [ ] Extend feature-prompts GET/PUT tests for feedback field.

---

## Phase C — Frontend

### Task C1: API client

**Files:**
- Modify: `apps/frontend/lib/api/resume.ts`
- Modify: `apps/frontend/lib/api/config.ts`

- [ ] `generateResumeFeedback(resumeId)` → POST generate-feedback.
- [ ] Extend `FeaturePrompts`, `FeaturePromptsUpdate`, validation error field union.

### Task C2: Builder Feedback tab

**Files:**
- Modify: `apps/frontend/components/builder/generate-prompt.tsx`
- Create: `apps/frontend/components/builder/feedback-preview.tsx`
- Modify: `apps/frontend/components/builder/resume-builder.tsx`

- [ ] Add `feedback` tab (tailored resumes only).
- [ ] Session-only state (no DB persistence); copy-to-clipboard action.
- [ ] Extend `GeneratePrompt` with `type: 'feedback'`.

### Task C3: Settings prompt override

**Files:**
- Modify: `apps/frontend/app/(default)/settings/page.tsx`

- [ ] Textarea + save/reset for `resume_feedback_prompt` (always available, no feature toggle).

### Task C4: i18n

**Files:**
- Modify: `apps/frontend/messages/en.json`, `es.json`, `zh.json`, `ja.json`, `pt-BR.json`

- [ ] Add matching keys for tab labels, generate prompt copy, alerts, settings labels, top-level `feedback` namespace.

---

## Phase D — Verification

- [ ] `uv run pytest apps/backend/tests/integration/test_config_api.py -q`
- [ ] `npm run build` in `apps/frontend` (i18n shape check)
