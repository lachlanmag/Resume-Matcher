# ATS render fixtures

Real Chromium renders the ATS parse-check tests read. Refresh them whenever a
template's layout changes, or the tests keep passing against PDFs the app no
longer produces.

| File | Template | Data |
|---|---|---|
| `single-column.pdf` | `swiss-single`, default settings (A4) | `john-doe-full.json` |
| `two-column.pdf` | `swiss-two-column`, default settings (A4) | `ats_fixtures.john_doe()` |
| `modern-single-column.pdf`, `modern-two-column.pdf`, `modern-deedy.pdf`, `vivid.pdf` | as named | upstream renders, not refreshed in the 2026-10 fork sync |

`single-column.pdf` and `two-column.pdf` were re-rendered from the fork's
`WorkExperienceBlock` layout (a company/location row, then one title/dates row
per role). pdfminer reads that block's left column first: company, every role
title, then location and every role's dates.

To re-render: run a backend with a throwaway `DATA_DIR` and a frontend pointed at
it, create a resume from the data above, then download
`/api/v1/resumes/<id>/pdf?template=<template>`. Never render from a real data
directory.
