## ADDED Requirements

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
