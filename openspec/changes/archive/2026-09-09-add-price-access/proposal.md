# add-price-access

> **ACTIVE BUILD**

## Why

Seeded street prices rot. Scraping first burns ToS and misses feeds that
already exist. Quotes need a method, a URL, and an as-of so roll-up is
honest.

## What

- Access ladder: Digi-Key, Mouser, Arrow **API** first; Firecrawl after API miss; headed Playwright MCP when the wall is a login
- B&H and CTI/WDL are crawl/headed fallbacks, not day-one APIs
- Quote rows append-only; same (item, vendor) supersedes preferred; PATCH cannot change price/url/method/checkedAt
- Provenance: method `api|headed|crawl|seed|manual`, URL, checkedAt
- Roll-up: latest per vendor, preferred vendor, else method rank api>headed>crawl>seed>manual
- Capability: `bom-quotes`
- Vendor adapter skills are `add-price-skills`

## Impact

- Capabilities: ADDED `bom-quotes`
- ADRs: none until fold (money + access ladder)

## User journey & surfaces

No new UI because quote lists already render on `/items/{sku}`; this change is OpenAPI + schema for method/provenance. Headed login is the existing Playwright MCP, not a new page.

## Out of scope

- Implementing Digi-Key/Mouser/Arrow clients (`add-price-skills`)
- Item floor (`add-compose-schema`)
- Ingest (`add-ingest-api`)
- Octopart/Nexar aggregator
