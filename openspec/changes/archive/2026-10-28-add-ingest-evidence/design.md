# Design — add-ingest-evidence

Depends on the stores in `add-evidence`. Does not create them.

## What the body already says

`IngestRequest.source` and `IngestNode.source` stay a single locator string. `IngestNode` gains an optional `sources` array of `{ kind?, locator }`. `add-link-extract` is what fills that array. This change stores whatever the JSON names.

## Same transaction

Source ensures, item links, and ingest enrichments run on the ingest transaction, with the item and BOM writes. Any non-2xx rolls them back with the tree.

## Locators

Null, omitted, and whitespace-only `source` strings are not locators. They do not 422. That keeps a body which names no document.

Any other locator uses the evidence rule: a repository-relative path or an absolute `http`/`https` URL, identity after trim. `file://` and any other shape are 422 and write nothing, including no new item. This is narrower than today's unrestricted `source` string, and it applies only to locators this request asks to store. An item that already holds a legacy `items.source` is not revalidated when a match leaves that column alone.

Kind defaults to `link` for an absolute `http`/`https` URL and to `notebook` otherwise, unless the payload sets a kind. An existing row keeps the kind it already has.

The document is recorded as an `item_sources` link. `sources[]` entries are links only. Ingest does not also insert an enrichment with field `source`.

## Facts

An enrichment stores the value that was persisted on the item, not the raw payload.

`manufacturer` and `mpn` are trimmed, as they are today. A whitespace-only value persists nothing and writes no enrichment. `mpn: " ABC "` persists `ABC`, and the enrichment value is `ABC`.

`notes` are stored as given, including surrounding spaces. An enrichment is written when the persisted notes are non-null, and its value is that stored string. Omitted notes write no enrichment. This does not change how the item column is saved.

On create, those rules apply to `manufacturer`, `mpn`, and `notes`. On match, they apply only to a null `manufacturer` or `mpn` this request filled. Name, status, an existing note, and floor stay as they are.

## Which document the fact cites

The supporting document is the node's own `source` when that string is non-blank after trim, otherwise the source string the walk passed in. That passed string is the request source, including for a child that does not set its own. It is not the parent node's override. When both are blank, `sourceId` is null.

A match that fills an MPN cites that supporting document even when `items.source` already holds an older path and the column stays. The new link is the supporting document. The old column is not rewritten, and it is not what the new enrichment cites.

A repeat POST finds the same `(item, source, field, value)` enrichment and does not insert another. A different value is a new row.

No thoughts. No quotes.
