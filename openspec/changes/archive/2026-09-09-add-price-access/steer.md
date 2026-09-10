# steer add-price-access

**When.** 2026-09-09
**Depth.** standard

## Decided

- First sources: distributor APIs Digi-Key, Mouser, Arrow (user, agreed recommended)
- B&H / CTI: crawl or headed, not day-one API ([AUTO] with recommend)
- Headed login: Playwright MCP, pop GUI ([AUTO])
- Quotes append-only + preferred ([AUTO])

## Skipped

none — Octopart/Nexar not chosen

## Feeds change

Quote schema gains method/URL/as-of. Refresh behavior is API then crawl
then headed. Adapter code waits for add-price-skills.
