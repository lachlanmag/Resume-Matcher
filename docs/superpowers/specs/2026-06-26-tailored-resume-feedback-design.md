# Tailored Resume Feedback — Design Spec

**Date:** 2026-06-30 (revised; original 2026-06-26)
**Branch:** `feature/tailored-resume-feedback`
**Status:** Approved (2026-06-30)
**Plan:** `docs/superpowers/plans/2026-06-26-tailored-resume-feedback.md`

## Problem

After AI tailoring, users review the result manually with no structured in-app step that evaluates the **tailored resume against its job description** the way a hiring manager or ATS would, then helps them act on gaps.

Cover letter and outreach are auto-generated during tailor confirm. Feedback is the missing companion: it should arrive automatically after tailoring, guide the user through clarifications, and feed a dedicated apply step that updates the resume.

## Prior art (manual workflow)

1. Run an HR-style resume review prompt against the tailored resume and target job description
2. Receive structured feedback: strengths, gaps, ATS analysis, hiring recommendation, improvement suggestions
3. User supplies corrections or clarifications where the resume is ambiguous
4. Apply edits manually or re-run the review

The in-app flow should make **gaps and questions for the candidate** a first-class, interactive step rather than a static markdown section the user copies elsewhere.

## Locked decisions

1. **Structured JSON generation (approach 1).** One `complete_json` call returns both the human-readable report and structured questions. The user-facing report keeps the same markdown section headings as today; only the transport layer is structured.
2. **Background generation after redirect.** Feedback is not generated during `improve/confirm`. After tailor confirm, the user is redirected to the builder **Resume** tab; generation starts in the background on builder mount.
3. **Modal wizard UX.** Mirror the master-resume **Enhance Resume** flow (`EnrichmentModal`): summary first (read-only), then one question at a time, then a **review** step showing all Q&A, then apply with preview/confirm.
4. **Entry point.** A **Feedback** button on the builder Resume tab, next to **AI Regenerate** (tailored resumes only). Remove the current builder **Feedback** preview tab.
5. **Persistence.** The most recent feedback report, questions, and saved answers are stored on the resume record. Returning users see persisted feedback without regenerating.
6. **Manual regenerate.** User can regenerate feedback from the modal (with confirm dialog). Regeneration replaces the report and questions and clears saved answers.
7. **Review before apply.** After the user works through questions, a review step shows every prompt and answer. The user can edit any answer (returns to that question step); submitting from an edit returns to review, not forward through remaining questions.
8. **Apply feedback.** After review, answers are fed into a dedicated apply step that previews and applies resume changes (user must accept the preview).

## Goals

- Auto-generate structured feedback in the background when the user first lands on a newly tailored resume in the builder
- Persist the latest feedback report, questions, and answers on the tailored resume record
- Modal wizard: read-only summary → one-at-a-time questions → review all answers → apply preview → apply confirm
- **Feedback** button next to **AI Regenerate** on tailored resumes in the builder
- Consistent, pre-defined report format on every generation and regeneration
- Optional user prompt override via feature prompts config (same placeholder contract as cover letter)
- Manual feedback regeneration from the modal

## Non-goals

- Auto-applying feedback without user preview and confirm
- Replacing the improve/tailor pipeline
- Feedback for master resumes
- Blocking tailor confirm on feedback generation latency

## UX / Layout

### Tailor redirect

After `improve/confirm`, redirect to `/builder?id={tailoredResumeId}` (Resume tab active) instead of `/resumes/{id}`. This matches the user's expectation of landing on the resume editor immediately.

### Builder entry

On the builder **Resume** tab for tailored resumes only:

- Add **Feedback** button beside **AI Regenerate**
- Remove the **Feedback** tab from the preview tab bar (Cover Letter, Outreach, JD Match remain)

**Feedback button states:**

| State | Appearance |
|-------|------------|
| No feedback yet, generation in flight | Spinner / disabled; label unchanged |
| Feedback ready | Normal; opens modal at summary step |
| Generation failed | Normal; opens modal at error step with retry |

