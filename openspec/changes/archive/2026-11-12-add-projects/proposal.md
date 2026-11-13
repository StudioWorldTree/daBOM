# add-projects

**Rigor:** change

## Why

The crib home listed every kit flat. EdgeBox ships one core in five RAM
sizes; the camera ships Cart T/C/S. Those are variants of one project.
The page tops also carried slogan copy instead of saying what page you are on.

## What

- Capability `bom-projects` (new): `projects` table, `items.project`, `/projects` CRUD, derived variants/shared
- Seed: `ai-camera` project with the camera kits
- Fix: PATCH item / BOM line no longer re-applies create defaults
- UI: plain page titles (Projects, Items); home grouped by project; variant switcher on a variant's item page; nav "Crib" → "Projects"

## User journey & surfaces

Home: one section per project, variant cards with roll-ups, shared members
listed under. Item page: crumb links to the project; a variant shows its
sibling variants as a switcher.

## Out of scope

- Ingest setting `project` on tree nodes
- A dedicated `/projects/{slug}` page (home anchors stand in)
