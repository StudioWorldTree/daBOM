# Design — add-price-access

Steer 2026-09-09. User activated all recommended forks.
Send-back 2026-09-09 (Fable): holes 1–3 closed as below.

## Ladder

1. Distributor API (Digi-Key, Mouser, Arrow) when a key/feed exists
2. Firecrawl on the public product page
3. Headed Playwright MCP — pop the GUI so the user can log in

B&H and Connect Tech / WDL start at step 2 or 3. First rung per vendor
is data on `vendors` in `add-price-skills`, not adapter code here.

## Quotes

`method` is `api` | `headed` | `crawl` | `seed` | `manual`. Insert a
new row. History stays. Price, URL, method, checkedAt are immutable
after insert. PATCH may change `isPreferred`, `notes`, `inStock` only.

A new row for the same (item, vendor) **supersedes**: it inherits
`isPreferred` from the previous row for that pair, and that previous
row’s preferred flag clears. Roll-up: latest row per vendor, then
preferred vendor; if no preferred vendor, rank methods
`api > headed > crawl > seed > manual`, then newest.

Failed fetches are not quotes. Do not insert a priceless row to record
a login wall.

`checkedAt` keeps its name. Seed rows get method `seed`. Human-typed
CTI quotes are `manual`.