## ADDED Requirements

### Requirement: Sources are shared rows

The system SHALL store a source as its own row with a kind of `notebook`, `datasheet`, `link`, or `analysis`, a locator, and an optional title. The locator SHALL be a repository-relative path or an absolute `http` or `https` URL, and it SHALL be unique after trim. POST `/api/v1/sources` with a locator that already exists SHALL return the existing row and SHALL NOT insert a second row or change that row's kind or title. The well-known OpenAPI document SHALL list the operation.

#### Scenario: Second post of the same path

- GIVEN a source whose locator is `../AICamera/docs/SHOPPING.md`
- WHEN POST `/api/v1/sources` sends that locator and a different title
- THEN one source row exists, the response is that row, and the title is unchanged

### Requirement: Items link to sources

The system SHALL link an item to a source without writing an enrichment or a thought. POST `/api/v1/items/{sku}/sources` SHALL accept a source id or a locator. A locator that is new SHALL create the source and then link it. A second link of the same item and source SHALL NOT insert a duplicate. A missing SKU, or a source id that does not exist, SHALL be 404 and SHALL write nothing. A locator that is empty after trim, or that is neither a repository-relative path nor an absolute `http` or `https` URL, SHALL be 422 and SHALL write nothing.

#### Scenario: Link by locator

- GIVEN item `t4000-som` and no source for `https://example.com/t4000`
- WHEN POST `/api/v1/items/t4000-som/sources` sends that locator and kind `link`
- THEN GET `/api/v1/items/t4000-som/evidence` includes that source, and the item's manufacturer, mpn, notes, and source columns are unchanged

#### Scenario: Missing source id writes nothing

- GIVEN item `t4000-som`
- WHEN POST `/api/v1/items/t4000-som/sources` sends a source id that does not exist
- THEN the response is 404 and the item has no new link

### Requirement: Enrichments are append-only facts

The system SHALL store an enrichment on an item with a stable id, a server-assigned `createdAt`, the observed value, an optional field name, an optional body, an optional source id, and a method of `ingest` or `manual`. POST `/api/v1/items/{sku}/enrichments` SHALL insert a row and SHALL NOT change any column on the item. A source id that does not exist SHALL be 404 and SHALL write nothing. The OpenAPI enrichment object SHALL include `id` and `createdAt`. GET `/api/v1/items/{sku}/evidence` SHALL list enrichments by `createdAt` ascending, then id ascending. The system SHALL NOT expose an operation that updates or deletes a single enrichment. GET `/api/v1/items/{sku}/evidence` SHALL list every enrichment on that item. The well-known OpenAPI document SHALL list the POST and SHALL NOT list a PATCH or DELETE of one enrichment.

#### Scenario: Two facts stay

- GIVEN item `t4000-som`
- WHEN two enrichments are posted with different values
- THEN evidence lists both in `createdAt` then id order, the two ids differ, both `createdAt` values are present, and GET `/api/v1/items/t4000-som` shows the same manufacturer, mpn, notes, and source as before the posts

#### Scenario: Enrichment citing a missing source writes nothing

- GIVEN item `t4000-som`
- WHEN POST an enrichment whose source id does not exist
- THEN the response is 404 and the item has no enrichment

#### Scenario: Stored fact survives a rewrite attempt

- GIVEN an enrichment id
- WHEN a client sends PATCH or DELETE for that enrichment
- THEN the stored value is unchanged

### Requirement: Thoughts are append-only

The system SHALL store a thought on an item with a stable id, a server-assigned `createdAt`, a non-empty body, and zero or more cited source ids. POST `/api/v1/items/{sku}/thoughts` SHALL insert the thought and SHALL NOT change `items.notes` or any other item column. The OpenAPI thought object SHALL include `id` and `createdAt`. GET `/api/v1/items/{sku}/evidence` SHALL list thoughts by `createdAt` ascending, then id ascending. A cited source id that does not exist SHALL be 404 and SHALL write nothing. The system SHALL NOT expose an operation that updates or deletes a single thought. GET `/api/v1/items/{sku}/evidence` SHALL list every thought on that item.

#### Scenario: Thought cites a source

- GIVEN a source row and item `t4000-som`
- WHEN POST `/api/v1/items/t4000-som/thoughts` sends a non-empty body citing that source
- THEN evidence lists the thought and the source, and `items.notes` is unchanged

#### Scenario: Missing citation writes nothing

