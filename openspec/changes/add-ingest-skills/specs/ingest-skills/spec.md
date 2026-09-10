## ADDED Requirements

### Requirement: Ingest skill is HTTP-only

The repo SHALL ship a skill that turns a hardware source into a JSON
ingest tree and POSTs `/api/v1/ingest`. The skill SHALL NOT import
drizzle, SHALL NOT open `data/dabom/`, and SHALL NOT run SQL.

#### Scenario: Shopping brief becomes a kit via HTTP

- GIVEN the ingest skill and a markdown excerpt of the T4000 SOM and
  preferred carrier
- WHEN an agent follows the skill against a running daBOM API
- THEN POST `/api/v1/ingest` is called and the kit BOM includes
  `t4000-som` without a skill-side database write

### Requirement: PDF goes through pdf2md

A PDF source SHALL be converted with `pdf2md` before the markdown path.
The skill SHALL NOT parse PDF bytes itself.

#### Scenario: Datasheet PDF

- GIVEN a datasheet PDF
- WHEN the skill ingests it
- THEN `pdf2md` runs first and the JSON tree is what POST `/ingest` sees
