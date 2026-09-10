# Tasks

- [x] Add `floor` on items (`buy` | `assemble` | `foundry`), default `buy`
- [x] OpenAPI Item schema + create/patch include floor
- [x] Explode / roll-up stop at `buy` and `foundry` leaves
- [x] Migration on PGLite; `/.well-known/openapi.json` still serves
- [x] 409 when adding a BOM line under a `buy` or `foundry` parent
- [x] Tests: T4000-shaped item with floor=buy has empty BOM; assemble parent explodes to buy children; buy parent rejects children
- [x] (reader) Migration + seed backfill: `floor = 'assemble'` for every SKU that is a parent in `bom_lines`; test that seeded kit-prod still explodes after migrate
- [x] (reader) 409 on PATCH floor to `buy`/`foundry` when the item already has BOM children; roll-up partCount and leaf sum use the same floor predicate as explode
