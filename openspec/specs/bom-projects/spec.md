# bom-projects

What **is** built: projects and derived variants (`add-projects`).

## Purpose

Group the kits a product line ships (its variants) with the assemblies and
bundles they share, so the crib reads as projects rather than a flat list.

## Requirements

### Requirement: Projects are a resource

The system SHALL store projects with a kebab-case `slug`, a `name` and a
`description`, and SHALL serve `GET/POST /projects` and
`GET/PATCH/DELETE /projects/{slug}`. POST of an existing slug SHALL be 409.
DELETE SHALL keep the member items and set their `project` to null.

#### Scenario: Delete frees members

- GIVEN project `px` with member `px-2gb`
- WHEN DELETE `/api/v1/projects/px`
- THEN GET `/projects/px` is 404 and `px-2gb.project` is null

### Requirement: Items name at most one project

Every item SHALL carry a nullable `project`. POST and PATCH `/items` SHALL
accept `project`; a slug that is not a project SHALL be 422. `GET /items`
SHALL filter by `?project=`.

#### Scenario: Unknown project

- WHEN POST `/api/v1/items` with `project: "no-such-project"`
- THEN the response is 422

### Requirement: Variants are derived

A project's `variants` SHALL be its member items of kind `kit` with floor
`assemble` that no other member's BOM consumes, ordered by name with
numeric collation. Every other member SHALL be listed in `shared`.

#### Scenario: Size variants share a core

- GIVEN project kits `px-2gb`, `px-8gb`, `px-16gb`, each consuming member
  assembly `px-core`
- WHEN GET `/api/v1/projects/px`
- THEN `variants` is `px-2gb, px-8gb, px-16gb` and `shared` is `px-core`

#### Scenario: Seeded camera

- GIVEN a fresh seed
- WHEN GET `/api/v1/projects/ai-camera`
- THEN `variants` is Cart T, C, S and the hybrid plant, and `shared` is `kit-sat`

### Requirement: PATCH is sparse

PATCH `/items/{sku}` and PATCH `/items/{sku}/bom/{lineId}` SHALL change only
the fields named in the body. Create defaults SHALL NOT apply on PATCH.

#### Scenario: Assigning a project keeps the floor

- GIVEN `kit-prod` with floor `assemble` and status `preferred`
- WHEN PATCH `{ notes: "x" }`
- THEN floor, status and description are unchanged
