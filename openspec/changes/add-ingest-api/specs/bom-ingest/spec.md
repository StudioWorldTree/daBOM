## ADDED Requirements

### Requirement: Ingest writes through

The system SHALL accept `POST /api/v1/ingest` and upsert items and BOM
lines through the existing tables in one transaction. The system SHALL
NOT keep a draft store. Any non-2xx response SHALL write nothing. The
well-known OpenAPI document SHALL list the operation.

#### Scenario: JSON tree becomes a kit

- GIVEN a JSON ingest body whose root is a kit with two buy children
- WHEN POST `/api/v1/ingest`
- THEN the response is 201, each node includes `sku`, `action` of
  `created` or `matched`, `floor`, and line ids, GET
  `/api/v1/items/{root}/bom` returns those children, and the well-known
  spec lists `POST /ingest`

#### Scenario: Failed child writes nothing

- GIVEN a JSON body whose root is new and a child would hang under
  seeded `t4000-som`
- WHEN POST `/api/v1/ingest`
- THEN the response is 409 and the new root SKU does not exist

### Requirement: Source kinds

The system SHALL accept `application/json` only. The system SHALL
reject markdown and `application/pdf` with 415. Markdown and PDF
parsers live in `add-ingest-skills`.

#### Scenario: Thor shopping kit as JSON

- GIVEN a JSON tree of the T4000 SOM (NVIDIA, MPN `900-13834-0000-000`)
  and the preferred carrier, rooted as a production kit
- WHEN POST `/api/v1/ingest`
- THEN the kit’s BOM includes `t4000-som` and the preferred carrier
  without a client POSTing each `/items` and `/bom` line

#### Scenario: PDF is not parsed here

- GIVEN a PDF body
- WHEN POST `/api/v1/ingest`
- THEN the response is 415

### Requirement: SKU mint and collision

The system SHALL slug by lowercasing, NFKD-stripping non-ASCII, and
collapsing non-alphanumerics to hyphens. An empty slug SHALL be 422.
The system SHALL resolve identity in this order: (manufacturer, MPN)
pair match; MPN-only match when incoming manufacturer is null (exactly
one row, else 409); supplied kebab sku (create if new, 422 if not
kebab); mint from pair or name. A minted or supplied sku that collides
with a different identity SHALL be 409. A name-minted slug that hits a
row with no manufacturer/MPN SHALL reuse that row. Matched rows SHALL
NOT be overwritten except to fill null `manufacturer`, `mpn`, or
`source`.

#### Scenario: Seed identity wins

- GIVEN seeded item `t4000-som` with manufacturer NVIDIA and MPN
  `900-13834-0000-000`
- WHEN ingest names that module without supplying sku `t4000-som`
- THEN no new SKU is created, the BOM child is `t4000-som`, and the
  seed `name` and `status` are unchanged

#### Scenario: Name collision with an identified part is 409

- GIVEN a new root, a child that matches a seed by MPN, and a second
  child whose minted name-slug equals an existing item that has an MPN
- WHEN POST `/api/v1/ingest`
- THEN the response is 409 and nothing is written

### Requirement: Ingest respects floor

The system SHALL default new ingest items to `buy`. The system SHALL set
a node that lists children to `assemble` before inserting its BOM lines
when that node is new or currently `buy`. The system SHALL reject ingest
that would hang children on an existing `buy` or `foundry` item, or
retag a `foundry` parent, with 409.

#### Scenario: Cannot explode a buy SOM via ingest

- GIVEN `t4000-som` with floor `buy`
- WHEN ingest tries to attach a die child under it
- THEN the response is 409, the SOM BOM stays empty, and no new root
  from that body exists

### Requirement: Ingest is idempotent

A second identical POST SHALL match `(parent, child, role)` and set
qty. It SHALL NOT insert duplicate BOM lines. Ingest SHALL NOT write
quote rows.

#### Scenario: Repeat POST

- GIVEN a successful ingest of a two-child kit
- WHEN the same body is posted again
- THEN the kit still has two lines, qty is the payload qty, and quote
  count is unchanged
