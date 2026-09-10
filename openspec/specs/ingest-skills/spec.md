# ingest-skills

What **is** built: HTTP-only ingest skill (`add-ingest-skills`).

## Purpose

Agents turn a hardware brief, notebook page, or datasheet into a JSON
ingest tree and POST it. The skill is an HTTP client. The tree file is
the review artifact; the POST is the commit. A document is a menu; a
BOM is a selection from it.

## Requirements

### Requirement: Ingest skill is HTTP-only

The repo SHALL ship a skill that turns a hardware source into a JSON
ingest tree and POSTs `/api/v1/ingest`. The skill SHALL NOT import
drizzle, SHALL NOT open `data/dabom/`, SHALL NOT import `$lib/server`,
and SHALL NOT run SQL.

#### Scenario: Shopping brief becomes a kit via HTTP

- GIVEN the ingest skill and a running daBOM API
- WHEN an agent follows the skill against the production cart in
  `SHOPPING.md`
- THEN POST `/api/v1/ingest` is called and the kit BOM includes
  `t4000-som` without a skill-side database write

### Requirement: Tree file before POST

The skill SHALL write an `IngestRequest` JSON file and SHALL NOT POST
until that file has been read. The parser SHALL emit candidates
(heading, optional manufacturer, mpn, notes). The tree SHALL be
composed from a selection (a named cart section, an argument list of
MPNs, or a hand edit of the tree file), not from every heading that
has a `PN` row.

#### Scenario: Production kit is not the shopping menu

- GIVEN the whole `SHOPPING.md`
- WHEN the skill composes the production kit (`Cart T`) tree file
- THEN the file contains the T4000 SOM and the Rogue-T5 and does not
  contain the AGX Thor Developer Kit

### Requirement: PDF goes through pdf2md

A PDF source SHALL be converted with `pdf2md` before the candidate
path. The skill SHALL NOT parse PDF bytes itself. No PDF or markdown
parser SHALL be added to the app `package.json` or under `src/`.

#### Scenario: Datasheet PDF

- GIVEN a datasheet PDF
- WHEN the skill ingests it
- THEN `pdf2md` runs first and the JSON tree file is what a later
  POST `/ingest` sees
