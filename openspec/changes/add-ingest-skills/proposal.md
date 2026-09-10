# add-ingest-skills

> **ACTIVE BUILD**

## Why

POST `/ingest` writes JSON trees. Agents still have to turn a shopping
brief, CAMERAS.md, or a datasheet PDF into that tree. Without a repo
skill they will SQL the PGLite file.

## What

- Skill `ingest-hardware` in this repo: files and prose → JSON tree → POST `/api/v1/ingest`
- pdf2md for PDFs (user rule). Markdown parser lives here, not on the route
- HTTP only. No drizzle, no `data/dabom/`
- Capability: ADDED `ingest-skills`

## Impact

- Capabilities: ADDED `ingest-skills`
- ADRs: none (HTTP-only was steered)

## User journey & surfaces

No new UI because the skill is an agent surface; the crib lists what
ingest already wrote.

## Out of scope

- Changing POST `/ingest` (`add-ingest-api`, folded)
- Quote refresh (`add-price-skills`)
- LLM-as-a-service outside the agent running the skill
