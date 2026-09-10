---
name: ingest-hardware
description: Turn a hardware brief, notebook page, or datasheet into a daBOM kit. Use when asked to ingest SHOPPING.md / CAMERAS.md / a datasheet PDF, load a cart or a parts list into the crib, or add an item tree to daBOM. Writes a JSON tree file first, then POSTs /api/v1/ingest.
---

# Ingest hardware into daBOM

A document is a **menu**. A BOM is a **selection** from it. This skill goes
source → candidates → selection → tree file → POST. Never source → POST.

## The rule that is not negotiable

**HTTP only.** The single write is `POST /api/v1/ingest` against a running
server. Do not open the local Postgres file, do not import anything from the
app's server code, do not run SQL. If the server is not running, start it
(`npm run dev`) or stop.

## Steps

1. **Convert, if needed.** PDF in, markdown out:

   ```bash
   pdf2md datasheet.pdf > /tmp/datasheet.md
   ```

   Never parse PDF bytes here, and never add a PDF or markdown parser to the
   app `package.json` or under `src/`. `POST /ingest` is JSON-only; it answers
   415 for markdown and PDF bodies on purpose.

2. **List candidates.** A candidate is a heading with an optional manufacturer,
   part number, and notes. It is evidence that a part exists, not a BOM line.

   ```bash
   npx tsx skills/ingest-hardware/scripts/candidates.ts ../AICamera/docs/SHOPPING.md
   ```

3. **Choose a selection.** One of:
   - a cart section the document itself names (`--cart "Cart T"`),
   - an explicit list of part numbers (`--mpn ... --mpn ...`),
   - a hand edit of the tree file in step 4.

   Never "every `###` heading that has a `PN` row". `SHOPPING.md` section 1
   lists an AGX Thor Developer Kit and three carriers the author rejected;
   the production kit is `Cart T`, which is a T4000 SOM and a Rogue-T5.

4. **Write the tree file.** This is the review artifact.

   ```bash
   npx tsx skills/ingest-hardware/scripts/compose.ts \
     --source ../AICamera/docs/SHOPPING.md --cart "Cart T" --out /tmp/cart-t.json
   ```

5. **Read the file.** Actually read it. Fix names, quantities, roles, and
   categories by editing the JSON.

6. **POST it.** The POST step takes a tree file path as its only input, so no
   run can skip step 4.

   ```bash
   DABOM_API_BASE=http://localhost:5173/api/v1 \
     npx tsx skills/ingest-hardware/scripts/post.ts /tmp/cart-t.json
   ```

## The tree

Shape is `IngestNode` from `/.well-known/openapi.json` — read it there rather
than from a field list pasted here. One whole example:

```json
{
	"source": "../AICamera/docs/SHOPPING.md",
	"root": {
		"name": "Cart T — T4000 + Rogue-T5",
		"kind": "kit",
		"children": [
			{
				"name": "NVIDIA Jetson T4000 SOM",
				"manufacturer": "NVIDIA",
				"mpn": "900-13834-0000-000",
				"category": "compute",
				"qty": 1
			},
			{
				"name": "Connect Tech Rogue-T5",
				"manufacturer": "Connect Tech",
				"mpn": "AGX302",
				"category": "carrier",
				"qty": 1
			}
		]
	}
}
```

## What the tree must not carry

- **No `sku`** unless a human names one. Identity is resolved by the server:
  (manufacturer, MPN) pair, then MPN alone, then a supplied kebab sku, then a
  minted slug. Supplying a sku pre-empts a seeded row.
- **No invented part number.** A cart line with no MPN anywhere in the
  document (the PYXIS 6K PL and the RV1126 turrets in `Cart T`) becomes a
  name-minted node and lands as `placeholder`. That is the honest outcome —
  do not go hunting the web for a number.
- **No prices.** Price cells in the brief are dropped. Quotes are a separate
  skill.

## When it does not return 201

Show the response body. Edit the **tree file**. Re-POST the whole file. One
file, one POST, one transaction; any non-2xx writes nothing.

A common one on this crib: a name-minted node collides with a seeded row
(`minted sku pyxis-6k-pl already belongs to Blackmagic Design`). The fix is to
name that node's `sku` in the tree file so it matches the seeded row, not to
rename the part.

Do not hand-POST `/items` and `/bom` lines around a 409, and never retag a
seed floor to get past one. A 409 means an identity collision, a floor
conflict (an existing `buy` parent cannot grow children), or a cycle — all of
which are edits to the file, not workarounds.

## Tests

`skills/ingest-hardware/lib/*.test.ts`, run by `npm test`. The fixture is the
whole `../AICamera/docs/SHOPPING.md`, because the point is the parts in it
that must not reach the tree.
