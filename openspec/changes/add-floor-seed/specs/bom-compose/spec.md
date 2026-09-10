## ADDED Requirements

### Requirement: Seeded catalog names the floor

The seeded catalog SHALL set `floor` on every item. T4000 SOM, the
preferred carrier, complete cinema bodies, RV1126B turret/core, and the
PoE switch SHALL be `buy`. Kits and sandwiches that have children SHALL
be `assemble`. Explode SHALL NOT emit a die under `t4000-som`.

#### Scenario: T4000 is a buy leaf

- GIVEN the seeded catalog
- WHEN GET `/api/v1/items/t4000-som/bom`
- THEN the line list is empty and the item’s `floor` is `buy`

#### Scenario: Production kit still explodes

- GIVEN the seeded catalog
- WHEN GET `/api/v1/items/kit-prod/bom?explode=true`
- THEN the exploded lines include buy leaves such as `t4000-som` and
  `rogue-t5` and do not include a foundry-level grandchild