On builder mount for a tailored resume without `resume_feedback`, fire `POST /resumes/{id}/feedback/generate` in the background (do not block the editor).

### Feedback modal

New `FeedbackModal` component, structurally aligned with `EnrichmentModal` and `use-enrichment-wizard.ts`:

| Step | UX | Notes |
|------|-----|-------|
| `generating` | Loading spinner + message | Shown when no persisted feedback and background gen not finished |
| `summary` | Scrollable read-only report | Full `report_markdown`; no inputs. **Continue** advances to questions |
| `questions` | One question at a time | Reuse enrichment question card pattern: progress bar, category kicker, textarea, Skip, Back, Continue (`⌘/Ctrl+Enter`). On last question in linear flow, **Continue** advances to **review** (not apply) |
| `review` | All prompts + answers | Scrollable list of every question with the user's answer (or "Skipped" for empty). **Edit** per row returns to that question. **Apply feedback** (primary) starts apply-preview. **Back** returns to last question in linear flow |
| `generating` | "Applying your feedback…" | LLM builds resume diff from answers |
| `preview` | Diff preview | Reuse `RegenerateDiffPreview` pattern; user accepts or rejects |
| `applying` | Saving spinner | PATCH resume with accepted changes |
| `complete` | Success + Done | Reload resume data in builder |
| `error` | Error message + Retry + Close | Retry re-runs the failed operation |

**Edit-from-review behavior:** When the user taps **Edit** on a row in `review`, the wizard enters `questions` at that question's index with `returnToReview: true`. The question step shows **Save & return to review** as the primary action (instead of Continue/Finish). Submitting saves the answer (PATCH) and returns to `review`. **Back** from an edit-from-review question also returns to `review` (does not walk backward through other questions). Linear question flow (`returnToReview: false`) is unchanged: Back/Continue walk the sequence; finishing the last question goes to `review`.

**Regenerate feedback** (modal header or footer action): confirm dialog warns that answers will be cleared. Calls `POST /resumes/{id}/feedback/generate` with `replace: true`, resets wizard to `summary`.

**Re-opening the modal:** If persisted feedback exists, open at `summary`. If the user had partial answers and chooses to continue from summary, restore linear `questions` flow from the first unanswered question. If all questions have answers (including skipped/empty), **Continue** from summary can go directly to `review`.

**Zero questions edge case:** If `questions` is empty after generation, `summary` shows a **Done** action (no apply step) since there is nothing to clarify.

### Settings

Keep the existing Feature Prompts textarea for `resume_feedback_prompt` override + reset to default. No feature toggle required.

## Flow & State Machine

`step`: `idle → generating → summary → questions → review → generating → preview → applying → complete`

```
Tailor confirm
  → redirect /builder?id={tailoredId}  (Resume tab)
  → background POST feedback/generate
  → user edits resume OR clicks Feedback
  → summary (read report)
  → questions (one at a time; answers PATCH on each advance)
  → review (all Q&A; edit any answer → question step → back to review)
  → apply-preview (LLM diff)
  → preview (user accept/reject)
  → apply (persist resume)
  → complete
```

### Wizard state (frontend)

| Field | Type | Notes |
|-------|------|-------|
| `step` | see flow above | |
| `currentQuestionIndex` | `number` | Active question when `step === 'questions'` |
| `returnToReview` | `boolean` | `true` when editing from review; primary action returns to `review` |
| `answers` | `Record<question_id, string>` | Local mirror of persisted answers |

Answers auto-save via `PATCH /resumes/{id}/feedback/answers` on each question advance (linear flow) and on **Save & return to review** (edit flow) so partial progress survives closing the modal.

## Data model

### Resume record field: `resume_feedback`

JSON object stored on the tailored resume row (new DB column / TinyDB field):

