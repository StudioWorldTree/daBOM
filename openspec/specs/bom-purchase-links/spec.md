# bom-purchase-links

What **is** built: standing purchase links per item (`add-purchase-links`).

## Purpose

Keep the places a part is bought at next to the part, independent of
whether a price has been seen there yet, and let those places name the
vendor for quotes so a quote can be posted from a URL alone.

## Requirements

### Requirement: Purchase links are a resource on items

The system SHALL store purchase links as (item, URL, vendor, label,
vendorSku, notes), unique per (item, URL), and SHALL serve
`GET/POST /items/{sku}/purchase-links` and `PATCH/DELETE /purchase-links/{id}`.
`GET /items/{sku}` SHALL include `purchaseLinks`. PATCH SHALL NOT change the
URL (it is the link's identity). DELETE SHALL keep quotes seen at that URL.

#### Scenario: Duplicate URL

- GIVEN `pl-board` lists `https://www.wdlsystems.com/pl-board?variant=4gb`
- WHEN the same URL is posted again
- THEN 409 with the existing `purchaseLinkId`

### Requirement: URLs are normalized

The system SHALL accept only absolute http(s) URLs (else 422) and SHALL drop
the fragment and tracking params (`utm_*`, `spm`, `scm`, `ref`, `gclid`,
`fbclid`, `tag`, …) before storing or matching, on links and on quotes.

### Requirement: The vendor comes from the link or the host

With no `vendorId`, the vendor SHALL be the item's purchase link for that
URL, else the single vendor whose home URL has the same host (ignoring
`www.`). A marketplace host that no single vendor owns SHALL be 422 asking
for `vendorId`.

#### Scenario: Marketplace quote by URL

- GIVEN `pl-board` has an alibaba.com link under vendor `pl-seller`
- WHEN POST `/quotes` `{itemSku: pl-board, url: <that url>?spm=…, priceCents}`
- THEN 201 with `vendorId: pl-seller` and the normalized URL

### Requirement: Quotes and links agree

A quote whose named `vendorId` contradicts the item's link for its URL
SHALL be 409. A quote with neither `vendorId` nor a resolvable URL SHALL be 422. Every accepted quote URL SHALL be recorded as a purchase link under
the quote's vendor if not already listed. Migration 0005 and seed SHALL
backfill links from existing quote URLs.

### Requirement: The price ladder walks purchase links

`skills/price-quote` SHALL try every vendor an item has a purchase link
for, and SHALL start the crawl rung at that vendor's purchase link before
falling back to the latest quote URL or a search.
