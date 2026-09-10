## ADDED Requirements

### Requirement: Quote skill walks the access ladder

The repo SHALL ship a skill that refreshes a SKU or MPN quote by trying
a distributor API (Digi-Key, Mouser, Arrow) first, then a crawl of the
public product page, then a headed Playwright session. The skill SHALL
POST `/api/v1/quotes` and SHALL NOT write PGLite.

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
