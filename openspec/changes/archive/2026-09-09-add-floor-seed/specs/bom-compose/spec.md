## ADDED Requirements

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
