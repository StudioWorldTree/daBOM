# Tasks

- [ ] POST `/api/v1/ingest` upserts items + BOM lines in one transaction; no draft store
- [ ] OpenAPI + well-known spec list the operation (tag Ingest)
- [ ] JSON tree body is the only write-through contract (nested children, qty, role)
- [ ] Non-JSON (markdown, PDF) is 415
- [ ] Identity order: pair match, MPN-only, supplied sku, mint; different identity is 409
- [ ] Matched rows: fill nulls only; seed name/status survive
- [ ] Parents with children: new or buy → assemble before lines; foundry parent 409
- [ ] Re-POST sets qty on `(parent, child, role)`; no duplicate lines
- [ ] 201 body: each node sku, action created|matched, floor, line ids
- [ ] Tests: JSON Thor kit yields T4000 + carrier without per-line POSTs;
      NVIDIA 900-13834-0000-000 reuses `t4000-som`; name-collide with an
      MPN row is 409 and writes nothing; PDF POST is 415
      Reader-added (advise, fable-5.1-arch-review):

- [x] Pin slug once (NFKD, drop non-ASCII, hyphen non-alnum, empty → 422)
- [x] MPN-only match when incoming manufacturer is null; two rows → 409
- [x] Name-minted slug vs row with no pair is the same identity (reuse)
- [x] Supplied new kebab sku is created as given
- [x] Matched seed is not overwritten (name/status survive; fill nulls)
- [x] One transaction; non-2xx writes nothing
- [x] 201 response contract
- [x] Drop markdown parser from this route (skills own it)
- [x] Collision test shape: new root + seed match by MPN + name-collide 409

Reader-added (re-advise, fable-5.1-arch-review, accept):

- [ ] Floor: strike "or currently buy" from delta and design; promotion is new nodes only, existing buy/foundry parent is 409 (per "Cannot explode a buy SOM")
- [ ] Identity: an incoming node with no (manufacturer, mpn) pair never collides; supplied existing sku matches
- [ ] Scenario: MPN-only match reuses `t4000-som`; two rows sharing an MPN is 409
- [ ] Delta: add a SHALL sentence for the 201 body (sku, action, floor, line ids)
- [ ] Name-minted creates default `status: placeholder` (ingest node schema, not `ItemCreateSchema`'s `candidate`)
- [ ] Lines go through `addBomLine` / `wouldCycle` with the transaction handle; cycle by sku reference is 409
