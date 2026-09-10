# daBOM

Local BOM system for the All Systems Go AI camera. Work on `main`.
GitHub: `StudioWorldTree/daBOM`. Sister of `../AICamera` (GitHub Pages
notebook). Do not put this app in AICamera and do not ship it as static
Pages.

Issue prefix: `dabom`. `bd prime` / `bd ready` if tracking here.

## What the pieces are for

| Piece                                                     | Job                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Hono REST** (`src/lib/server/api/`)                     | The product. Features land here first. Zod schemas are the contract.                                                   |
| **OpenAPI document**                                      | Always published. Clients, CLI, and the explorer read this — not ad-hoc fetch helpers.                                 |
| **PGLite + Drizzle** (`data/dabom`, `src/lib/server/db/`) | Local Postgres file. SKUs, quotes (integer cents), BOM lines. Not the AICamera markdown.                               |
| **SvelteKit UI** (`src/routes/`)                          | Admin surface over the API. May lag the API. Never a second source of truth.                                           |
| **OpenAPI explorer** (owned, SvelteKit)                   | In-line try-every-operation harness. Not vendor Swagger/Scalar chrome.                                                 |
| **IdentiKey**                                             | Only login. CLI like `mj login`; browser like Taskmaster. No passwords on this host.                                   |
| **AICamera**                                              | Hardware notebook. Product facts (Thor, HEVC, /i) live there. Seed catalog is copied from those docs, not live-linked. |

Product facts stay in AICamera / web3d-space. This repo stores the crib.

Repo skills live in `skills/` — agent surfaces over the API, never a second
way into the database. `skills/ingest-hardware/` turns a hardware brief or a
datasheet into a JSON tree file, then POSTs `/api/v1/ingest`.
`skills/price-quote/` refreshes a quote down the access ladder — distributor
API, then a Firecrawl of the public page, then a headed Playwright session —
and POSTs `/api/v1/quotes`. A failed fetch or a login wall writes nothing.
Distributor and Firecrawl keys come from the environment
(`DIGIKEY_CLIENT_ID` / `DIGIKEY_ACCESS_TOKEN`, `MOUSER_API_KEY`,
`ARROW_LOGIN` / `ARROW_API_KEY`, `FIRECRAWL_API_KEY`); none is ever committed.

## How to dev

```bash
cd ~/work/ClientProjects/AllSystemsGo/daBOM
npm install
npm run dev          # http://localhost:5173
npm test             # vitest, in-memory PGLite
npm run check
npm run db:generate  # after schema.ts changes
```

- First boot migrates `drizzle/` into `data/dabom/` (gitignored) and seeds
  `src/lib/server/db/catalog.ts` (SHOPPING / CAMERAS / CARRIER / INTERCONNECT,
  prices as of 2026-09-01).
- `DABOM_RESEED=1 npm run dev` wipes local edits and reseeds.
- `adapter-node`, not `adapter-static`. `npm run build && npm start`.
- Hono is mounted from `src/hooks.server.ts` for `/api` and `/.well-known`.
- Every item has a BOM; leaves are empty arrays. Cycle detection on writes.

Crib UI: `/`. Item + BOM: `/items/{sku}`. Stopgap Swagger: `/api/v1/docs`
(replace with the owned explorer; do not grow it).

## How an agent works this crib

The contract is the live OpenAPI document, not this file's memory of
routes. PGLite is not an agent surface.

1. **Server.** If `http://localhost:5173/health` (or `/api/v1/health`)
   is down, `npm run dev` in this repo. Do not invent a second database.
2. **Spec.** `GET http://localhost:5173/.well-known/openapi.json`.
   Operations, bodies, and errors come from there. Do not hard-code a
   route list from an old chat.
3. **New kit / ingest a brief, PDF, or notebook page.** Read
   `skills/ingest-hardware/SKILL.md`. Write an `IngestRequest` JSON file,
   read it, then `POST /api/v1/ingest`. Never SQL, never drizzle, never
   `data/dabom/`.
