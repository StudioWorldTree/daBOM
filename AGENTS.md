# daBOM

Local BOM system for the All Systems Go AI camera. Work on `main`.

Sister of `../AICamera` (GitHub Pages notebook). Do not put this app in AICamera and do not ship it as static Pages.

**Stack (already decided):** SvelteKit + Hono REST + OpenAPI + Drizzle + PGLite file (`data/dabom`). The API is the source of truth.

**Product facts** stay in AICamera / web3d-space. This repo stores SKUs, quotes (integer cents), and BOMs. Every item has a BOM; leaves are empty.

Seed catalog is `src/lib/server/db/catalog.ts`, drawn from AICamera `docs/SHOPPING.md`, `CAMERAS.md`, `CARRIER.md`, `INTERCONNECT.md`. Prices as of 2026-09-01.

Issue prefix: `dabom`. `bd prime` / `bd ready` if tracking here.
