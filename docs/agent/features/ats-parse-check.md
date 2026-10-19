# ATS parse-check (fork notes)

Upstream's deterministic ATS parse-check lives in `apps/backend/app/services/ats_parse/`
(`POST /ats/parse-check` for uploads, `POST /resumes/{id}/parse-check` for a saved resume's
own render) and the builder's ATS CHECK tab (`components/builder/ats-check-view.tsx`).
Upstream does not ship this docs folder; this file records fork-specific behaviour.

Multi-role work entries: the round trip checks every role, in the order pdfminer reads the
fork's `WorkExperienceBlock` (company, every role title, location, every role's dates); see
`tests/fixtures/ats/renders/README.md`.

## On PDF download

`GET /resumes/{id}/pdf` runs the same parse-check (`parse_check_pdf`, same arguments as
`POST /resumes/{id}/parse-check`) on the bytes it returns. Checks with status `fail` come
back in the `X-Resume-Pdf-Ats-Failures` header as a JSON list of `{id, category, severity,
status, params}`; the header is absent when nothing fails. The check is best effort: if it
cannot run, the download still succeeds without the header.

The builder and resume viewer show the failures with the ATS check's own messages
(`lib/utils/ats-check-messages.ts`, shared with `ats-check-view.tsx`). This replaced the
fork's separate `evaluate_pdf_ats_extractability` check and its `X-Resume-Pdf-Warnings` /
`X-Resume-Pdf-Errors` string headers.
