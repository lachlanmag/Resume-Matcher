# Tailored Resume Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted, structured HR-style feedback for tailored resumes with a modal wizard (summary → questions → review → apply preview → apply confirm), background generation after tailor redirect, and a Feedback button next to AI Regenerate.

**Architecture:** One `complete_json` call (`schema_type="feedback"`) produces `report_markdown` + structured `questions[]`, persisted on the resume row as `resume_feedback` JSON. Four REST endpoints handle generate, answer PATCH, apply-preview, and apply. Frontend mirrors `EnrichmentModal` / `use-enrichment-wizard.ts` with an added `review` step and `returnToReview` edit mode. Apply reuses improve diff generation (`complete_json` + `apply_diffs`).

**Tech Stack:** FastAPI, SQLAlchemy/SQLite, LiteLLM `complete_json()`, Next.js 16, React 19, existing Swiss UI primitives.

**Spec:** `docs/superpowers/specs/2026-06-26-tailored-resume-feedback-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/backend/app/models.py` | Add `resume_feedback` JSON column on `Resume` |
| `apps/backend/app/db_engine.py` | Schema patch: `ALTER TABLE resumes ADD COLUMN resume_feedback JSON` |
| `apps/backend/app/database.py` | Read/write `resume_feedback` in `_resume_to_dict` / `update_resume` |
| `apps/backend/app/schemas/feedback.py` | Pydantic models for feedback payload and API requests/responses |
| `apps/backend/app/schemas/models.py` | Add `resume_feedback` to `ResumeFetchData` |
| `apps/backend/app/prompts/feedback.py` | `APPLY_FEEDBACK_PROMPT` |
| `apps/backend/app/prompts/templates.py` | Evolve `TAILORED_RESUME_FEEDBACK_PROMPT` to JSON output |
| `apps/backend/app/services/feedback.py` | Generate, apply-preview, apply logic |
| `apps/backend/app/routers/resumes.py` | Four feedback routes; remove old `generate-feedback` |
| `apps/backend/tests/integration/test_feedback_api.py` | Integration tests for feedback endpoints |
| `apps/frontend/lib/api/feedback.ts` | API client |
| `apps/frontend/hooks/use-feedback-wizard.ts` | Wizard state machine |
| `apps/frontend/components/feedback/*.tsx` | Modal + step components |
| `apps/frontend/components/builder/resume-builder.tsx` | Feedback button, background gen, remove Feedback tab |
| `apps/frontend/app/(default)/tailor/page.tsx` | Redirect to `/builder?id=…` |

---

## Phase A — Database and schemas

### Task A1: Add `resume_feedback` column

**Files:**
- Modify: `apps/backend/app/models.py`
- Modify: `apps/backend/app/db_engine.py`
- Modify: `apps/backend/app/database.py`
- Test: `apps/backend/tests/unit/test_database.py`

- [ ] **Step 1: Add column to SQLAlchemy model**

In `apps/backend/app/models.py`, after `tailor_settings`:

```python
resume_feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

- [ ] **Step 2: Add schema patch**

In `apps/backend/app/db_engine.py` `_apply_schema_patches`, after the `tailor_settings` block:

```python
if "resume_feedback" not in columns:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE resumes ADD COLUMN resume_feedback JSON"))
```

- [ ] **Step 3: Emit in `_resume_to_dict`**

In `apps/backend/app/database.py` `_resume_to_dict`, after the `tailor_settings` block:

```python
if row.resume_feedback is not None:
    doc["resume_feedback"] = row.resume_feedback
```

- [ ] **Step 4: Write round-trip test**

Add to `apps/backend/tests/unit/test_database.py` (mirror `test_tailor_settings_round_trip`):

```python
async def test_resume_feedback_round_trip(self, db):
    created = await db.create_resume(content="# Test", is_master=False, parent_id="master-1")
    payload = {
        "report_markdown": "## Candidate summary\n- Good fit",
        "questions": [{"question_id": "q1", "category": "gap", "prompt": "Clarify scope?", "context": ""}],
        "answers": {},
        "generated_at": "2026-06-30T12:00:00Z",
        "applied_at": None,
    }
    updated = await db.update_resume(created["resume_id"], {"resume_feedback": payload})
    assert updated["resume_feedback"] == payload
    fetched = await db.get_resume(created["resume_id"])
    assert fetched["resume_feedback"] == payload
