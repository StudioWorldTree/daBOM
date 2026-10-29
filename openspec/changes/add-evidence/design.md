# Design — add-evidence

Steer 2026-10-29. Duke took the recommended fork on each menu.

## Three stores

`sources` — one row per document or link. `kind` is `notebook`, `datasheet`, `link`, or `analysis`. `locator` is a repository-relative path or an absolute `http`/`https` URL, unique after trim. Optional `title`. A second POST of the same locator returns the existing row and does not change kind or title.

`item_sources` — the bare link from an item to a source. This is what backfill writes, and what a person uses when the document is not yet a fact or a thought. Unique on `(item, source)`.

`enrichments` — append-only. Item, optional source, optional `field` (`manufacturer`, `mpn`, or `notes` when the fact is one of those), required `value`, optional `body`, `method` `ingest` or `manual`. No price and no vendor. Posting one does not update `items`. There is no PATCH and no DELETE of one row.

`thoughts` — append-only non-empty `body` on an item. `thought_sources` cites existing sources. A missing citation is 404 and writes nothing. Posting one does not change `items.notes`. There is no PATCH and no DELETE of one row.

`method` is a label, not a rank. Enrichments do not compete the way quotes do.

## Reads

`GET /items/{sku}/evidence` returns the item's links, the sources those links and citations point at, the enrichments, and the thoughts.

`GET /sources/{id}` returns the source and every item that reaches it by a link, an enrichment, or a thought.

## Backfill, boot, and reseed

Migration runs before seed (`openDb`). An upgrade of a database that already has items inserts one `notebook` source per distinct `items.source` that is non-empty after trim, reuses a locator that already exists, and links those items. The column is not cleared. No enrichment is invented for that text.

A fresh boot migrates an empty database, then seed inserts the catalog. The same links SHALL exist after that seed. The migration alone cannot see those rows.

`DABOM_RESEED=1` deletes items. It deletes `thought_sources`, thoughts, enrichments, and `item_sources` first so the new foreign keys do not block the reset. After the catalog is inserted again, the catalog links match a fresh boot. Source rows may remain. Orphan collection is not required.

A locator that is empty after trim is not a source. A legacy `items.source` that is non-empty but not a path or an `http`/`https` URL is still linked, kind `notebook`, and is not rewritten. New POSTs reject that shape with 422. Identity is the trimmed locator, so surrounding whitespace is the same row.

A missing source id on a link or an enrichment is 404 and writes nothing, the same as a thought citation.

## Time

Enrichments and thoughts get a stable id and a server-assigned `createdAt` at insert. Evidence lists return each history by `createdAt` ascending, then id ascending. That orders two facts. It does not apply the later one to the item.

## Delete

`DELETE /items/{sku}` keeps the BOM-in-use 409, then removes that item's quotes, links, enrichments, thoughts, and thought-source joins in one transaction. A failure after the first delete statement leaves all of them in place. A source still reached from another item, by a link or by an enrichment or a thought, stays. A source nobody cites may stay.

## Apply

Copying a fact onto a column is the existing item PATCH. This change does not add an apply route.
