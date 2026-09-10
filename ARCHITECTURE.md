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
