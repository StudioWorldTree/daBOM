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

### Requirement: Selected-line URLs ride the tree

The composer SHALL add, on each selected node, a `sources` entry for every markdown link URL and every bare `http` or `https` URL written on that selected line. It SHALL still drop price text. It SHALL NOT invent a URL. A URL that appears only on a part the selection did not pick SHALL NOT appear on the tree. A hand edit of the tree file MAY remove a `sources` entry, and the POST SHALL send that edited file. The skill SHALL NOT POST `/api/v1/sources` or `/api/v1/items/{sku}/enrichments`. The only write SHALL remain POST `/api/v1/ingest`.

#### Scenario: One URL on a selected line

- GIVEN a selected line whose markdown contains one `https` URL
- WHEN the tree file is composed
- THEN that node's `sources` includes that URL, and the file contains no price text

#### Scenario: A rejected heading keeps its URL

- GIVEN a document where a URL appears only under a heading the selection did not pick
- WHEN the tree file is composed
- THEN that URL is not in the file

#### Scenario: Two URLs both ride along

- GIVEN a selected line that contains two `https` URLs
- WHEN the tree file is composed
- THEN that node's `sources` includes both

#### Scenario: Hand edit is what gets posted

- GIVEN a tree file whose `sources` array was emptied by a hand edit
- WHEN the skill posts that file
- THEN the POST body is the edited file and the skill does not call POST `/api/v1/sources`
