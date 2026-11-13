# add-purchase-links

**Rigor:** change

## Why

A part's buy URLs lived only on quote rows, so a place to buy with no price
yet had nowhere to go, and a quote always had to name its vendor even when
the URL already said who sells it.

## What

- Capability `bom-purchase-links` (new): `purchase_links` table, `/items/{sku}/purchase-links`, `/purchase-links/{id}`
- `POST /quotes`: `vendorId` optional when `url` resolves it; URL normalized; quote URLs remembered as links; 409 on vendor contradiction
- Migration 0005 + seed backfill links from quote URLs
- price-quote skill: link vendors join the ladder; crawl starts at the link
- UI: "Where to buy" on the item page; quote vendor links to its URL

## User journey & surfaces

Item page lists where to buy, each with the newest price seen at that URL.

## Out of scope

- Adding links from the UI (API/agent only for now)
- Price tiers / MOQ on links (tiers belong on quotes)
