# bom-compose

What **is** built: nested BOMs and manufacturing floor (`add-compose-schema`).

## Purpose

Items carry a manufacturing floor so explode and roll-up stop at what this
shop buys. Nested BOM stays parent/child lines; floor is a field on the item.

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
