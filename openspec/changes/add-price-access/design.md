# Design — add-price-access

Steer 2026-09-09. User activated all recommended forks.

## Ladder

1. Distributor API (Digi-Key, Mouser, Arrow) when a key/feed exists
2. Firecrawl on the public product page
3. Headed Playwright MCP — pop the GUI so the user can log in

B&H and Connect Tech / WDL start at step 2 or 3.

## Quotes

Insert a new row. Do not update away history. `isPreferred` marks the
roll-up pick. `method` is `api` | `crawl` | `headed`. URL and as-of
required on fetched quotes (seed placeholders may omit URL).
