# bom-quotes

What **is** built: street quotes, method provenance, and price access
(`add-price-access`).

## Purpose

Quotes are append-only observations of a price at a moment. A refresh
inserts a row; it never rewrites money. Roll-up ranks methods so a
distributor API speaks over a later crawl of the same page, and the
total says how old it is.

## Requirements

### Requirement: Quote provenance

The system SHALL store on each quote a method of `api`, `headed`,
`crawl`, `seed`, or `manual`, plus optional source URL. Fetched quotes
(api, crawl, headed) SHALL include a checked-at date named `checkedAt`.

#### Scenario: API quote records method

- GIVEN item `t4000-som` and vendor `arrow`
- WHEN POST `/api/v1/quotes` with method `api`, a URL, and price cents
- THEN GET `/api/v1/items/t4000-som` includes that quote with method `api`

### Requirement: Quotes are append-only history

The system SHALL keep prior quotes when a new quote is added for the
same item. The system SHALL NOT let PATCH change `priceCents`, `url`,
`method`, or `checkedAt`. PATCH MAY change `isPreferred`, `notes`, and
`inStock`.

#### Scenario: Second fetch keeps the first

- GIVEN an existing quote on `t4000-som` for vendor `arrow`
- WHEN POST `/api/v1/quotes` for the same item and vendor with a new price
- THEN both quotes are listed

#### Scenario: PATCH cannot rewrite a price

- GIVEN a quote id for `t4000-som`
- WHEN PATCH `/api/v1/quotes/{id}` with a new `priceCents`
- THEN the response is 422 and the stored price is unchanged

### Requirement: Same vendor supersedes preferred

When a new quote is posted for the same (item, vendor) as an existing
row, the new row SHALL inherit that row’s `isPreferred` and the previous
row SHALL have `isPreferred` cleared.

#### Scenario: Refresh inherits preferred

- GIVEN a preferred `seed` quote on `t4000-som` for vendor `arrow`
- WHEN POST `/api/v1/quotes` for `t4000-som` / `arrow` with method `api` and a price
- THEN the new row is preferred, the seed row is not, and roll-up uses the api price

### Requirement: Prefer only the current row

PATCH `isPreferred: true` on a quote that is not the latest row for its
(item, vendor) SHALL be 422. Latest is the most recently inserted row
for that pair.

#### Scenario: Superseded row cannot be preferred

- GIVEN two quotes on `t4000-som` / `arrow`, seed then a later api
- WHEN PATCH `/api/v1/quotes/{id}` sets `isPreferred: true` on the seed row
- THEN the response is 422
- WHEN the same PATCH targets the latest api row
- THEN the response is 200 and that row is preferred

### Requirement: Roll-up ranks methods

Within a vendor, roll-up SHALL rank methods `api` then `headed` then
`crawl` then `seed` then `manual`, then newest. Across vendors it
SHALL pick the preferred vendor if that vendor's chosen row is priced,
else the same method rank, then newest. Priceless rows SHALL NOT win.

#### Scenario: API beats a later crawl

- GIVEN Digi-Key quotes on one SKU: method `api` dated Sep 1 and method `crawl` dated Sep 8, both priced
- WHEN GET `/api/v1/items/{sku}/rollup`
- THEN the Digi-Key contribution is the Sep 1 api price

#### Scenario: Preferred vendor wins only if priced

- GIVEN item `cti-msg103` with a preferred CTI row that has no price and a priced WDL crawl
- WHEN GET `/api/v1/items/cti-msg103/rollup`
- THEN the total uses the WDL price

### Requirement: Roll-up as-of

The roll-up DTO SHALL include `asOf` equal to the minimum `checkedAt`
among the chosen priced quotes that contribute to the total, or null if
none of those quotes carry a date.

#### Scenario: asOf is the oldest chosen date

- GIVEN Digi-Key quotes on one SKU: method `api` dated 2026-09-01 and method `crawl` dated 2026-09-08, both priced
- WHEN GET `/api/v1/items/{sku}/rollup`
- THEN `asOf` is `2026-09-01`

### Requirement: Price access ladder

A quote refresh SHALL try a distributor API (Digi-Key, Mouser, Arrow)
before a crawl, and a crawl before a headed browser. A login wall SHALL
surface a headed Playwright session rather than fail closed with no
prompt. Failed fetches SHALL NOT insert a quote row. Adapter skills land
in `add-price-skills`.

#### Scenario: Login wall is headed not a quote

- GIVEN a vendor page that requires login and no API
- WHEN a refresh cannot complete unauthenticated
- THEN no new quote row is inserted; headed is the next step

#### Scenario: Fetched quote without a price is not stored

- GIVEN item `cti-msg103`
- WHEN POST `/api/v1/quotes` with method `crawl` and `priceCents` null
- THEN the response is 422 and no new quote row exists
