# Tasks

- [ ] POST `/api/v1/ingest` upserts items + BOM lines; no draft store
- [ ] OpenAPI + well-known spec list the operation (tag Ingest)
- [ ] JSON tree body is the write-through contract (nested children, qty, role)
- [ ] Markdown shopping-brief: `###` name + table PN → items; PDF is 415
- [ ] SKU mint: manufacturer-mpn slug, else name; identity match reuses seed SKU
- [ ] Slug collision with a different identity suffixes `-2`
- [ ] Parents with children get floor=assemble before lines insert; new leaves buy
- [ ] Second identical POST does not duplicate (parent, child) lines
- [ ] Existing buy/foundry leaf that would receive children is 409
- [ ] Tests: Thor shopping-brief excerpt yields kit-prod-shaped T4000 + carrier
      without hand-authoring every line; NVIDIA 900-13834-0000-000 reuses
      `t4000-som`; PDF POST is 415
