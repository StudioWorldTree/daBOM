# add-ingest-evidence

> **ACTIVE BUILD**

## Why

Once a source and an enrichment can be stored, ingest is the write that already knows which document a tree came from and which manufacturer, MPN, or note it recorded. That history has to land in the same transaction as the items. A second request after a successful ingest can crash and leave the kit with no document behind it.

## What

- Capability `bom-ingest`
- `POST /api/v1/ingest` ensures source rows and item links for the request source, each node source, and each locator in a node's `sources` array
- A created item records an `ingest` enrichment for each manufacturer, MPN, and note the payload set
- A matched item records an enrichment only for a manufacturer or MPN this request filled from null
- The link is the record of the document. Ingest does not also write an enrichment whose field is `source`
- No thoughts. No quotes. A non-2xx still writes nothing. A repeat POST does not duplicate the source, the link, or the same fact

## Impact

- Capabilities: MODIFIED `bom-ingest`
- ADRs: none. The evidence stores are `add-evidence`. This change is the ingest write using them

## User journey & surfaces

No new UI because ingest is the agent POST. The tree file is still the review artifact. Working: a 201 kit is linked to its document and the created parts carry enrichments. Failed: a 409 leaves no new source. Repeat: the same body does not double the history.

## Out of scope

- The evidence tables and their direct routes (`add-evidence`)
- Extracting URLs from markdown (`add-link-extract`). This change only stores locators the JSON already carries
- Changing fill-null, floor, mint, or cycle behavior
- Writing thoughts from a brief

## Campaign authority

Same grant as `add-evidence`: "activate all" on 2026-10-29, bounds unchanged. Dependency `add-evidence` has landed, so this banner is ACTIVE BUILD. `add-link-extract` stays PENDING until this node lands.

## Preparation

- Outcome: still valid as a contract. Not dispatchable. `add-evidence` has no landed artifact yet.
- Anchors: `src/lib/server/bom.ts` `walkIngest` / `matchIngestRow` / `createIngestRow`. `src/lib/server/api/schemas.ts` `IngestRequestSchema` already has `source`. `openspec/specs/bom-ingest/spec.md` requirement "Ingest is idempotent" still forbids quote writes.
- Authority: campaign bounds. Do not start `act` until `add-evidence` has landed and this banner is ACTIVE BUILD.

### Before act (2026-10-28)

- Outcome: still valid. No contract edit. Astra accept in `reviews/2026-10-29-re-advise.md` still covers this delta.
- Upstream: `add-evidence` is folded. Living spec `openspec/specs/bom-evidence/spec.md`. Commits `a58e71b` (stores and routes), `58152f0` (living spec), `0dd1bc0` (archive). `createSource`, `linkSource`, and `addEnrichment` exist. Ingest does not write them yet.
- Anchors unchanged: `walkIngest` still passes the request source to children. `matchIngestRow` still fills only a null manufacturer, MPN, or source. Idempotent ingest still writes no quotes.
- Authority: "activate all" plus `/run --go`. This node is dependency-ready. `add-link-extract` stays blocked.