```

- [ ] **Step 5: Run test**

Run: `cd apps/backend && uv run pytest tests/unit/test_database.py::TestDatabase::test_resume_feedback_round_trip -v`
Expected: PASS

---

### Task A2: Pydantic schemas

**Files:**
- Create: `apps/backend/app/schemas/feedback.py`
- Modify: `apps/backend/app/schemas/models.py`

- [ ] **Step 1: Create feedback schemas**

```python
# apps/backend/app/schemas/feedback.py
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

class FeedbackApplyPreviewRequest(BaseModel):
    preview_token: str | None = None  # optional v1; apply uses inline diff from preview response

class FeedbackApplyRequest(BaseModel):
    improved_data: dict  # ResumeData-shaped dict from accepted preview
```

- [ ] **Step 2: Extend `ResumeFetchData`**

In `apps/backend/app/schemas/models.py`:

```python
from app.schemas.feedback import ResumeFeedback  # top-level import at file end if circular

class ResumeFetchData(BaseModel):
    ...
    resume_feedback: ResumeFeedback | None = None
```

Wire `resume_feedback` through the resume fetch handler in `apps/backend/app/routers/resumes.py` when building the response.

---

## Phase B — Prompts and service

### Task B1: Evolve feedback generation prompt to JSON

**Files:**
- Modify: `apps/backend/app/prompts/templates.py`
- Modify: `apps/backend/app/llm.py` (add `"feedback"` to truncation heuristics if needed)

- [ ] **Step 1: Update `TAILORED_RESUME_FEEDBACK_PROMPT`**

Append to the existing prompt (keep all 11 markdown heading instructions intact):

```
Return JSON only with this exact shape:
{
  "report_markdown": "<full markdown report using the headings above>",
  "questions": [
    {
      "question_id": "q1",
      "category": "gap",
      "prompt": "<specific question for the candidate>",
      "context": "<optional short context>"
    }
  ]
}

The questions array must contain 3 to 8 items drawn from gaps, risks, unsupported claims, ATS blockers, and improvement areas in the report. Categories must be one of: gap, risk, clarification, improvement, ats.
```

- [ ] **Step 2: Add `feedback` schema type to `_appears_truncated`** (if tests fail on truncation detection)

In `apps/backend/app/llm.py`, treat `feedback` like `enrichment` (require `report_markdown` key).

---

### Task B2: Add `APPLY_FEEDBACK_PROMPT`

**Files:**
- Create: `apps/backend/app/prompts/feedback.py`
- Modify: `apps/backend/app/prompts/__init__.py`

- [ ] **Step 1: Create apply prompt**

```python
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

Return a JSON diff object with the same shape used for resume improvement diffs: a list of path/value operations that modify workExperience descriptions, summary, skills, or other relevant sections.

