# steer add-ingest-skills

**When.** 2026-09-09 (epic steer)
**Depth.** standard

## Decided

- Skills POST `/ingest`; they do not write PGLite (user)
- Markdown/PDF parsing belongs here (ingest-api send-back hole 4)

## Feeds change

A skill that builds the JSON tree and POSTs it. pdf2md for datasheets.

Send-back 2026-09-09: do not treat every `###`+`PN` as a BOM line.
Candidates plus a selection; tree file before POST.
