## ADDED Requirements

### Requirement: Ingest writes through

The system SHALL accept `POST /api/v1/ingest` and upsert items and BOM
lines through the existing tables. The system SHALL NOT keep a draft
store. The well-known OpenAPI document SHALL list the operation.

#### Scenario: JSON tree becomes a kit

- GIVEN a JSON ingest body whose root is a kit with two buy children
- WHEN POST `/api/v1/ingest`
- THEN GET `/api/v1/items/{root}/bom` returns those children and the
  well-known spec lists `POST /ingest`

### Requirement: Source kinds

The system SHALL accept a JSON tree and markdown shopping-brief text.
The system SHALL reject `application/pdf` (and a URL that resolves to
PDF) with 415. Markdown SHALL treat a `###` heading as an item name and
a table row labeled `PN` as that item’s MPN.

#### Scenario: Thor shopping brief

- GIVEN markdown excerpted from the T4000 SOM and Rogue-T5 sections of
  the camera shopping brief, rooted as a production kit
- WHEN POST `/api/v1/ingest` with that markdown
- THEN the kit’s BOM includes the T4000 SOM and the preferred carrier
  without a client POSTing each `/items` and `/bom` line

#### Scenario: PDF is not parsed here

- GIVEN a PDF body
- WHEN POST `/api/v1/ingest`
- THEN the response is 415

### Requirement: SKU mint and collision

The system SHALL mint a kebab SKU from `{manufacturer}-{mpn}` when both
are present, else from the name. Slugs SHALL be lowercase with
non-alphanumerics collapsed to hyphens. When manufacturer and MPN match
an existing item, the system SHALL reuse that SKU. A minted slug that
collides with a different identity SHALL gain a numeric suffix (`-2`).

#### Scenario: Seed identity wins

- GIVEN seeded item `t4000-som` with manufacturer NVIDIA and MPN
  `900-13834-0000-000`
- WHEN ingest names that module without supplying sku `t4000-som`
- THEN no new SKU is created and the BOM child is `t4000-som`

### Requirement: Ingest respects floor

The system SHALL default new ingest items to `buy`. The system SHALL set
a node that lists children to `assemble` before inserting its BOM lines.
The system SHALL reject ingest that would hang children on an existing
`buy` or `foundry` item with 409.

#### Scenario: Cannot explode a buy SOM via ingest

- GIVEN `t4000-som` with floor `buy`
- WHEN ingest tries to attach a die child under it
- THEN the response is 409 and the SOM BOM stays empty

### Requirement: Ingest is idempotent

A second identical POST SHALL NOT insert duplicate `(parent, child)`
BOM lines. Ingest SHALL NOT write quote rows.

#### Scenario: Repeat POST

- GIVEN a successful ingest of a two-child kit
- WHEN the same body is posted again
- THEN the kit still has two lines and quote count is unchanged
