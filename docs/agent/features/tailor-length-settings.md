# Tailor length settings

Global defaults and per-tailored-resume controls for output length during AI tailoring.

## Settings

| Field | Default | Range |
|-------|---------|-------|
| `target_pages` | 2 | 1–3 |
| `bullets_per_job_min` | 3 | 1–10 |
| `bullets_per_job_max` | 5 | ≥ min |

## Behavior

1. **Page target takes precedence** over bullet counts (estimated word budget).
2. **Bullet allocation**: all jobs get at least min; extra bullets go to most recent jobs up to max; if budget is tight, oldest jobs lose bullets first.
3. **Master-aware selection**: tailoring prompts include length constraints; the LLM uses `replace_list` on `workExperience[i].description` to pick from the master bullet pool (not truncate the tailored draft).
4. **Safety net**: `enforce_tailor_length` runs after refinement if the model overshoots.

## API

- `GET/PUT /config/tailor-length` — global defaults
- `PATCH /resumes/{id}/tailor-settings` — per tailored resume
- `POST /resumes/{id}/apply-tailor-length` — re-select from master + safety net
- Improve preview/confirm/improve accept `tailor_length_settings`; `replace_resume_id` updates an existing tailored resume on re-tailor

## Key files

- `apps/backend/app/services/tailor_length.py`
- `apps/backend/app/services/improver.py` (`generate_resume_diffs`, `generate_length_selection_diffs`)
- `apps/backend/app/prompts/templates.py` (`DIFF_IMPROVE_PROMPT`, `LENGTH_SELECTION_PROMPT`)
- `apps/frontend/components/tailor/tailor-length-controls.tsx`
