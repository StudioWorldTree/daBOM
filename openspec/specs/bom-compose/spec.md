# bom-compose

What **is** built: nested BOMs and manufacturing floor (`add-compose-schema`);
seeded catalog names floor (`add-floor-seed`).

## Purpose

Items carry a manufacturing floor so explode and roll-up stop at what this
shop buys. Nested BOM stays parent/child lines; floor is a field on the item.
The seed catalog tags every row; explode does not infer floor from BOM
membership.

## Requirements

### Requirement: Manufacturing floor on every item

The system SHALL store a manufacturing floor on each item of `buy`,
`assemble`, or `foundry`. New items SHALL default to `buy`.

#### Scenario: SOM is a buy leaf

- GIVEN an item with floor `buy` and SKU `t4000-som`
- WHEN a client GET `/api/v1/items/t4000-som/bom`
- THEN the BOM line list is empty even if a die-level breakdown is known to the operator

#### Scenario: Kit assembles to buy leaves

- GIVEN a parent with floor `assemble` and children that are `buy`
- WHEN a client GET `/api/v1/items/{parent}/bom?explode=true`
- THEN the exploded lines include the buy children and do not invent foundry-level grandchildren

### Requirement: Explode respects floor

The system SHALL treat `buy` and `foundry` items as leaves for explode
and roll-up. The system SHALL recurse only through `assemble` items.
The system SHALL reject BOM lines whose parent floor is not `assemble`.

#### Scenario: Foundry reserved

- GIVEN an item with floor `foundry` and no children
- WHEN explode runs on a kit that includes it
- THEN that item appears as a leaf

#### Scenario: Cannot hang children on a buy leaf

- GIVEN item `t4000-som` with floor `buy`
- WHEN POST `/api/v1/items/t4000-som/bom` with a child
- THEN the response is 409

### Requirement: SKU kebab identity

The system SHALL identify items by a kebab-case SKU (`^[a-z0-9][a-z0-9-]*$`).
Ingest (`add-ingest-api`) mints SKUs from manufacturer+MPN or name; this
change does not auto-mint on POST `/items`.

#### Scenario: Reject mixed-case SKU

- GIVEN a create body with sku `T4000-SOM`
- WHEN POST `/api/v1/items`
- THEN the response is 422

### Requirement: Seeded catalog names the floor

The seeded catalog SHALL set `floor` on every item. The catalog type
SHALL require `floor` of `buy` or `assemble` (`foundry` is reserved and
SHALL NOT appear in the seed). T4000 SOM, the preferred carrier,
complete cinema bodies, RV1126B turret/core, the PoE switch, and the
resin shells SHALL be `buy`. Kits and assemblies that have children
SHALL be `assemble`. Explode SHALL NOT emit a die under `t4000-som`.
A catalog-level test SHALL import `seedItems` and `seedBoms` and assert
every `seedBoms` parent is `assemble` in the catalog, every non-parent
is `buy`, and no row is `foundry`.

#### Scenario: T4000 is a buy leaf

- GIVEN the seeded catalog
- WHEN GET `/api/v1/items/t4000-som/bom`
- THEN the line list is empty and the item’s `floor` is `buy`

#### Scenario: Production kit still explodes

- GIVEN the seeded catalog
- WHEN GET `/api/v1/items/kit-prod/bom?explode=true`
- THEN the exploded lines include buy leaves such as `t4000-som` and
  `rogue-t5` and do not include a foundry-level grandchild

#### Scenario: Catalog rows are tagged, not inferred

- GIVEN `seedItems` and `seedBoms` imported from the catalog module
- WHEN a test walks those arrays with no database
- THEN every parent SKU in `seedBoms` has `floor` `assemble` on its
  catalog row, every other catalog row has `floor` `buy`, and none is
  `foundry`
