# Tasks

- [x] `isBundle` / `canHaveLines` predicates beside `isLeaf` in `bom.ts`
- [x] POST/PUT BOM lines and ingest use `canHaveLines`; PATCH guard checks the resulting floor+kind
- [x] Explode marks `containedBy`; roll-up skips contained rows; bundle root prices itself
- [x] `ExplodedRow.containedBy` in the OpenAPI schema; CSV `contained_by` column
- [x] Tests: explode, roll-up, CSV, part guard, demote-to-bundle, ingest bundle
- [x] Living specs `bom-compose`, `bom-ingest` and ADR-001 amended
