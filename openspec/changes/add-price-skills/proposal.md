# add-price-skills

> **ACTIVE BUILD**

## Why

Quotes have method and provenance. Nothing yet fetches them. Seeded
street prices rot unless a skill walks the access ladder and POSTs
`/quotes`.

## What

- Skill `price-quote` in this repo: SKU/MPN → distributor API, else
  Firecrawl, else headed Playwright MCP
- Day-one APIs: Digi-Key, Mouser, Arrow. B&H and CTI/WDL start at crawl
  or headed
- POST `/api/v1/quotes` with method, url, cents, checkedAt. Failed fetch
  inserts nothing. Login wall pops the headed session
- HTTP only. No drizzle
- Capability: ADDED `price-skills`

## Impact

- Capabilities: ADDED `price-skills`
- ADRs: none (ladder already in ADR-003)

## User journey & surfaces

No new UI because quote lists already render on `/items/{sku}`. Headed
login is the existing Playwright MCP.

## Out of scope

- Octopart/Nexar
- Changing quote schema (`add-price-access`, folded)
- Ingest (`add-ingest-skills`)