```json
{
  "report_markdown": "## Candidate summary\n...",
  "questions": [
    {
      "question_id": "q1",
      "category": "gap",
      "prompt": "You list Kubernetes in skills but no experience bullets mention it. What projects used it?",
      "context": "Skills section vs work experience"
    }
  ],
  "answers": {
    "q1": "Led migration of three services to EKS in 2023."
  },
  "generated_at": "2026-06-30T12:00:00Z",
  "applied_at": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `report_markdown` | `string` | Markdown report using the fixed section headings below |
| `questions` | `FeedbackQuestion[]` | 3–8 structured prompts for the wizard |
| `answers` | `Record<question_id, string>` | Persisted as user progresses; cleared on regenerate |
| `generated_at` | ISO-8601 string | Set on each generation/regeneration |
| `applied_at` | ISO-8601 string \| null | Set when apply step succeeds |

`FeedbackQuestion`:

| Field | Type | Notes |
|-------|------|-------|
| `question_id` | `string` | Stable within a generation (e.g. `q1`, `q2`) |
| `category` | `"gap" \| "risk" \| "clarification" \| "improvement" \| "ats"` | Mono kicker in question step |
| `prompt` | `string` | The question text shown to the user |
| `context` | `string` | Optional short context (section reference, concern source) |

`fetchResume` (and resume list if needed) returns `resume_feedback` for tailored resumes.

## Report format (fixed markdown headings)

`report_markdown` must use these headings exactly on every generation, matching `TAILORED_RESUME_FEEDBACK_PROMPT`:

1. `## Candidate summary`
2. `## Strengths`
3. `## Concerns or gaps`
4. `## Tailoring quality`
5. `## Role fit score`
6. `## ATS assessment`
7. `## ATS optimization recommendations`
8. `## Hiring recommendation`
9. `## Interview focus areas`
10. `## Resume improvement suggestions`
11. `## Gaps and questions for the candidate`

The wizard **summary** step renders the full report. The structured `questions` array is derived from gaps, risks, unsupported claims, ATS blockers, and improvement areas across the report (not only the last section). The `## Gaps and questions for the candidate` section remains in the report for readability; the wizard uses the structured `questions` array for stepping.

## Prompt strategy

### `TAILORED_RESUME_FEEDBACK_PROMPT` (evolve existing)

**Location:** `apps/backend/app/prompts/templates.py`

**Required placeholders** (feature-prompt validation):

| Placeholder | Source |
|---|---|
| `{job_description}` | Linked job record |
| `{resume_data}` | Tailored resume JSON |
| `{output_language}` | Content language setting |

**Output:** JSON via `complete_json` with schema type `feedback` (new):

```json
{
  "report_markdown": "<full markdown report with exact headings listed above>",
  "questions": [
    {
      "question_id": "q1",
      "category": "gap",
      "prompt": "...",
      "context": "..."
    }
  ]
}
```

Prompt instructions:

- `report_markdown` follows the existing section content guidelines (evidence-based, no em dashes, JD-specific fit, tailoring quality, ATS analysis, etc.)
- `questions`: 3–8 items prioritizing the highest-impact gaps, risks, and unsupported claims
- Each question must be answerable by the candidate with factual clarifications (not yes/no trivia)
- Custom prompt override: same placeholder contract; if override fails `.format()` or returns invalid JSON, fall back to default with server warning (same pattern as cover letter)

### `APPLY_FEEDBACK_PROMPT` (new)

**Location:** `apps/backend/app/prompts/templates.py` (or `app/prompts/feedback.py`)

**Inputs:** `{job_description}`, `{resume_data}`, `{report_markdown}`, `{answers_block}`, `{output_language}`

`{answers_block}` is formatted Q&A pairs from saved answers.

**Output:** Structured diff compatible with existing apply/diff patterns (reuse improve diff or regenerate item diff shape). Must obey `CRITICAL_TRUTHFULNESS_RULES`: only incorporate facts stated in answers or already in the resume; never invent metrics.

## API

