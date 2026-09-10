# Tasks

- [x] Quote column `method`: `api` | `headed` | `crawl` | `seed` | `manual`; keep `checkedAt` name
- [x] OpenAPI Quote create includes method and url; PATCH is only isPreferred, notes, inStock
- [x] POST /quotes does not delete prior quotes; same (item, vendor) supersedes preferred flag
- [x] pickQuote: latest per vendor, then preferred vendor, else method rank api>headed>crawl>seed>manual then newest
- [x] Document ladder in OpenAPI description / well-known spec
- [x] Tests: two quotes on one SKU both persist; Digi-Key api Sep 1 beats crawl Sep 8; PATCH cannot change priceCents
- [x] Seed backfill: existing quotes get method=seed (or manual for quote-only CTI)
      Reader-added (advise 2, fable-5.1-arch-review):

- [ ] Reword roll-up rule in design + delta: within a vendor rank method then newest; across vendors preferred vendor, else method rank, then newest (scenario "API beats a later crawl" is the truth)
      — NOT DONE HERE: `design.md` and the spec delta are outside this node's
      write paths. The reworded rule is implemented and stated in the
      `pickQuote` doc comment (`src/lib/server/bom.ts`) and in the OpenAPI
      `info.description`; fold should copy that wording, not the old sentence.
- [x] Preferred vendor wins only if its chosen row is priced; else fall to method rank (seed `cti-msg103` has a preferred priceless CTI row)
- [x] PATCH isPreferred on a row that is not latest for its (item, vendor) is 422
- [x] Rollup DTO gains `asOf` = min checkedAt across chosen priced quotes
