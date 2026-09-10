# Architecture

Living. ADRs inline. Amend rather than delete when reality diverges.

This file answers *why it is shaped this way*. Behavior that is true of the
running system belongs in `openspec/specs/`.

---

### ADR-001: Manufacturing floor on items ✅

**Status:** Accepted 2026-09-09 (`add-compose-schema`).
**Blast:** `items` schema, explode, partCount, roll-up.

**Decision.** Every item has `floor`: `buy` | `assemble` | `foundry`. The
column lives on `items`, orthogonal to `kind`. Explode, partCount, and
roll-up share one leaf predicate (`floor !== 'assemble'`). `buy` and
`foundry` are identical at runtime; foundry is vocabulary reserved for a
die-level breakdown this shop must not descend. New items default `buy`.
Existing parents in `bom_lines` backfill to `assemble`.

**Why.** `part` / `assembly` / `kit` cannot say “stop here, we buy this.”
Agents ingesting hardware will explode a SOM into a die unless the floor
is in the schema. T4000 SOM is a leaf until a foundry is contracted.

**Consequences.**

- Floor is not on `bom_lines`. Opening a child is a property of the child
  in this shop, not of one parent line.
- POST/PUT a BOM line under a non-assemble parent is 409. PATCH floor to
  `buy` / `foundry` while children exist is 409.
- Kind stays taxonomy. `kind=kit, floor=buy` (a bought dev kit) is legal.
- Global floor per shop. Same SKU bought in one product and built in
  another makes the column lie; per-line override is a later escape hatch.

**Not decided here.** Ingest (`add-ingest-api`). Catalog retag beyond parent
backfill (`add-floor-seed`).

**Living spec:** [`openspec/specs/bom-compose/spec.md`](openspec/specs/bom-compose/spec.md)

---

### ADR-002: SKU kebab identity ✅

**Status:** Accepted 2026-09-09 (`add-compose-schema`).
**Blast:** item primary key.

**Decision.** Items are identified by a kebab-case SKU
(`^[a-z0-9][a-z0-9-]*$`). Mixed-case create is 422. This change does not
auto-mint on POST `/items`; ingest will mint from manufacturer+MPN or name.

**Why.** One id space. Prefer manufacturer-MPN slug, else name. Changing
PKs on the seed is a migration, not a retag.

**Not decided here.** Collision rule and ingest mint (`add-ingest-api`).

---

### ADR-003: Quotes are append-only; access ladder ranks methods ✅

**Status:** Accepted 2026-09-09 (`add-price-access`).
**Blast:** `quotes` schema, `pickQuote`, roll-up DTO, PATCH `/quotes/{id}`.

**Decision.** A quote is an observation: method (`api` | `headed` |
`crawl` | `seed` | `manual`), optional URL, integer cents, `checkedAt`.
POST inserts a new row. History stays. Price, URL, method, and
`checkedAt` are immutable after insert. PATCH may change `isPreferred`,
`notes`, and `inStock` only, and only the latest row for an
(item, vendor) may become preferred (else 422). A new row for the same
pair inherits `isPreferred` and clears it on the previous row.

Access ladder: distributor API (Digi-Key, Mouser, Arrow) before crawl
(Firecrawl) before headed Playwright. Failed fetches insert nothing.
B&H and CTI/WDL start at crawl or headed.

Roll-up: within a vendor, method rank `api > headed > crawl > seed >
manual`, then newest. Across vendors, the preferred vendor if its chosen
row is priced, else the same rank then newest. Priceless rows never win.
Roll-up DTO `asOf` is the minimum `checkedAt` among chosen priced quotes.

**Why.** Seeded street prices rot. Scraping first burns ToS and misses
feeds that already exist. A mutable price plus a history table doubles
the schema for no gain. Method rank keeps a vendor’s API speaking over a
later crawl of the same page; `asOf` is what stops that being a silent
lie.

**Consequences.**

- Corrections are a new row with method `manual`, not a PATCH of cents.
- Seed backfill is `method=seed`; human-typed CTI quotes are `manual`.
- Adapter HTTP clients are `add-price-skills`, not this change.
- `DELETE /items/{sku}` still deletes quotes: the item is gone.

**Not decided here.** Vendor API adapters (`add-price-skills`). Ingest
(`add-ingest-api`).

**Living spec:** [`openspec/specs/bom-quotes/spec.md`](openspec/specs/bom-quotes/spec.md)

---

### ADR-004: Ingest is write-through; mint and collision are ordered ✅

**Status:** Accepted 2026-09-09 (`add-ingest-api`).
**Blast:** `POST /ingest`, item identity, BOM write-through.

**Decision.** `POST /api/v1/ingest` upserts `items` and `bom_lines` in
one transaction. No draft store. JSON tree only; markdown and PDF are
415. Any non-2xx rolls the whole tree back. Quotes are not written.

Identity per node, in this order: (manufacturer, MPN) pair match
(reuse that SKU even if the payload supplied a different one); MPN-only
when incoming manufacturer is null (exactly one row, else 409); supplied
kebab sku (create if new, 422 if not kebab); mint from pair or name.
A supplied sku is a reference: an incoming node with no pair never
collides, so a supplied existing sku matches. A minted slug is a guess:
landing on a row that carries a pair is 409. No `-2` suffix. Matched
rows fill null `manufacturer`, `mpn`, or `source` only. Name-minted
creates default `status: placeholder` on the ingest node schema; POST
`/items` still defaults `candidate`.

Floor: new items default `buy`. New nodes that list children are set
`assemble` before lines insert. Promotion is new nodes only; hanging
children on an existing `buy` or `foundry` parent is 409. Lines go
through `addBomLine` on the transaction handle. Re-POST sets qty on
`(parent, child, role)`.

201 body: per node `sku`, `action` `created` | `matched`, `floor`, and
line ids.

**Why.** Agents ingesting a shopping brief must write a nested BOM
through REST. There is no draft store and no skill-side SQL. Pair match
first so a brief with a real MPN does not fork a seed because the agent
guessed a sku. Promoting an existing `buy` parent would explode a SOM;
the floor and cycle doors on `addBomLine` are the same doors a
single-line POST uses.

**Consequences.**

- Skills stay HTTP clients (`add-ingest-skills`).
- Markdown and PDF parsers are not this route.
- Seed PK migrations and numeric SKU suffixes (`-2`) stay out.
- Catalog floor retag is `add-floor-seed`.

**Not decided here.** Markdown/PDF parsers (`add-ingest-skills`). Catalog
floor retag (`add-floor-seed`).

**Living spec:** [`openspec/specs/bom-ingest/spec.md`](openspec/specs/bom-ingest/spec.md)
