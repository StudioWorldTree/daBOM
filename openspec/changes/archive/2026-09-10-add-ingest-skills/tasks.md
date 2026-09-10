# Tasks

- [x] `skills/ingest-hardware/SKILL.md` with trigger, HTTP-only rule, link to
      `/.well-known/openapi.json` `IngestNode`, one example tree
- [x] PDF path: `pdf2md` then the same candidate → selection path
- [x] Skill POSTs `/api/v1/ingest` (base from env or localhost:5173); never drizzle
- [x] Parser emits candidates (heading, manufacturer from heading, mpn, notes).
      Tree is composed from a selection: cart section, MPN list, or hand edit
      of the tree file. Not every `###`+`PN` under one root.
- [x] Write `IngestRequest` JSON to a file; agent/human reads it before POST
- [x] Tests: whole `SHOPPING.md` production kit contains T4000 SOM + Rogue-T5
      and does not contain the AGX Developer Kit; grep skill dir for
      `drizzle` / `data/dabom` / `pglite` / `$lib/server` is zero hits
- [x] One line in AGENTS.md pointing at `skills/`
      Reader-added (advise, fable-5.1-arch-review):

- [x] Tree file before POST (review artifact; POST is the commit)
- [x] Candidates + selection, not every PN heading as a BOM line
- [x] Fixture is whole SHOPPING.md; assert the rejected dev kit is absent
      Reader-added (re-advise 2026-09-10, fable-5.1-arch-review):

- [x] Tests live under `skills/**` (add to vitest include). No helper under
      `src/lib/skills/`; the delta forbids a parser under `src/`
