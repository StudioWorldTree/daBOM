# steer add-ingest-api

**When.** 2026-09-09 (epic steer; this node owned the ingest fork)
**Depth.** standard

## Decided

- POST `/ingest` writes through items + BOM lines (user; agreed recommended)
- No draft store
- Skills are HTTP-only — they do not write PGLite (`add-ingest-skills`)

## Feeds change

Write-through upsert. Mint and collision are this change (left open by
ADR-002). PDF parsing is skills, not this route.
