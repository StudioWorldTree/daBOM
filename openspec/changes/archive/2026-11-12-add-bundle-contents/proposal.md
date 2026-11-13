# add-bundle-contents

**Rigor:** change

## Why

The EdgeBox buys one Alibaba listing — PCIe-to-M.2 NVMe HAT + metal case +
cooler — for $14. That is three parts on the parts list and one line on the
invoice. `buy` items were leaves with no lines, so the parts list could not
show the three parts without also charging for them.

## What

- Capability `bom-compose`, `bom-ingest`
- A bought `kit`/`assembly` (leaf floor, kind not `part`) is a bundle and may own BOM lines: its contents
- Explode descends into bundles; rows carry `containedBy`; contained rows have `extendedCents` null
- Roll-up, partCount, mass, watts and CSV money skip contained rows; CSV gains `contained_by`
- A bought `part` still rejects lines (T4000 SOM stays closed)
- PATCH 409s only when the result could not hold the item's lines; `assemble` → `buy` on a kit/assembly is allowed
- Ingest creates a bundle when a new node with children names floor `buy`/`foundry` and is not a `part`

## User journey & surfaces

Item page explode view tags contained rows `in <bundle>` and shows "in bundle" in the Ext column.

## Out of scope

- An "offer covers these BOM lines" model (rejected: more schema for one case)
- Per-line floor override
