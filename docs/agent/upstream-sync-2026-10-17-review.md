# Upstream Sync Review — 2026-10-17

**Branches:** merging `origin/main` (fork) into `upstream-sync-2026-10-17` (fresh off `upstream/main` @ `f0f124a`, 2026-10-16)
**Archived:** old working branch → `archive/upstream-sync-2026-08-06-stale-20261017` (your 113 uncommitted changes are preserved in a stash on that branch: `stash@{0}`)
**Common ancestor:** `82b758b` (2026-06-22, "fix/lmstudio-json-object-857") — fork and upstream have been diverging since then.

**Scale:** upstream has **789 commits** since the common ancestor vs your **27 fork commits**. This is not a small sync — upstream did a near-total architectural pass (new Swiss design system, Oxlint/Oxfmt replacing ESLint/Prettier, Postgres backend option, MCP server, ATS parse-check, agent-mode/coding-agent integration, subscription-provider model picker). Expect to re-apply your logic on top of new structure in several places rather than a clean line-level merge.

**Policy:** keep all fork additions/enhancements **unless** upstream has a strictly better replacement for the same capability (then take upstream's and verify your use case still works).

---

## 1. Fork-only features to preserve (27 commits since common ancestor)

| Feature | Commits | Files | Risk |
|---|---|---|---|
| **Tailored resume feedback** (on-demand feedback modal/wizard in builder, keyboard shortcuts, apply-preview fix) | `11289665`, `73f94f63`, `9caee1a8`, `9286d350`, `0e7537e6`, `83a9beda`, `20585a30`, `f214222` (via `fix/feedback-flow...` branch), `594233d` | `resume-builder.tsx`, `resume-form.tsx`, feedback modal components, `database.py` (`upsert_improvement`) | **High** — large diff on `resume-builder.tsx`/`resume-form.tsx`, upstream also touched these heavily (regenerate-wizard overhaul) |
| **Multi-role work experience** | `4ff6e7d6`, `d43774e` (multi-role-jobs branch), `20585a30` | `work_experience.py` schema, normalization fixtures, work-experience-block.tsx, resume templates | **High** — upstream changed all resume template files too (page-break hooks) |
| **PDF export + ATS checks** | `867d9ef7`, `23d3d3e` (issue-10 branch), `aa075bf1` | `app/pdf.py`, ATS metadata on download | **High** — upstream did a full PDF/print parity rewrite (`pdf.py` +689/-87 lines, running headers, page-break hooks). Upstream's `ats.py` router may already supersede part of this — compare. |
| **API key migration / config refactor** | `a22ab95c`, `77fc9a61` | `config.py`, `routers/config.py` | **High** — upstream rewrote key storage entirely (encrypted `api_keys` table, per-provider CRUD, `PUT /config/api-keys`). Your migration logic likely needs to be re-expressed against the new scheme, not merged line-by-line. |
| **Credential-scrubbing tests** | `3386a24d` | wizard tests | Medium |
| **Drag-and-drop UX in builder** | `0e7537e6` | resume-builder.tsx | Medium — check if upstream's dnd-kit tracker board patterns should be reused |
| **Cursor proxy tooling** | `2852e129`, `ae43cde0`, `d1ac378c`, `5d6181f` (branch) | `scripts/{dev-with-cursor,start-cursor-proxy,stop-cursor-proxy}.sh` | Low — standalone scripts, no conflict |
| **i18n: ES/JA/PT-BR timeout strings** | `f6439e07` | `messages/*.json` | Low — but upstream added `fr`/`ko` locales and changed message tree shape; must re-verify parity (`check_locale_parity.py`) after merge |
| **Fork docker config** (points at your fork, env naming) | `dcc4a192`, `b6ad5119` | `docker-compose.yml`, `.gitignore` | Low–Medium — upstream also changed `docker-compose.yml` (security hardening: loopback binding) |
| **Backend/frontend CLAUDE.md docs** | `7e8c707d` | docs | Low — mostly additive, upstream has evolved its own docs/agent tree extensively; reconcile content, don't just keep yours blindly |

---

## 2. Upstream highlights since 2026-06-22 (what you'd be adopting)

Grouped from `git log 82b758b..upstream/main`:

- **Agent Mode**: use Resume Matcher driven by a coding agent, no API key needed (`6e26fdcd`, `f0612394`, `723bc605`) — potentially overlaps/competes with your Cursor-proxy approach. **Decide: keep cursor-proxy scripts, adopt agent-mode, or both?**
- **Subscription-provider model picker + risk dialog** (`3511c6f4`, `362b5d37`) — new settings UX for Claude subscription vs API key.
- **PDF/print parity overhaul**: running headers, page-break hooks (`data-resume-*`), condensed "earlier experience" roles, template fixes across every `resume-*.tsx` (`c0814bcb`, `c9dbbb07`, `ed82fb9a`, `3971a33f`, `6dafd67a`, `5c01f70c`, `a8000c7d` + chain). **Directly conflicts with your multi-role rendering changes in the same files.**
- **Security hardening**: backend listens on loopback by default (`80f3d0d1`), Base URL / key-binding validation (`d9ded00a`, `88701e80`, `d2118079`), PDF upload hardening (`99da3f23`), legacy `.doc` rejection (`829a3f9e`).
- **Formatter swap**: Prettier → Oxfmt, ESLint → Oxlint (`b761872f`) — touches `package.json`, every lint config; **your frontend diffs will likely need reformatting to the new tool's style.**
- **New subsystems** (per backend CLAUDE.md): Postgres backend option, MCP server (stdio tools), ATS parse-check router (`app/routers/ats.py`), per-provider encrypted API key storage, application tracker (Kanban), custom sections.
- **New Swiss International Style design system** — frontend got a full visual/token rewrite (`docs/portable/swiss-design-system/`). Your builder/feedback UI components will need restyling to match, not just functional merging.
- **i18n**: added `fr` and `ko` locales; message-tree shape enforced strictly (`lib/i18n/messages.ts` types off `en.json`) — stricter than what existed when your fork diverged.

---

## 3. Real merge conflicts (from trial `git merge --no-commit origin/main`, then aborted)

**65 files.** Grouped by review batch — suggested order (safest/most mechanical first):

### Batch A — Docs/config, low risk
- `SETUP.md`
- `docs/agent/llm-integration.md` *(modify/delete: you deleted it, upstream modified it — likely means upstream restructured docs; decide whether to restore-and-merge or follow upstream's new doc location)*
- `docker-compose.yml`

### Batch B — i18n & lockfiles (mechanical, but must preserve parity)
- `apps/frontend/messages/{en,es,ja,pt-BR,zh}.json` *(also need to add fr/ko if not present on your side)*
- `apps/frontend/package.json`, `package-lock.json`

### Batch C — Backend config/key management (needs re-design, not line merge)
- `apps/backend/app/config.py`, `apps/backend/pyproject.toml`
- `apps/backend/app/routers/config.py`
- `apps/backend/app/models.py`, `apps/backend/app/schemas/__init__.py`, `apps/backend/app/schemas/models.py`
- `apps/backend/app/database.py`, `apps/backend/app/db_engine.py`

### Batch D — LLM / PDF / prompts
- `apps/backend/app/llm.py` (+950/-99 upstream — huge rewrite)
- `apps/backend/app/pdf.py` (+689/-87 upstream)
- `apps/backend/app/prompts/__init__.py`, `apps/backend/app/prompts/templates.py`
- `apps/backend/app/services/improver.py`, `apps/backend/app/services/parser.py`
- `apps/backend/app/routers/resumes.py`, `apps/backend/app/routers/enrichment.py`, `apps/backend/app/routers/health.py`
- `apps/backend/e2e_monitor/flow.py`

### Batch E — Backend tests (should follow whichever Batch C/D decisions land)
- `apps/backend/tests/integration/{test_config_api,test_health_api,test_regenerate_endpoints,test_resume_api}.py`
- `apps/backend/tests/unit/{test_database,test_llm,test_resume_diff,test_resume_wizard_service,test_verify_diffs}.py`

### Batch F — Frontend resume templates (your multi-role vs upstream's page-break hooks)
- `apps/frontend/components/resume/{resume-clean,resume-latex,resume-modern,resume-modern-two-column,resume-single-column,resume-two-column,resume-vivid}.tsx`

### Batch G — Frontend builder/feedback UI (your biggest fork feature vs upstream's regenerate-wizard rewrite)
- `apps/frontend/components/builder/{resume-builder,resume-form,generate-prompt,highlighted-resume-view,regenerate-dialog,regenerate-diff-preview,regenerate-instruction-dialog}.tsx`
- `apps/frontend/components/builder/forms/{education-form,experience-form}.tsx`
- `apps/frontend/components/common/resume_previewer_context.tsx`
- `apps/frontend/components/dashboard/resume-component.tsx`
- `apps/frontend/components/enrichment/loading-steps.tsx`
- `apps/frontend/components/resume-wizard/live-preview.tsx`
- `apps/frontend/app/(default)/{resumes/[id],settings,tailor}/page.tsx`, `apps/frontend/app/print/resumes/[id]/page.tsx`

### Batch H — Frontend API client layer
- `apps/frontend/lib/api/{client,config,resume}.ts`

### Batch I — Frontend tests
- `apps/frontend/tests/regenerate-wizard.test.tsx`

---

## 4. Suggested working method

1. Review this doc, flag anything you want reprioritized or merged differently.
2. We go batch by batch (A→I), re-running `git merge --no-commit origin/main` is NOT how we'll do it per-file (that gives a single blob); instead for each batch I'll open the specific conflicting files, show both sides' intent, and propose a resolution that keeps your feature + upstream's improvement where both can coexist.
3. After each batch, run the relevant test suite (`uv run pytest` for backend batches, `npm run test`/`npm run guard` for frontend batches) before moving to the next.
4. Once all batches resolve, run full backend+frontend test suites, `npm run build` (catches i18n shape drift), and `npm run lint`, then commit the merge.

---

## Decisions (2026-10-17)

- **Agent Mode vs Cursor-proxy scripts**: keep both. Resolve per-conflict as they come up in Batch D/G; no blanket drop.
- **PDF/ATS**: not a duplicate. Fork's `#11` feature is a download-time extractability check wired into the resume download flow + frontend warnings; upstream's `ats.py` is a separate standalone `/ats/parse-check` endpoint for arbitrary uploads. **Keep both** — land upstream's `ats.py` + `services/ats_parse/` as a new addition alongside the existing `pdf.py` download-time check.
- **Swiss design system**: defer restyling. Functional merge lands first; restyling tracked in [issue #27](https://github.com/lachlanmag/Resume-Matcher/issues/27).
- **docs/agent/llm-integration.md**: adopt upstream's restructured docs tree wholesale. Drop the fork's old version; don't restore the deletion.

## Batch B progress (i18n)

- All 7 locales (`en`, `es`, `fr`, `ja`, `ko`, `pt-BR`, `zh`) resolved and pass structural parity.
- `fr.json` and `ko.json` (new upstream locales) got the 11 fork-only keys (resume feedback feature, tailorLength, multi-role experience fields) filled with **English placeholder text** — these need real translation before ship. Keys: `builder.generatePrompt.feedbackDescription/feedbackFooter`, `builder.regenerate.selectDialog.summary`, `builder.tailorLength`, `builder.forms.experience.fields.roleTitle/roles`, `builder.forms.experience.actions`, `builder.alerts.feedbackGenerateFailed`, `settings.contentGeneration.resumeFeedback`, `settings.tailorLength`, `feedback.*`.

## Known feature gap: replace_resume_id on confirm (needs design decision)

`ImproveResumeConfirmRequest.replace_resume_id` (fork) lets a re-tailor update an
existing tailored resume in place instead of creating a new row each time.
Upstream's `improve_resume_confirm_endpoint` was rewritten around an atomic
preview-claim mechanism (`db.claim_preview` / `db.complete_preview`) that always
INSERTs a new resume row — there's no update-in-place path in
`Database.complete_preview` (apps/backend/app/database.py:949).

Re-adding `replace_resume_id` cleanly means either:
1. A new `Database` method (e.g. `complete_preview_replacing(existing_resume_id=...)`)
   that does the same atomic claim-ownership check but UPDATEs the existing row
   instead of inserting, or
2. Handling the replace as a second step after `complete_preview` succeeds
   (delete/merge), which loses atomicity with the claim.

Not implemented in this sync — `request.replace_resume_id` is currently silently
ignored by the merged confirm endpoint (always creates a new tailored resume).
`tailor_length_settings` on confirm IS wired through (added to `resume_fields`).

**Action needed before shipping this sync:** decide on (1) vs (2) above, or
confirm replace-on-confirm can be dropped as a feature for now.

**Update:** same gap applies to `/resumes/improve` (one-shot endpoint) — it now
calls the shared `execute_tailoring_pipeline`/`db.create_tailored_resume`,
which also always inserts a new resume. `request.replace_resume_id` is
dropped there too for the same reason. `tailor_length_settings` IS resolved
and threaded through on `/improve` (now fetches the resume first to resolve
resume-specific stored tailor settings, matching pre-merge fork behavior).

## Decision: removed _ensure_master_resume_for_tailor from /improve/preview

Upstream added a check rejecting tailoring from a non-master (already-tailored)
resume on `/resumes/improve/preview`. No test exercised or required this
restriction, while fork's own test
(`test_tailored_source_grounds_refiner_on_its_own_track`) explicitly relies on
re-tailoring directly from a tailored resume to verify multi-master refiner
grounding. Removed the check (function + its one call site) rather than
breaking fork's established multi-master re-tailor workflow. If upstream's
restriction was intentional, it needs a narrower condition (e.g. only when no
`replace_resume_id`/track context is present) — flagging for review.

## Decisions (2026-10-18)

1. **Tailor length: unified control.** The fork's `TailorLengthControls` (target pages 1-3,
   bullets min/max; default from Settings, persisted per resume via `tailor_settings`) is the only
   control on `/tailor`. It also drives upstream's post-generation page fit:
   `max_pages = target_pages`, `max_bullets_per_entry = bullets_per_job_max`,
   `page_fit = toPageFitSettings(source master's template_settings)`.
   Upstream's per-browser localStorage control (`lib/utils/tailor-length-settings.ts`, page limit
   "none" option) is no longer used by the UI; the module and its test are left in place (repo rule:
   don't remove tests). `TailorLengthControls` restyled to Swiss primitives (SegmentedControl/Input/Label).
   After confirm the tailor page routes to `/builder?id=` (fork behaviour) using upstream's
   idempotent/expiry-checked confirm flow.
2. **replace_resume_id: add an atomic `complete_preview_replacing()`** that claims the preview and
   UPDATEs the existing tailored resume in the same transaction. (Implementation pending, tracked below.)
3. **`_ensure_master_resume_for_tailor` removal:** awaiting user after a fuller explanation.

## Status (2026-10-18): all batches resolved

- No conflict markers remain. `origin/main` (fork) and `upstream/main` are both ancestors of the branch.
- Frontend: `tsc` clean, vitest 160 files / 1587 tests, oxlint + oxfmt clean, Swiss guard ratchet unchanged.
- Backend: 1933 passed / 7 skipped, ruff check + format clean.
  `test_pdf_lifecycle::test_simultaneous_recovery_callers_install_one_browser` is an intermittent
  real-Chromium timing flake on upstream-only render code (fork PDF helpers are not on that path).
- **replace_resume_id implemented** (decision 2): `Database._replace_tailored_row` validates and
  updates in the same transaction as the improvement record, for both `complete_preview` (confirm)
  and `create_tailored_resume` (`/improve`, used by the builder's Re-tailor). Keeps the resume's id,
  filename, created_at and template_settings; no second tracker card. Tests:
  `tests/integration/test_replace_tailored_resume.py`.
- Fixed in non-conflicted code during the sync (field relocation fallout): frontend
  `normalizeExperienceEntry` dropped `descriptionStyles`/`condensed`; upstream
  `resume-normalization.ts` filtered experience on flat `title`/`years`; deedy + modern-deedy
  templates and resume-wizard storage read flat fields.
- Fork-only UI (feedback modal/steps, markdown content, tailor panels) migrated to Swiss tokens and Phosphor icons.

Still open: decision 3 (`_ensure_master_resume_for_tailor`), awaiting the user.
