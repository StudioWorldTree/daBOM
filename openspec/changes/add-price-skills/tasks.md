# Tasks

- [ ] `skills/price-quote/SKILL.md`: ladder API → Firecrawl → headed; HTTP-only
- [ ] Try Digi-Key / Mouser / Arrow when a key/feed exists; else crawl; else headed
- [ ] POST `/api/v1/quotes` with method `api|crawl|headed`, url, cents, checkedAt
- [ ] Failed fetch or login wall: no quote row; headed session is the next step
- [ ] Tests: refreshing `t4000-som` with a mocked Arrow API writes method=api;
      a login-wall mock inserts nothing
