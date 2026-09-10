# Tasks

- [x] `skills/price-quote/SKILL.md`: ladder API → Firecrawl → headed; HTTP-only
- [x] Try Digi-Key / Mouser / Arrow when a key/feed exists; else crawl; else headed
- [x] POST `/api/v1/quotes` with method `api|crawl|headed`, url, cents, checkedAt
- [x] Failed fetch or login wall: no quote row; headed session is the next step
- [x] Tests: refreshing `t4000-som` with a mocked Arrow API writes method=api;
      a login-wall mock inserts nothing

Reader pins (advise 2026-09-09, fable-5.1-arch-review):

- [x] API rung posts only when the result's manufacturer part number equals `items.mpn` exactly; null `mpn` skips the API rung; a fuzzy hit is a failed fetch, not a row
- [x] Price break: unit price at quantity 1; record the tier in `notes`
- [x] Crawl rung URL: latest quote row's `url` for that (item, vendor), else Firecrawl search on manufacturer + MPN scoped to the vendor domain; the fetched URL goes on the posted row
