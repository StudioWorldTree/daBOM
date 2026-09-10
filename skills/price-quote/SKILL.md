---
name: price-quote
description: Refresh a daBOM price quote by walking the access ladder — distributor API, then a Firecrawl of the public page, then a headed Playwright session. Use when asked to price a SKU or MPN, refresh a quote, check what a vendor charges now, or fill a missing quote. POSTs /api/v1/quotes; a failed fetch writes nothing.
---

# Refresh a quote in daBOM

The ladder is **API → crawl → headed**, per vendor, and the `method` on the
posted row is the rung that actually produced the price. A crawl result posted
as `api` corrupts roll-up rank, which is the only thing `method` is for.

## The rules that are not negotiable

**HTTP only.** The single write is `POST /api/v1/quotes` against a running
server. Do not open the local Postgres file, do not import the app's server
code, do not run SQL. If the server is not running, start it (`npm run dev`)
or stop.

**A failed fetch is not a quote.** Login wall, 403, parse miss, a listing with
no price — every one of those inserts nothing and drops to the next rung. Do
not invent a price, do not post it as `manual`, do not PATCH an old row.
Quotes are append-only and the server already 422s a fetched row with no
price or no date; never route around that.

**`checkedAt` is your fetch date**, `YYYY-MM-DD`, never a date lifted off the
page or copied from the seed row.

**Keys come from the environment.** `DIGIKEY_CLIENT_ID` /
`DIGIKEY_ACCESS_TOKEN`, `MOUSER_API_KEY`, `ARROW_LOGIN` / `ARROW_API_KEY`,
`FIRECRAWL_API_KEY`. Never commit one, never paste one into a file here. The
headed Playwright profile stays on the machine and out of the repo.

## The ladder

### 1. API — Digi-Key, Mouser, Arrow

Only these three have a day-one API. B&H and CTI/WDL start at the crawl rung.

The rung posts **only on an exact manufacturer part number match** against
`items.mpn`. A keyword search at Digi-Key or Mouser happily returns a nearby
part, and a near-miss posted as `api` out-ranks the correct price in the
roll-up, which is worse than no row. An item with a null `mpn` skips this rung
entirely. A fuzzy hit is a failed fetch, not a row.

Price is the **unit price at quantity 1**. Distributors publish tiers; the
quote holds one number. The tier that applied goes in `notes`, so a later
change can move to BOM-line quantity without re-reading history. When the
vendor's lowest tier is a minimum order quantity above 1, that tier is the
honest answer and the note says so.

US locale is pinned on every client, so `currency` stays `USD`. A response
priced in another currency fails the rung.

### 2. Crawl — Firecrawl on the public product page

The URL is the `url` on the **latest quote row for that (item, vendor)**.
Seeded rows often carry none, and the `vendors` table holds only a homepage,
so with no prior URL the rung runs a Firecrawl search on manufacturer plus MPN
scoped to the vendor's domain. The URL actually fetched goes on the posted
row, so the next run does not search again.

Read the page yourself before you trust the extracted number. A distributor
page opens with accessory and bundle prices; the extractor prefers a labelled
price but it is a heuristic, not a contract. If the number looks like an
accessory, treat the rung as a parse miss and go headed.

### 3. Headed — Playwright MCP

Not a code path. Pop the browser, let a human sign in, read the price, then
post it yourself with `method: headed`. Until that happens the item simply has
no fresh row, which is the correct state.

## Running it

```bash
DABOM_API_BASE=http://localhost:5173/api/v1 \
  npx tsx skills/price-quote/scripts/refresh.ts t4000-som --vendor arrow
```

Without `--vendor` the ladder runs for every vendor the item already has a
quote from, plus the three API vendors once the item carries an MPN. One
vendor failing or rate-limiting does not abort the rest; each vendor reports
its own rungs. `--dry-run` walks the ladder and prints the row without writing
it.

The headed rung's write, after a human has signed in and read the price:

```bash
DABOM_API_BASE=http://localhost:5173/api/v1 \
  npx tsx skills/price-quote/scripts/post-quote.ts \
    --sku rogue-t5 --vendor cti --cents 249900 \
    --url https://connecttech.com/product/rogue-t5/ --notes 'headed, signed in'
```

It accepts `headed` and `crawl` only. `manual` and `seed` are a human
correcting the crib, not this skill.

## Reading the output

Each vendor prints its rungs in order, `ok` or `skip` with a reason:

```
t4000-som / arrow
  ok   api
  wrote api 299900 USD https://www.arrow.com/en/products/900-13834-0000-000/nvidia
t4000-som / bh
  skip api — bh has no day-one API
  skip crawl — https://www.bhphotovideo.com/... holds its price behind a sign-in
  skip headed — needs a headed Playwright session
```

The second block is a correct, complete run. No row was written for B&H and
the next step is a browser.

## When POST /quotes does not return 201

Show the body. A 404 is a missing item or vendor — fix the SKU or add the
vendor, do not retarget the quote. A 422 is the server refusing a fetched row
with no price or no date, which means the rung should have failed; find out
which rung lied about its price rather than filling the field in.

## Adding a vendor API

`API_VENDORS` in `lib/api.ts` is request-building only. Responses are read by
walking for the keys distributors use (`ManufacturerPartNumber`, `partNum`,
`BreakQuantity`, `resalePrice`, and friends) rather than by three brittle path
readers, so a new vendor usually needs only its URL, its auth header, and a
fixture in `lib/fixtures.ts`.

## Tests

`skills/price-quote/lib/*.test.ts` plus the two end-to-end cases in
`src/lib/server/api/app.test.ts`, all run by `npm test`. Every vendor leg is
mocked at the fetch boundary: no test calls a distributor, Firecrawl, or a
running daBOM. The two that matter are a mocked Arrow API writing `method=api`
on `t4000-som`, and a login-wall page inserting nothing.