Output JSON only."""
```

Import `CRITICAL_TRUTHFULNESS_RULES` (use the `keywords` or appropriate id) for `{truthfulness_rules}`.

---

### Task B3: Feedback service

**Files:**
- Create: `apps/backend/app/services/feedback.py`
- Modify: `apps/backend/app/services/cover_letter.py` (remove or deprecate markdown-only `generate_tailored_resume_feedback`)

- [ ] **Step 1: Implement `generate_structured_feedback`**

```python
async def generate_structured_feedback(
    resume_data: dict,
    job_description: str,
    language: str = "en",
) -> dict:
    """Returns ResumeFeedback-shaped dict (without generated_at/applied_at)."""
    # Reuse _resolve_feature_prompt from cover_letter (import or move to shared util)
    result = await complete_json(prompt, max_tokens=8192, schema_type="feedback")
    # Validate required keys; validate report_markdown contains all 11 headings
    return {
        "report_markdown": result["report_markdown"].strip(),
        "questions": result["questions"],
        "answers": {},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "applied_at": None,
    }
```

Add helper `_validate_report_headings(report_markdown: str) -> None` checking all 11 `##` headings from the spec.

- [ ] **Step 2: Implement `build_apply_preview`**

```python
async def build_apply_preview(
    resume_data: dict,
    job_description: str,
    report_markdown: str,
    answers: dict[str, str],
    questions: list[dict],
    language: str = "en",
) -> dict:
    """Returns { improved_data, diff_summary, detailed_changes }."""
    answers_block = _format_answers_block(questions, answers)
    prompt = APPLY_FEEDBACK_PROMPT.format(...)
    diff_result = await complete_json(prompt, schema_type="diff")
    improved_data = apply_diffs(copy.deepcopy(resume_data), diff_result.get("diffs", []))
    # Build diff_summary / detailed_changes using existing calculate_resume_diff or equivalent
    return {"improved_data": improved_data, "diff_summary": ..., "detailed_changes": ...}
```

- [ ] **Step 3: Implement `apply_feedback_to_resume`**

Deep-copy `improved_data` onto the resume via `db.update_resume(resume_id, {"processed_data": improved_data, ...})` and set `resume_feedback.applied_at`.

---

## Phase C — API routes

### Task C1: Feedback endpoints

**Files:**
- Modify: `apps/backend/app/routers/resumes.py`

- [ ] **Step 1: Shared guard helper**

Extract the guard logic from the existing `generate_feedback_endpoint` into `_require_tailored_resume_with_job(resume_id) -> tuple[dict, dict, dict]` returning `(resume, job, improvement)`.

- [ ] **Step 2: `POST /resumes/{id}/feedback/generate`**

```python
@router.post("/{resume_id}/feedback/generate")
async def feedback_generate_endpoint(resume_id: str, body: FeedbackGenerateRequest = FeedbackGenerateRequest()):
    resume, job, _ = await _require_tailored_resume_with_job(resume_id)
    if resume.get("resume_feedback") and not body.replace:
        return {"data": resume["resume_feedback"]}  # idempotent: return existing
    payload = await generate_structured_feedback(resume["processed_data"], job["content"])
    await db.update_resume(resume_id, {"resume_feedback": payload})
    return {"data": payload}
```

- [ ] **Step 3: `PATCH /resumes/{id}/feedback/answers`**

Merge `body.answers` into `resume_feedback.answers`; reject unknown `question_id` values with 400.

- [ ] **Step 4: `POST /resumes/{id}/feedback/apply-preview`**

Load persisted feedback; call `build_apply_preview`; return preview payload (same shape as improve preview diff response for frontend reuse).

- [ ] **Step 5: `POST /resumes/{id}/feedback/apply`**

Accept `FeedbackApplyRequest.improved_data`; update `processed_data`; set `applied_at`; return updated resume fetch payload.

- [ ] **Step 6: Remove `POST /resumes/{id}/generate-feedback`**

Delete the old endpoint and its import of markdown-only generator.

---

### Task C2: Integration tests

**Files:**
- Create: `apps/backend/tests/integration/test_feedback_api.py`

- [ ] **Step 1: Write tests**

```python
class TestFeedbackGenerate:
    @patch("app.routers.resumes.generate_structured_feedback", new_callable=AsyncMock)
    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_generate_persists_feedback(self, mock_db, mock_gen, client, tailored_resume_fixtures):
        mock_gen.return_value = SAMPLE_FEEDBACK
        ...
        assert resp.status_code == 200
        mock_db.update_resume.assert_called_once()

    @patch("app.routers.resumes.db", new_callable=AsyncMock)
    async def test_rejects_master_resume(self, mock_db, client):
        ...
        assert resp.status_code == 400

class TestFeedbackAnswers:
    async def test_patch_merges_answers(self, ...): ...

class TestFeedbackApply:
    @patch("app.routers.resumes.build_apply_preview", new_callable=AsyncMock)
    async def test_apply_preview_returns_diff(self, ...): ...
```

Use fixtures mirroring `test_resume_api.py` with `parent_id` set and an improvement record.

- [ ] **Step 2: Run tests**

Run: `cd apps/backend && uv run pytest tests/integration/test_feedback_api.py -v`
Expected: PASS

---

## Phase D — Frontend API client

### Task D1: `lib/api/feedback.ts`

**Files:**
- Create: `apps/frontend/lib/api/feedback.ts`
- Modify: `apps/frontend/lib/api/resume.ts` (remove `generateResumeFeedback`; add `resume_feedback` to fetch types)
- Modify: `apps/frontend/lib/api/index.ts`

- [ ] **Step 1: Types and functions**

```typescript
export interface FeedbackQuestion {
  question_id: string;
  category: 'gap' | 'risk' | 'clarification' | 'improvement' | 'ats';
  prompt: string;
  context: string;
}

export interface ResumeFeedback {
  report_markdown: string;
  questions: FeedbackQuestion[];
  answers: Record<string, string>;
  generated_at: string;
  applied_at: string | null;
}

export async function generateFeedback(resumeId: string, replace = false): Promise<ResumeFeedback> {
  const res = await apiPost(`/resumes/${encodeURIComponent(resumeId)}/feedback/generate`, { replace });
  ...
  return res.json().data;
}

export async function patchFeedbackAnswers(resumeId: string, answers: Record<string, string>): Promise<ResumeFeedback> { ... }

export async function previewFeedbackApply(resumeId: string): Promise<FeedbackApplyPreview> { ... }

export async function applyFeedback(resumeId: string, improvedData: ResumeData): Promise<void> { ... }
```

- [ ] **Step 2: Extend `fetchResume` response type** with `resume_feedback?: ResumeFeedback | null`.

---

## Phase E — Wizard hook

### Task E1: `use-feedback-wizard.ts`

**Files:**
- Create: `apps/frontend/hooks/use-feedback-wizard.ts`

- [ ] **Step 1: Define steps and state**

```typescript
export type FeedbackWizardStep =
  | 'idle'
  | 'generating'
  | 'summary'
  | 'questions'
  | 'review'
  | 'generating-apply'
  | 'preview'
  | 'applying'
  | 'complete'
  | 'error';

export interface FeedbackWizardState {
  step: FeedbackWizardStep;
  feedback: ResumeFeedback | null;
  currentQuestionIndex: number;
  returnToReview: boolean;
  answers: Record<string, string>;
  preview: FeedbackApplyPreview | null;
  error: string | null;
}
```

- [ ] **Step 2: Implement reducer actions**

Key transitions:
- `loadFeedback(feedback)` → `summary` if feedback exists
- `startGenerate()` → `generating` → `summary`
- `continueFromSummary()` → `questions` (first unanswered) or `review` if all answered
- `nextQuestion()` → increment index; on last question → `review`
- `editFromReview(index)` → `questions` with `returnToReview: true`
- `saveAndReturnToReview()` → PATCH answers → `review`
- `backFromEditQuestion()` → `review` when `returnToReview`
- `startApplyPreview()` → `generating-apply` → `preview`
- `applyAccepted()` → `applying` → `complete`

Mirror `use-enrichment-wizard.ts` patterns for API calls and error handling.

---

## Phase F — Modal UI

### Task F1: Step components

**Files:**
- Create: `apps/frontend/components/feedback/feedback-modal.tsx`
- Create: `apps/frontend/components/feedback/summary-step.tsx`
- Create: `apps/frontend/components/feedback/review-step.tsx`
- Create: `apps/frontend/components/feedback/feedback-question-step.tsx` (adapt from `enrichment/question-step.tsx`)
- Reuse: `apps/frontend/components/enrichment/loading-steps.tsx` (AnalyzingStep, GeneratingStep, etc.)
- Reuse: `apps/frontend/components/builder/regenerate-diff-preview.tsx` for apply preview

- [ ] **Step 1: `summary-step.tsx`**

Scrollable `report_markdown` in mono panel (reuse styling from `feedback-preview.tsx`). Footer: **Continue** (primary). If `questions.length === 0`, show **Done** only.

- [ ] **Step 2: `feedback-question-step.tsx`**

Copy enrichment `QuestionStep` props; add `returnToReview: boolean`. When true, primary label = `t('feedback.saveAndReturnToReview')`, Back returns to review.

- [ ] **Step 3: `review-step.tsx`**

Render list of `{ question, answer | skipped }` rows. Each row has **Edit** button. Footer: **Back** (to last question in linear flow), **Apply feedback** (primary).

- [ ] **Step 4: `feedback-modal.tsx`**

`<dialog>` shell matching `EnrichmentModal`. Header: title + **Regenerate** (confirm dialog). `renderStep()` switch on `state.step`.

---

## Phase G — Builder and tailor integration

### Task G1: Tailor redirect

**Files:**
- Modify: `apps/frontend/app/(default)/tailor/page.tsx`

- [ ] **Step 1: Change redirect target**

In `confirmAndNavigate`:

```typescript
router.push(`/builder?id=${newResumeId}`);
```

Remove the `/resumes/${newResumeId}` branch (keep `/builder` fallback only if no id).

---

### Task G2: Builder integration

**Files:**
- Modify: `apps/frontend/components/builder/resume-builder.tsx`

- [ ] **Step 1: Remove Feedback tab**

Delete `'feedback'` from `TabId`, tab bar entries, `FeedbackPreview`, `GeneratePrompt` feedback branch, and related session state (`resumeFeedback`, `isGeneratingFeedback`, etc.).

- [ ] **Step 2: Add Feedback button on Resume tab**

Beside AI Regenerate, tailored resumes only:

```tsx
{isTailoredResume && (
  <Button variant="outline" size="sm" onClick={() => setShowFeedbackModal(true)} disabled={feedbackGenStatus === 'loading'}>
    {feedbackGenStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
    {t('feedback.buttonLabel')}
  </Button>
)}
```

- [ ] **Step 3: Background generation on mount**

When `isTailoredResume && !resumeFeedback && resumeId`, call `generateFeedback(resumeId)` in a `useEffect`. Track `feedbackGenStatus: 'idle' | 'loading' | 'ready' | 'error'`. On success, set local `resumeFeedback` state from response.

- [ ] **Step 4: Wire `FeedbackModal`**

Pass `resumeId`, `initialFeedback={resumeFeedback}`, `onComplete` to reload resume via `fetchResume`.

- [ ] **Step 5: Delete unused `feedback-preview.tsx`** if no other imports remain.

---

## Phase H — i18n

### Task H1: Translation keys

**Files:**
- Modify: `apps/frontend/messages/en.json`, `es.json`, `zh.json`, `ja.json`, `pt-BR.json`

- [ ] **Step 1: Add `feedback` namespace keys**

```json
"feedback": {
  "buttonLabel": "Feedback",
  "title": "Resume Feedback",
  "regenerate": "Regenerate feedback",
  "regenerateConfirm": "This will replace the current report and clear your answers. Continue?",
  "saveAndReturnToReview": "Save & return to review",
  "applyFeedback": "Apply feedback",
  "skippedAnswer": "Skipped",
  "loading": {
    "generatingTitle": "Generating feedback...",
    "generatingDescription": "Reviewing your tailored resume against the job description",
    "applyingTitle": "Applying your feedback...",
    "applyingDescription": "Updating your resume with your clarifications"
  },
  "review": {
    "title": "Review your answers",
    "description": "Check your responses before applying changes to the resume"
  },
  "complete": {
    "title": "Feedback applied",
    "doneButton": "Done"
  }
}
```

- [ ] **Step 2: Mirror keys in all 5 locale files** (identical structure; translated strings).

- [ ] **Step 3: Remove obsolete builder tab keys** (`builder.previewTabs.feedback`, `builder.leftPanel.feedbackAnalysis`, etc.) if unused.

---

## Phase I — Verification

- [ ] **Backend:** `cd apps/backend && uv run pytest tests/integration/test_feedback_api.py tests/unit/test_database.py -q`
- [ ] **Frontend build:** `cd apps/frontend && npm run build` (i18n shape check)
- [ ] **Manual smoke test:**
  1. Tailor a resume → lands on `/builder?id=…` Resume tab
  2. Feedback button shows spinner then becomes active
  3. Open modal → summary report → questions → review → apply preview → accept → resume updates
  4. Re-open modal → summary shows persisted report (no regen)
  5. Edit answer from review → returns to review
  6. Regenerate feedback → confirm → new report, answers cleared

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Structured JSON generation | B1, B3 |
| Background gen after redirect | G1, G2 |
| Modal wizard UX | E1, F1 |
| Feedback button next to AI Regenerate | G2 |
| Persistence on resume row | A1, C1 |
| Manual regenerate | C1, F1 |
| Review before apply + edit-from-review | E1, F1 |
| Apply with preview/confirm | B3, C1, F1 |
| Fixed report headings | B1, B3 |
| Remove old tab / endpoint | C1, G2 |
| Settings prompt override | Already shipped (Phase B config from prior branch) |
| Tailor redirect to builder | G1 |