4. **One SKU, one BOM line, a vendor.** `POST /api/v1/items`,
   `POST /api/v1/items/{sku}/bom`, `POST /api/v1/vendors` as the spec
   says. Floor defaults `buy`. Only `assemble` parents take children.
5. **Price / look up a street source.** Read `skills/price-quote/SKILL.md`.
   `POST /api/v1/quotes`. Failed fetch writes nothing. Keys stay in the
   environment.
6. **Read back.** `GET /api/v1/items/{sku}/bom?explode=true` and
   `GET /api/v1/items/{sku}/rollup`.

Product facts (Thor, HEVC, /i) stay in `../AICamera`. This crib stores
SKUs. Grok loads ingest/price from `.grok/skills/` (symlinks into
`skills/`). From any other repo, the user skill `~/.grok/skills/dabom`
is how an agent finds this tree.

## API first

A feature is not done when a page exists. Order:

1. Zod + `createRoute` on the Hono app.
2. Spec still serves at the well-known URL (see below). Test the operation
   through the API (vitest `app.request`, then the explorer).
3. UI may follow. If the UI is not ready, ship the API anyway.

Do not add a SvelteKit `+server.ts` that bypasses Hono for product data.
Do not teach the UI a schema the spec does not have.

## Well-known OpenAPI

Always publish the current OpenAPI 3.1 document at:

| URL                             |                                                        |
| ------------------------------- | ------------------------------------------------------ |
| **`/.well-known/openapi.json`** | Canonical discovery. Same bytes as the versioned spec. |
| `/api/v1/openapi.json`          | Versioned path the routes live under.                  |
| `/.well-known/api-catalog`      | RFC 9727 linkset pointing at those two.                |

If you add a version (`/api/v2`), keep well-known on the **current** spec
and list both in the catalog. Do not 404 the well-known URL. Do not serve
HTML there.

## Login is IdentiKey

No host passwords, no GitHub, no better-auth IdP. Passkey ceremonies stay
on the IdentiKey origin (`auth.identikey.me`). This app is an RP / API
audience, not the OP.

**CLI** — same shape as `mj login` (Mjolnir) and the recrypt client:
OAuth **device authorization + PKCE S256** against IdentiKey, token on
disk, `login` / `logout` / `status`. Recrypt’s signed-identity requests
are the self-custody cousin; do not invent a daBOM password prompt in
the terminal.

**UI** — same shape as Taskmaster (`~/work/Taskmaster/taskmaster-web`):
confidential OpenID RP, authorization code + PKCE, `/login` is “Continue”
(redirect), `/auth/callback` exchanges the code, session key is the
pairwise `sub` this OP issues to **this** client (not the XID). Laptop
loopback and production host are **two confidential clients**. Sign-out
is local. Do not paint OP chrome in the crib register.

The SvelteKit site is an **admin surface** over the REST API: crib,
explorer, operators. Public hardware story stays on AICamera Pages.

## Owned OpenAPI explorer

We write our own in-line explorer so every kind of OpenAPI operation
(path/query/header, GET/POST/PUT/PATCH/DELETE, JSON body, 4xx/5xx) can
be tried against the live spec.

- Read `/.well-known/openapi.json`. Do not hard-code route lists.
- Copy interaction ideas from Scalar, Swagger UI, and Stoplight
  (try-it, example payloads, status coloring). **Do not vendor their
  UI.** We own the look and the behavior.
- All SvelteKit. Base primitives from **shadcn-svelte**
  (`src/lib/components/ui/`, `components.json` when it exists). Add
  a component with the shadcn-svelte CLI, then restyle and extend.
  Pages compose those primitives; they do not import `@hono/swagger-ui`
  into the product chrome.
- `/api/v1/docs` (stock Swagger UI) is a stopgap until that explorer
  lands. Do not add features there.

## Already decided (camera crib)

Thor body, T4000 production ceiling, Rogue-T5 preferred carrier, HEVC
record, Cooke /i sidecars, hybrid CSI body + PoE sats. Do not re-litigate
without new evidence — that lives in AICamera `AGENTS.md`.
