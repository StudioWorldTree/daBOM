# price-skills

What **is** built: HTTP-only quote-refresh skill (`add-price-skills`).

## Purpose

Agents refresh a SKU or MPN quote by walking the access ladder and
POSTing `/quotes`. The skill is an HTTP client. A failed fetch is not
a quote. The posted `method` is the rung that produced the price.

## Requirements

### Requirement: Quote skill walks the access ladder

The repo SHALL ship a skill that refreshes a SKU or MPN quote by trying
a distributor API (Digi-Key, Mouser, Arrow) first, then a crawl of the
public product page, then a headed Playwright session. The skill SHALL
POST `/api/v1/quotes` and SHALL NOT write PGLite. The skill SHALL NOT
import drizzle, SHALL NOT open `data/dabom/`, SHALL NOT import
`$lib/server`, and SHALL NOT run SQL.

#### Scenario: Arrow API quote

- GIVEN item `t4000-som` and a working Arrow API
- WHEN the skill refreshes that SKU
- THEN a quote row exists with method `api`, cents, a URL, and checkedAt

### Requirement: Login wall is not a quote

A fetch that cannot complete unauthenticated SHALL NOT insert a quote
row. The next step SHALL be a headed Playwright session so a human can
sign in.

#### Scenario: Login wall

- GIVEN a vendor page that requires login and no API
- WHEN the skill cannot complete unauthenticated
- THEN no new quote row is inserted

### Requirement: API rung matches manufacturer part number exactly

The API rung SHALL POST only when the result's manufacturer part
number equals `items.mpn` exactly (case and surrounding whitespace
MAY differ; dashes and suffixes SHALL NOT). A null `mpn` SHALL skip
the API rung. A fuzzy hit SHALL be a failed fetch, not a quote row.

#### Scenario: Fuzzy API hit is not a quote

- GIVEN item `t4000-som` with mpn `900-13834-0000-000`
- WHEN the Arrow API returns `900-13834-0000-001`
- THEN no quote row is inserted and the ladder moves to the next rung

#### Scenario: Null mpn skips the API rung

- GIVEN an item with a null `mpn`
- WHEN the skill refreshes that SKU
- THEN the API rung is skipped

### Requirement: Quantity-1 unit price recorded in notes

The posted `priceCents` SHALL be the unit price at quantity 1. The
skill SHALL record the price-break tier in `notes`. When the vendor's
lowest published tier is a minimum order quantity above 1, that tier
SHALL be the posted unit price and the note SHALL say so.

#### Scenario: Quantity-1 Arrow break

- GIVEN an Arrow API offer with qty-1 and qty-10 breaks
- WHEN the skill refreshes `t4000-som`
- THEN the posted row uses the qty-1 unit price and `notes` names that tier

#### Scenario: Vendor minimum above quantity 1

- GIVEN an API offer whose lowest break is quantity 5
- WHEN the skill takes a unit price
- THEN the posted cents are the qty-5 unit price and `notes` name the vendor minimum

### Requirement: Crawl URL from latest quote else search

The crawl rung SHALL fetch the `url` on the latest quote row for that
(item, vendor) when present. Otherwise it SHALL Firecrawl-search
manufacturer plus MPN scoped to the vendor domain. The URL actually
fetched SHALL be posted on the new row.

#### Scenario: Latest quote URL is crawled

- GIVEN a B&H quote row that carries a product URL
- WHEN the skill crawls that vendor
- THEN the posted row has method `crawl` and that URL

#### Scenario: No prior URL searches the vendor domain

- GIVEN no quote row with a URL for that (item, vendor)
- WHEN the skill crawls
- THEN Firecrawl search runs on manufacturer plus MPN scoped to the
  vendor domain and the fetched URL is posted
