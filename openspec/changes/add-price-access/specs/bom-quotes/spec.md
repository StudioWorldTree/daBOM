## ADDED Requirements

### Requirement: Quote provenance

The system SHALL store on each quote a method of `api`, `crawl`,
`headed`, or `seed`, plus optional source URL. Fetched quotes (api,
crawl, headed) SHALL include a checked-at date.

#### Scenario: API quote records method

- GIVEN item `t4000-som` and vendor `arrow`
- WHEN POST `/api/v1/quotes` with method `api`, a URL, and price cents
- THEN GET `/api/v1/items/t4000-som` includes that quote with method `api`

### Requirement: Quotes are append-only history

The system SHALL keep prior quotes when a new quote is added for the
same item. Roll-up SHALL use the preferred quote with a price, else the
latest priced quote.

#### Scenario: Second fetch keeps the first

- GIVEN an existing preferred quote on `t4000-som`
- WHEN POST `/api/v1/quotes` for the same item with a new price
- THEN both quotes are listed and roll-up uses the preferred row until it is changed

### Requirement: Price access ladder

A quote refresh SHALL try a distributor API (Digi-Key, Mouser, Arrow)
before a crawl, and a crawl before a headed browser. A login wall SHALL
surface a headed Playwright session rather than fail closed with no
prompt. This change specifies the contract; adapter skills land in
`add-price-skills`.

#### Scenario: Login wall is headed not silent fail

- GIVEN a vendor page that requires login and no API
- WHEN a refresh cannot complete unauthenticated
- THEN the recorded outcome is not an empty fail with no method; headed is the next step
