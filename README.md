# daBOM

Bill of materials for the All Systems Go AI camera.

Sister of [`AICamera`](../AICamera) (the GitHub Pages hardware notebook). This is a **local web server**, not static docs: SvelteKit UI + **Hono REST API** + **OpenAPI** + **Drizzle** on a **PGLite file**.

The API is the source of truth. The UI is a client.

## Run

```bash
cd daBOM
npm install
npm run dev          # http://localhost:5173
```

- Crib UI: `/`
- Item + BOM: `/items/{sku}`
- Swagger UI: `/api/v1/docs`
- Spec: `/api/v1/openapi.json`

PGLite files land in `data/dabom/` (gitignored). First boot migrates and seeds the camera kit from `AICamera/docs/SHOPPING.md` and friends.

```bash
DABOM_RESEED=1 npm run dev   # wipe local edits, reseed
npm start                    # adapter-node, after npm run build
```

## API

Prefix `/api/v1`. Every item has a BOM (leaves are empty arrays).

| Method | Path | |
|---|---|---|
| GET | `/items` | `?q=&kind=&category=&status=` |
| POST | `/items` | create (empty BOM) |
| GET/PATCH/DELETE | `/items/{sku}` | |
| GET | `/items/{sku}/bom` | `?explode=true` |
| POST/PUT | `/items/{sku}/bom` | add line / replace |
| PATCH/DELETE | `/items/{sku}/bom/{lineId}` | |
| GET | `/items/{sku}/where-used` | |
| GET | `/items/{sku}/rollup` | cost / mass / watts |
| GET | `/kits` | `kind=kit` |
| GET/POST | `/vendors` | |
| GET/POST/PATCH | `/quotes` | prices in integer cents |

Cycle detection on BOM writes. Delete is refused while the SKU is on a parent or still has children.

## Stack

- SvelteKit 2 + `adapter-node` (not `adapter-static`)
- Hono + `@hono/zod-openapi` + Swagger UI
- Drizzle ORM + `@electric-sql/pglite` (Postgres in a directory)
- Seeded kits: Cart S (lab brick), Cart T (T4000 + Rogue-T5), Cart C (PYXIS PL), hybrid plant
