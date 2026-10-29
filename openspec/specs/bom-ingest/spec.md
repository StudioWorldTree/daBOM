# bom-ingest

What **is** built: write-through JSON ingest (`add-ingest-api`).

## Purpose

Agents write a nested BOM through REST in one transaction. There is no
draft store. JSON tree is the only body; identity is pair match, then
MPN-only, then supplied sku, then mint. Matched seed rows are not
overwritten.

## Requirements

### Requirement: Ingest writes through

The system SHALL accept `POST /api/v1/ingest` and upsert items and BOM
lines through the existing tables in one transaction. The system SHALL
NOT keep a draft store. Any non-2xx response SHALL write nothing. The
well-known OpenAPI document SHALL list the operation. The 201 body SHALL
report, for every node in the tree, its `sku`, an `action` of `created`
or `matched`, its `floor`, and the ids of the BOM lines from that node to
its children. BOM lines SHALL be inserted through the same floor and
cycle guards as `POST /items/{sku}/bom`, using the transaction handle, so
a cycle closed by a `sku` reference is 409.

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
parsers live in `ingest-skills`.

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
with a different identity SHALL be 409. An incoming node with no
(manufacturer, mpn) pair never collides: a supplied existing sku
matches. A minted slug that lands on a row carrying a pair SHALL be
409. A name-minted slug that hits a row with no manufacturer/MPN SHALL
reuse that row. Matched rows SHALL NOT be overwritten except to fill
null `manufacturer`, `mpn`, or `source`. Name-minted creates SHALL
default `status` to `placeholder` unless the payload set one.

#### Scenario: MPN alone resolves a seeded part

- GIVEN a node carrying MPN `900-13834-0000-000`, no manufacturer, and no
  sku
- WHEN POST `/api/v1/ingest`
- THEN the node resolves to `t4000-som` with `action` `matched`, and a
  node carrying an MPN that two items share is 409

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
when that node is new. Promotion is for new nodes only: the system SHALL
reject ingest that would hang children on an existing `buy` or `foundry`
item, or retag a `foundry` parent, with 409.

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

### Requirement: Ingest records sources and enrichments in the same transaction

POST `/api/v1/ingest` SHALL, in the same transaction as the item and BOM writes, ensure a source row for each locator it accepts, and SHALL link each of those sources to the resolved item. A locator is accepted when it is a repository-relative path or an absolute `http` or `https` URL after trim. The request source, a node source, and each entry in a node's `sources` array are candidates. Null, omitted, and whitespace-only candidates are not locators and SHALL NOT be a 422. Any other shape, including a `file:` URL, SHALL be 422 and SHALL write nothing. A locator and the same locator with surrounding whitespace SHALL be one source. When the payload omits kind, an absolute `http` or `https` URL SHALL be kind `link` and a path SHALL be kind `notebook`. An existing source SHALL keep the kind it already has. This validation applies to locators this request stores. A match that leaves an existing `items.source` unchanged SHALL NOT revalidate that stored string.

When the request creates an item, it SHALL write an enrichment with method `ingest` for each persisted `manufacturer`, `mpn`, and `notes`. `manufacturer` and `mpn` SHALL be trimmed first. A whitespace-only manufacturer or MPN persists null and SHALL NOT produce an enrichment. The enrichment value SHALL be the persisted value, so a padded MPN is recorded without the padding. `notes` SHALL be stored as given, and the enrichment value SHALL be that stored string, including surrounding spaces. Omitted or null notes SHALL NOT produce an enrichment.

The enrichment's source SHALL be the node's own source when that string is non-blank after trim, otherwise the source string passed down the walk. A child that does not set `source` SHALL cite the request source, not a parent node's override. When both are blank, the enrichment SHALL have a null source. Entries in `sources` SHALL be links and SHALL NOT become the field citation unless one of them is that supporting document.

When the request matches an item, it SHALL write an enrichment only for a `manufacturer` or `mpn` that this request filled from null, using the same trim and the same supporting-document rule. It SHALL NOT write an enrichment for a column it did not change. It SHALL NOT cite the item's previous `items.source` when this request's supporting document is different. It SHALL NOT write an enrichment whose field is `source`.

The system SHALL NOT write a thought from ingest. The system SHALL NOT write a quote from ingest. A non-2xx response SHALL leave sources, links, and enrichments unchanged. A second POST of the same body SHALL NOT insert a second source for the same locator, a second link for the same item and source, or a second enrichment with the same item, source, field, and value.

#### Scenario: Created part records the document and the MPN

- GIVEN no item for a new MPN, and a body whose source is `../AICamera/docs/SHOPPING.md` and whose node sets that MPN
- WHEN POST `/api/v1/ingest` returns 201
- THEN the new item is linked to that notebook source, one enrichment with method `ingest` records the MPN, and that item has no quotes

#### Scenario: Node locator becomes a link

- GIVEN a node whose `sources` array names `https://example.com/datasheet`
- WHEN POST `/api/v1/ingest` returns 201 for a new item
- THEN that item's evidence includes a link source with that locator

#### Scenario: Failed ingest writes no source

- GIVEN a body whose root is new and a child would hang under seeded `t4000-som`, and whose source locator does not yet exist
- WHEN POST `/api/v1/ingest` returns 409
- THEN that locator is not a source row and the new root SKU does not exist

#### Scenario: Repeat POST does not duplicate

- GIVEN a successful ingest that linked a source and wrote an MPN enrichment
- WHEN the same body is posted again
- THEN one source row exists for that locator, one link exists for that item and source, and one enrichment exists for that field and value

#### Scenario: Match records only a filled MPN

- GIVEN an item matched by sku whose `mpn` is null and whose `items.source` is `../AICamera/docs/OLD.md`
- WHEN ingest supplies `mpn` ` ABC ` and request source `../AICamera/docs/SHOPPING.md`
- THEN the item's `mpn` is `ABC`, `items.source` is still `../AICamera/docs/OLD.md`, and one ingest enrichment records `ABC` citing the shopping document
- WHEN the same body is posted again
- THEN the item still has one enrichment for that field and value

#### Scenario: Padding and blank fields

- GIVEN a new node with manufacturer `   `, mpn ` ABC `, and notes `  pad  `
- WHEN POST `/api/v1/ingest` returns 201
- THEN the item's manufacturer is null, its mpn is `ABC`, its notes are `  pad  `, there is no manufacturer enrichment, the MPN enrichment value is `ABC`, and the notes enrichment value is `  pad  `

#### Scenario: A bad locator writes nothing

- GIVEN a new root whose source is `file:///tmp/brief.pdf`
- WHEN POST `/api/v1/ingest`
- THEN the response is 422, that root SKU does not exist, and no source row exists for that locator

#### Scenario: A child keeps the request source

- GIVEN a request source `../AICamera/docs/A.md`, a parent node whose source is `../AICamera/docs/B.md` and whose new child sets an MPN and no source
- WHEN POST `/api/v1/ingest` returns 201
- THEN the parent's enrichment cites B, the child's enrichment cites A, and the child is linked to A
