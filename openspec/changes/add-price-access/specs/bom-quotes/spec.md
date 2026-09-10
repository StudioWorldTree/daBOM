## ADDED Requirements

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

### Requirement: Roll-up ranks methods

Roll-up SHALL pick the latest quote per vendor, then the preferred
vendor if one is marked. If no vendor is preferred, it SHALL rank
methods `api` then `headed` then `crawl` then `seed` then `manual`,
then newest.

#### Scenario: API beats a later crawl

- GIVEN Digi-Key quotes on one SKU: method `api` dated Sep 1 and method `crawl` dated Sep 8, both priced
- WHEN GET `/api/v1/items/{sku}/rollup`
- THEN the Digi-Key contribution is the Sep 1 api price

### Requirement: Price access ladder

A quote refresh SHALL try a distributor API (Digi-Key, Mouser, Arrow)
before a crawl, and a crawl before a headed browser. A login wall SHALL
surface a headed Playwright session rather than fail closed with no
prompt. Failed fetches SHALL NOT insert a quote row. This change
specifies the contract; adapter skills land in `add-price-skills`.

#### Scenario: Login wall is headed not a quote

- GIVEN a vendor page that requires login and no API
- WHEN a refresh cannot complete unauthenticated
- THEN no new quote row is inserted; headed is the next step
