# steer add-price-skills

**When.** 2026-09-09 (epic steer on price-access)
**Depth.** standard

## Decided

- Digi-Key, Mouser, Arrow APIs first
- B&H / CTI crawl or headed, not day-one API
- Headed login: Playwright MCP, pop GUI
- Quotes append-only (already in the API)

## Feeds change

Adapter HTTP in a skill. First rung per vendor is data, not a new table
in this change unless `vendors` already holds it.
