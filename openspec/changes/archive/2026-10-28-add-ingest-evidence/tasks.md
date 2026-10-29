# Tasks

- [x] `IngestNode.sources` on the OpenAPI schema: optional `{ kind?, locator }[]`
- [x] Ingest transaction ensures sources, links them to the resolved item, and writes the create/match enrichments described in the delta
- [x] Repeat POST does not duplicate a source, a link, or the same fact
- [x] 409 still leaves no new source and no new root SKU
- [x] Vitest `app.request` covers the scenarios in the delta
- [x] Do not start until `add-evidence` has landed. Landed and folded: `openspec/specs/bom-evidence/spec.md` (`a58e71b`, `58152f0`).

## Owed from astra-arch-review (2026-10-29)

- [x] Reconcile ingest locator/kind validation with the proposed evidence contract: omitted/null/blank handling, supported forms, trim-based identity, legacy compatibility, and validation status; add atomic rejection and whitespace-equivalent locator scenarios (review finding 1).
- [x] Pin exact enrichment values and non-empty eligibility against existing create/null-fill normalization, separately addressing notes; add padded and whitespace-only create/match scenarios without changing item semantics (review finding 2).
- [x] Pin source attribution for both create and matched null-fill enrichments and per-node source links; add request-source/node-override/child-inheritance and retained-old-source scenarios (review finding 3).
- [x] Fresh advise after preparation.

## Implementation validation

The mint fixture in `src/lib/server/api/app.test.ts` used `source: 'brief'`.
That string is not a locator under the accepted rule, so the conductor changed
the fixture and the expected column to `brief.md`. `npm test` then passed:
10 files, 128 tests.
