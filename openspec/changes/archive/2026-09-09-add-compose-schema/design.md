# Design — add-compose-schema

Steer 2026-09-09. User activated all recommended forks.

## Floor

An item has a manufacturing floor: `buy` | `assemble` | `foundry`.
Default for new catalog parts is `buy`. Explode and roll-up stop at
`buy` and `foundry` leaves. `assemble` has children. Foundry stays
unused until that SKU’s floor is raised.

T4000 SOM, Rogue-T5, PYXIS, RV1126B turret/core, PoE switch: `buy`.
kit-prod / asm-thor-sandwich: `assemble`.

## Identity

SKU is kebab-case. Prefer `manufacturer-mpn` slug; else name. No second
id space.

## Ingest (not this change)

POST /ingest will upsert through these tables. No draft store. Skills
will be HTTP clients. Schema must not assume skill-side SQL.