All endpoints under `/api/v1/resumes/{id}/...`. Guards match current generate-feedback: tailored resume (`parent_id`), improvement record with job, `processed_data` present.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/resumes/{id}/feedback/generate` | Generate structured feedback, persist to `resume_feedback`, return payload. Body optional: `{ "replace": true }` for manual regenerate |
| `PATCH` | `/resumes/{id}/feedback/answers` | Merge answers: `{ "answers": { "q1": "..." } }` |
| `POST` | `/resumes/{id}/feedback/apply-preview` | Given persisted feedback + answers, return diff preview |
| `POST` | `/resumes/{id}/feedback/apply` | Apply accepted preview to `processed_data`; set `applied_at` |

**Deprecate / replace:** `POST /resumes/{id}/generate-feedback` (ephemeral markdown) is replaced by `POST /resumes/{id}/feedback/generate` (structured + persisted). Remove the old endpoint and frontend caller.

**Config (unchanged):**

```
GET/PUT /api/v1/config/feature-prompts
  → resume_feedback_prompt + resume_feedback_default
```

## Backend modules

| Area | Files |
|------|-------|
| Prompts | `app/prompts/templates.py` (evolve feedback prompt), new `APPLY_FEEDBACK_PROMPT` |
| Schemas | `app/schemas/feedback.py` (new): `ResumeFeedback`, `FeedbackQuestion`, request/response models |
| Service | `app/services/feedback.py` (new): generate, apply-preview, apply; or extend `cover_letter.py` if preferred for cohesion |
| Router | `app/routers/resumes.py` (new feedback routes) or `app/routers/feedback.py` |
| Database | `app/database.py`: read/write `resume_feedback` on resume row |

## Frontend modules

| Area | Files |
|------|-------|
| API client | `lib/api/feedback.ts` (new) or extend `lib/api/resume.ts` |
| Wizard hook | `hooks/use-feedback-wizard.ts` (new; mirror `use-enrichment-wizard.ts`) |
| Modal + steps | `components/feedback/feedback-modal.tsx`, `summary-step.tsx`, `review-step.tsx`, reuse/adapt `enrichment/question-step.tsx` (support `returnToReview` edit mode) |
| Builder integration | `components/builder/resume-builder.tsx`: Feedback button, background gen on mount, remove Feedback tab |
| Tailor redirect | `app/(default)/tailor/page.tsx`: redirect to `/builder?id=…` |
| Apply preview | Reuse `components/builder/regenerate-diff-preview.tsx` or extract shared diff preview |
| i18n | `messages/en.json` + es/zh/ja/pt-BR mirrors |

## Error handling

| Scenario | Behavior |
|----------|----------|
| Background gen fails on mount | Log server-side; Feedback button opens modal at `error` with retry |
| User opens modal while gen in flight | Show `generating` step; poll or await in-flight request |
| Apply preview fails | `error` step with retry from `review` or `preview` as appropriate |
| Resume edited after feedback generated | Apply step uses current `processed_data` at apply time; no stale-hash gate required for v1 (document as known limitation) |
| Regenerate with unsaved modal answers | Confirm dialog; server clears answers on regenerate |

## Test plan

### Backend

- [ ] Rejects feedback generate for master resume (400)
- [ ] Rejects when no job context on tailored resume (400)
- [ ] Generate returns valid JSON with `report_markdown` and `questions`; persists to resume row
- [ ] `report_markdown` contains all 11 required headings
- [ ] PATCH answers merges without overwriting unrelated keys
- [ ] Apply-preview returns diff; apply updates `processed_data` and sets `applied_at`
- [ ] Regenerate replaces report/questions and clears answers
- [ ] Custom prompt override validated for required placeholders (422)
- [ ] Empty override falls back to default prompt

### Frontend

- [ ] Tailor confirm redirects to `/builder?id={tailoredId}`
- [ ] Background generation fires on builder mount for tailored resume without feedback
- [ ] Feedback button shows loading state during background gen
- [ ] Modal opens at summary with persisted report on return visit
- [ ] Question step advances, saves answers, supports skip/back; last question goes to review
- [ ] Review step lists all questions and answers; skipped answers show placeholder
- [ ] Edit from review opens question at correct index; save returns to review (not next question)
- [ ] Back from edit-from-review returns to review
- [ ] Apply feedback from review triggers apply-preview; accept updates builder resume data
- [ ] Regenerate clears answers after confirm
- [ ] Feedback tab removed from builder tab bar
- [ ] i18n keys mirrored across all 5 locale files
