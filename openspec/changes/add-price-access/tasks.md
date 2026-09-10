# Tasks

- [ ] Quote column `method`: `api` | `headed` | `crawl` | `seed` | `manual`; keep `checkedAt` name
- [ ] OpenAPI Quote create includes method and url; PATCH is only isPreferred, notes, inStock
- [ ] POST /quotes does not delete prior quotes; same (item, vendor) supersedes preferred flag
- [ ] pickQuote: latest per vendor, then preferred vendor, else method rank api>headed>crawl>seed>manual then newest
- [ ] Document ladder in OpenAPI description / well-known spec
- [ ] Tests: two quotes on one SKU both persist; Digi-Key api Sep 1 beats crawl Sep 8; PATCH cannot change priceCents
- [ ] Seed backfill: existing quotes get method=seed (or manual for quote-only CTI)