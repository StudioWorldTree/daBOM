# Tasks

- [ ] Add `floor` on items (`buy` | `assemble` | `foundry`), default `buy`
- [ ] OpenAPI Item schema + create/patch include floor
- [ ] Explode / roll-up stop at `buy` and `foundry` leaves
- [ ] Migration on PGLite; `/.well-known/openapi.json` still serves
- [ ] 409 when adding a BOM line under a `buy` or `foundry` parent
- [ ] Tests: T4000-shaped item with floor=buy has empty BOM; assemble parent explodes to buy children; buy parent rejects children
