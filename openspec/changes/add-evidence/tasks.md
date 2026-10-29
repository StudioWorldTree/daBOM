# Tasks

- [x] Drizzle tables `sources`, `item_sources`, `enrichments`, `thoughts`, `thought_sources`, plus the migration
- [x] Migration backfills distinct non-empty `items.source` into notebook sources and links, and does not clear the column or insert enrichments
- [x] Zod + `createRoute` for POST `/sources`, POST `/items/{sku}/sources`, POST `/items/{sku}/enrichments`, POST `/items/{sku}/thoughts`, GET `/items/{sku}/evidence`, GET `/sources/{id}`
- [x] OpenAPI lists those operations and does not list PATCH or DELETE of one enrichment or one thought
- [x] `DELETE /items/{sku}` removes that item's evidence and leaves a shared source in place
- [x] Vitest `app.request` covers the scenarios in the delta
- [x] ADR in `ARCHITECTURE.md` for the three stores, the no-overwrite rule, and the backfill
- [x] `openspec/AGENTS.md` capability list names `bom-evidence`

## Advise owed — astra-arch-review, 2026-10-29

- [x] R1: Amend design/delta/tasks for upgrade, fresh seed, and forced reseed: catalog source links agree across paths, reset handles all new foreign keys, and each path has a verification scenario. See `reviews/2026-10-29-advise.md`.
- [x] R2: Require atomic item/history deletion, including thought-source joins and quotes; add rollback coverage and preservation of sources referenced by another item's link, enrichment, or thought.
- [x] R3: Pin stable enrichment/thought ids, server creation timestamps, and deterministic history read ordering in the contract and OpenAPI verification scenarios.
- [x] Fresh advise after the R1–R3 contract amendments. Contract reference: [astra-arch-review acceptance](reviews/2026-10-29-re-advise.md).