- GIVEN item `t4000-som`
- WHEN POST a thought citing a source id that does not exist
- THEN the response is 404 and the item has no thought

### Requirement: Evidence reads both ways

GET `/api/v1/items/{sku}/evidence` SHALL return the sources linked to the item, the sources cited by its enrichments and thoughts, its enrichments, and its thoughts. GET `/api/v1/sources/{id}` SHALL return the source and every item that links it or cites it from an enrichment or a thought. A missing SKU or source id SHALL be 404.

#### Scenario: From the document back to the item

- GIVEN `t4000-som` linked to a source
- WHEN GET `/api/v1/sources/{id}` for that source
- THEN the body names `t4000-som`

### Requirement: Backfill existing source strings

On an existing database, migration SHALL insert one source of kind `notebook` for each distinct `items.source` that is non-empty after trim, reusing a locator that already exists, and SHALL link each such item to that source. It SHALL NOT clear or rewrite `items.source`. It SHALL NOT insert enrichments or thoughts for that backfill. A legacy locator that is not a repository-relative path or an absolute `http` or `https` URL SHALL still be linked and SHALL NOT fail the migration.

A fresh boot SHALL migrate before seed. After the catalog seed, the same catalog links SHALL exist as they would after upgrading a database that already held those rows.

`DABOM_RESEED=1` SHALL delete thought-source joins, thoughts, enrichments, and item-source links before it deletes items, and SHALL then insert the catalog. After that reseed, the catalog links SHALL match a fresh boot. The reseed SHALL NOT fail on a foreign key from those tables.

POST `/api/v1/sources` SHALL treat a locator and the same locator with surrounding whitespace as one row. A locator that is empty after trim, or that is neither a repository-relative path nor an absolute `http` or `https` URL, SHALL be 422 and SHALL write nothing.

#### Scenario: Seeded shopping path is a source

- GIVEN seeded items whose source is `../AICamera/docs/SHOPPING.md`
- WHEN the migration has run on that existing database
- THEN one source row has that locator, each of those items is linked to it, and their source column is still that path

#### Scenario: Fresh boot links the catalog

- GIVEN an empty database
- WHEN the app migrates and then seeds the catalog
- THEN each distinct non-empty catalog `items.source` is one notebook source, and each seeded item with that source is linked to it

#### Scenario: Forced reseed links the catalog again

- GIVEN a database that has been seeded, including an enrichment on a catalog item
- WHEN seed runs with force
- THEN the reset completes, that enrichment is gone, and the catalog source links match a fresh boot

#### Scenario: Whitespace is the same locator

- GIVEN a source whose locator is `../AICamera/docs/SHOPPING.md`
- WHEN POST `/api/v1/sources` sends that locator with surrounding spaces
- THEN one source row exists and its locator is the trimmed path

### Requirement: Item delete removes its evidence and keeps shared sources

DELETE `/api/v1/items/{sku}` SHALL, when the item is on no BOM, remove that item's quotes, links, enrichments, thoughts, and thought-source joins in one transaction, then remove the item. If that transaction fails, the item, its quotes, and its evidence SHALL be unchanged. The BOM-in-use 409 SHALL still happen before any of those deletes. A source that another item reaches by a link, an enrichment, or a thought SHALL remain. A source that nobody reaches MAY remain.

#### Scenario: Shared notebook survives

- GIVEN two items linked to the same source, and the deleted item is on no BOM
- WHEN DELETE the first item
- THEN the source still exists and the second item is still linked to it

#### Scenario: Another item's enrichment or thought keeps the source

- GIVEN item A cites a source only from an enrichment, item B cites it only from a thought, and item C is linked to it and is on no BOM
- WHEN DELETE item C
- THEN the source still exists, A's enrichment still cites it, and B's thought still cites it

#### Scenario: A failed delete leaves history

- GIVEN an item on no BOM with a quote and an enrichment
- WHEN deletion aborts after the quote row would have been removed
- THEN the item still exists, the quote is still there, and the enrichment is still there

### Requirement: Quotes stay quotes

The system SHALL NOT store a price, a vendor, or a quote method on a source, an enrichment, or a thought. Posting an enrichment or a thought SHALL NOT insert a quote.

#### Scenario: Enrichment is not a quote

- GIVEN item `t4000-som` has N quotes
- WHEN an enrichment is posted on that item
- THEN the item still has N quotes
