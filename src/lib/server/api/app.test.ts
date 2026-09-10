import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedBoms, seedItems } from '../db/catalog';
import { bomLines, createDb, type DabomDb } from '../db';
import { seed } from '../db/seed';
import { createApi } from './app';
import { createRoot } from './root';
import { arrowResponse, LOGIN_WALL_PAGE } from '../../../../skills/price-quote/lib/fixtures';
import { getItem, type DabomClient } from '../../../../skills/price-quote/lib/dabom';
import { refreshVendor } from '../../../../skills/price-quote/lib/ladder';

const MIGRATIONS = path.resolve(process.cwd(), 'drizzle');

// No database. The seed catalog is the crib every explode reads from, so the
// floor has to be right in the arrays, not only after the seed backfill runs.
describe('seed catalog', () => {
	const parents = new Set(seedBoms.map((line) => line.parentSku));

	it('tags every parent assemble and everything else buy', () => {
		for (const row of seedItems) {
			expect(row.floor, row.sku).toBe(parents.has(row.sku) ? 'assemble' : 'buy');
		}
	});

	// The type already refuses `foundry`; this catches a cast or a widened
	// row that slips past it.
	it('names no foundry row', () => {
		const floors: string[] = seedItems.map((row) => row.floor);
		expect(floors).not.toContain('foundry');
	});

	it('points every BOM line at a catalog row', () => {
		const skus = new Set(seedItems.map((row) => row.sku));
		for (const line of seedBoms) {
			expect(skus.has(line.parentSku), line.parentSku).toBe(true);
			expect(skus.has(line.childSku), line.childSku).toBe(true);
		}
	});
});

describe('daBOM API', () => {
	let app: ReturnType<typeof createApi>;
	let client: PGlite;
	let db: DabomDb;

	beforeAll(async () => {
		client = new PGlite();
		db = createDb(client);
		await migrate(db, { migrationsFolder: MIGRATIONS });
		await seed(db);
		app = createApi(db);
	});

	afterAll(async () => {
		await client.close();
	});

	it('serves OpenAPI 3 at the versioned path and the well-known URL', async () => {
		const res = await app.request('/openapi.json');
		expect(res.status).toBe(200);
		const spec = await res.json();
		expect(spec.openapi).toMatch(/^3/);
		expect(spec.info.title).toBe('daBOM');
		expect(spec.paths['/items/{sku}/bom']).toBeTruthy();
		// The price-access ladder and the append-only rule are part of the
		// contract, so they ship in the document a client actually reads.
		expect(spec.info.description).toMatch(/Price access ladder/);
		expect(spec.info.description).toMatch(/append-only/i);
		expect(spec.components.schemas.Quote.properties.method.enum).toEqual([
			'api',
			'headed',
			'crawl',
			'seed',
			'manual'
		]);

		const root = createRoot(app);
		const wellKnown = await root.request('/.well-known/openapi.json');
		expect(wellKnown.status).toBe(200);
		expect(wellKnown.headers.get('content-type')).toMatch(/json/);
		const fromWellKnown = await wellKnown.json();
		expect(fromWellKnown.paths).toEqual(spec.paths);

		const catalog = await root.request('/.well-known/api-catalog');
		expect(catalog.status).toBe(200);
		const cat = await catalog.json();
		expect(
			cat.linkset[0].describedby.some(
				(l: { href: string }) => l.href === '/.well-known/openapi.json'
			)
		).toBe(true);
	});

	it('lists seeded items and every kit has a BOM', async () => {
		const list = await app.request('/items');
		expect(list.status).toBe(200);
		const body = await list.json();
		expect(body.total).toBeGreaterThan(20);
		const kits = await app.request('/kits');
		const { items } = await kits.json();
		expect(items.length).toBeGreaterThanOrEqual(4);
		for (const kit of items) {
			const bom = await app.request(`/items/${kit.sku}/bom`);
			expect(bom.status).toBe(200);
			const json = await bom.json();
			expect(json.lineCount).toBeGreaterThan(0);
		}
	});

	it('returns an empty BOM for a leaf part', async () => {
		const res = await app.request('/items/t4000-som/bom');
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.lineCount).toBe(0);
		expect(json.parent.sku).toBe('t4000-som');
		expect(json.parent.floor).toBe('buy');
	});

	it('rolls up Cart T and rejects a cyclic line', async () => {
		const roll = await app.request('/items/kit-prod/rollup');
		expect(roll.status).toBe(200);
		const json = await roll.json();
		expect(json.partCount).toBeGreaterThan(3);
		expect(json.knownRequiredCents).toBeGreaterThan(300000);
		expect(json.missingQuotes).toContain('rogue-t5');

		// asm-thor-sandwich is a descendant of kit-prod, so this closes a loop.
		const cycle = await app.request('/items/asm-thor-sandwich/bom', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ childSku: 'kit-prod', qty: 1, role: 'oops' })
		});
		expect(cycle.status).toBe(409);
	});

	it('adds and drops a BOM line on an assemble parent', async () => {
		const add = await app.request('/items/asm-sat-mule/bom', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ childSku: 'hdmi-usb-capture', qty: 2, role: 'test' })
		});
		expect(add.status).toBe(201);
		const line = await add.json();
		expect(line.child.floor).toBe('buy');
		const drop = await app.request(`/items/asm-sat-mule/bom/${line.id}`, { method: 'DELETE' });
		expect(drop.status).toBe(200);
	});

	it('migration backfills floor=assemble for every seeded parent', async () => {
		const kits = await app.request('/kits');
		const { items: kitRows } = await kits.json();
		for (const kit of kitRows) expect(kit.floor).toBe('assemble');

		const som = await (await app.request('/items/t4000-som')).json();
		expect(som.floor).toBe('buy');

		const sandwich = await (await app.request('/items/asm-thor-sandwich')).json();
		expect(sandwich.floor).toBe('assemble');
	});

	it('new items default to floor=buy and reject a mixed-case sku', async () => {
		const shouty = await app.request('/items', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sku: 'T4000-SOM', name: 'Shouty', kind: 'part', category: 'compute' })
		});
		expect(shouty.status).toBe(422);

		const made = await app.request('/items', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				sku: 'floor-default-probe',
				name: 'Probe',
				kind: 'part',
				category: 'compute'
			})
		});
		expect(made.status).toBe(201);
		expect((await made.json()).floor).toBe('buy');
	});

	it('rejects BOM lines under a buy or foundry parent', async () => {
		const onBuy = await app.request('/items/t4000-som/bom', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ childSku: 'nvme-1tb', qty: 1, role: 'die' })
		});
		expect(onBuy.status).toBe(409);
		expect((await onBuy.json()).error).toMatch(/floor buy/);

		const toFoundry = await app.request('/items/rv1126b-core', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ floor: 'foundry' })
		});
		expect(toFoundry.status).toBe(200);
		const onFoundry = await app.request('/items/rv1126b-core/bom', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ childSku: 'nvme-1tb', qty: 1, role: 'die' })
		});
		expect(onFoundry.status).toBe(409);

		const put = await app.request('/items/t4000-som/bom', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ lines: [{ childSku: 'nvme-1tb', qty: 1, role: 'die' }] })
		});
		expect(put.status).toBe(409);
	});

	it('refuses to demote a parent that still has children', async () => {
		const demote = await app.request('/items/asm-thor-sandwich', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ floor: 'buy' })
		});
		expect(demote.status).toBe(409);
		const still = await (await app.request('/items/asm-thor-sandwich')).json();
		expect(still.floor).toBe('assemble');
	});

	it('explode stops at a buy leaf and never emits its grandchildren', async () => {
		// Give the SOM a child behind the API's back: floor, not emptiness,
		// is what keeps a buy leaf a leaf.
		const fake = await app.request('/items', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sku: 'fake-die', name: 'Fake die', kind: 'part', category: 'compute' })
		});
		expect(fake.status).toBe(201);
		await db
			.insert(bomLines)
			.values({ parentSku: 't4000-som', childSku: 'fake-die', qty: 1, role: 'die' });

		const exploded = await (await app.request('/items/kit-prod/bom?explode=true')).json();
		const skus = exploded.lines.map((l: { childSku: string }) => l.childSku);
		expect(skus).toContain('t4000-som');
		expect(skus).not.toContain('fake-die');

		const roll = await (await app.request('/items/kit-prod/rollup')).json();
		expect(roll.missingQuotes).not.toContain('fake-die');

		await db.delete(bomLines).where(eq(bomLines.parentSku, 't4000-som'));
	});

	// --- add-price-access -------------------------------------------------
	// These run last on purpose: they append quotes to seeded SKUs, and the
	// roll-up assertions above are written against the seeded numbers.

	const post = (path: string, body: unknown) =>
		app.request(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	const patch = (path: string, body: unknown) =>
		app.request(path, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});

	it('backfills a method on every seeded quote', async () => {
		const som = await (await app.request('/items/t4000-som')).json();
		expect(som.quotes).toHaveLength(1);
		expect(som.quotes[0].method).toBe('seed');

		// Priceless catalog rows are a human "ask them", not a fetch.
		const brick = await (await app.request('/items/cti-msg103')).json();
		expect(brick.quotes[0].method).toBe('manual');
		expect(brick.quotes[0].priceCents).toBeNull();
	});

	it('refuses a fetched quote with no price and no date', async () => {
		const priceless = await post('/quotes', {
			itemSku: 'cti-msg103',
			vendorId: 'cti',
			method: 'crawl',
			checkedAt: '2026-09-09',
			priceCents: null
		});
		expect(priceless.status).toBe(422);

		const undated = await post('/quotes', {
			itemSku: 'cti-msg103',
			vendorId: 'cti',
			method: 'api',
			priceCents: 25000
		});
		expect(undated.status).toBe(422);

		const brick = await (await app.request('/items/cti-msg103')).json();
		expect(brick.quotes).toHaveLength(1);
	});

	it('keeps the first quote and moves preferred to the refresh', async () => {
		const before = await (await app.request('/items/t4000-som')).json();
		const seedQuote = before.quotes[0];
		expect(seedQuote.isPreferred).toBe(true);

		const res = await post('/quotes', {
			itemSku: 't4000-som',
			vendorId: 'arrow',
			method: 'api',
			priceCents: 249900,
			checkedAt: '2026-09-09',
			url: 'https://www.arrow.com/en/products/900-13834-0000-000/nvidia'
		});
		expect(res.status).toBe(201);
		const fresh = await res.json();
		expect(fresh.method).toBe('api');
		expect(fresh.isPreferred).toBe(true);

		const after = await (await app.request('/items/t4000-som')).json();
		expect(after.quotes).toHaveLength(2);
		const stale = after.quotes.find((q: { id: string }) => q.id === seedQuote.id);
		expect(stale.priceCents).toBe(seedQuote.priceCents);
		expect(stale.isPreferred).toBe(false);

		const roll = await (await app.request('/items/t4000-som/rollup')).json();
		expect(roll.requiredCents).toBe(249900);
		expect(roll.asOf).toBe('2026-09-09');
	});

	it('prefers an api price over a later crawl of the same page', async () => {
		expect(
			(await post('/items', { sku: 'probe-sku', name: 'Probe', kind: 'part', category: 'compute' }))
				.status
		).toBe(201);
		await post('/quotes', {
			itemSku: 'probe-sku',
			vendorId: 'digikey',
			method: 'api',
			priceCents: 100000,
			checkedAt: '2026-09-01'
		});
		await post('/quotes', {
			itemSku: 'probe-sku',
			vendorId: 'digikey',
			method: 'crawl',
			priceCents: 200000,
			checkedAt: '2026-09-08'
		});

		const item = await (await app.request('/items/probe-sku')).json();
		expect(item.quotes).toHaveLength(2);

		const roll = await (await app.request('/items/probe-sku/rollup')).json();
		expect(roll.requiredCents).toBe(100000);
		expect(roll.asOf).toBe('2026-09-01');
	});

	it('falls past a preferred vendor whose chosen row has no price', async () => {
		await post('/quotes', {
			itemSku: 'cti-msg103',
			vendorId: 'wdl',
			method: 'crawl',
			priceCents: 31000,
			checkedAt: '2026-09-09'
		});
		const roll = await (await app.request('/items/cti-msg103/rollup')).json();
		expect(roll.requiredCents).toBe(31000);
		expect(roll.missingQuotes).toEqual([]);
	});

	it('refuses to rewrite price, url, method or date through PATCH', async () => {
		const item = await (await app.request('/items/probe-sku')).json();
		const api = item.quotes.find((q: { method: string }) => q.method === 'api');

		for (const body of [
			{ priceCents: 1 },
			{ url: 'https://example.invalid' },
			{ method: 'manual' },
			{ checkedAt: '2026-01-01' }
		]) {
			const res = await patch(`/quotes/${api.id}`, body);
			expect(res.status).toBe(422);
		}

		const still = await (await app.request('/items/probe-sku')).json();
		const same = still.quotes.find((q: { id: string }) => q.id === api.id);
		expect(same.priceCents).toBe(100000);
		expect(same.method).toBe('api');
		expect(same.checkedAt).toBe('2026-09-01');

		// The fields a quote may still change.
		const ok = await patch(`/quotes/${api.id}`, { inStock: false, notes: 'backorder' });
		expect(ok.status).toBe(200);
		expect((await ok.json()).notes).toBe('backorder');
	});

	// --- add-ingest-api ---------------------------------------------------

	const ingest = (body: unknown, contentType = 'application/json') =>
		app.request('/ingest', {
			method: 'POST',
			headers: { 'content-type': contentType },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		});

	const thorKit = {
		source: '../AICamera/docs/SHOPPING.md',
		root: {
			sku: 'kit-ingest-thor',
			name: 'Thor shopping kit',
			kind: 'kit',
			category: 'kit',
			children: [
				{
					name: 'NVIDIA Jetson T4000 SOM',
					manufacturer: 'NVIDIA',
					mpn: '900-13834-0000-000',
					qty: 1,
					role: 'som'
				},
				{ sku: 'rogue-t5', qty: 1, role: 'carrier' }
			]
		}
	};

	it('writes a JSON tree as items and BOM lines without per-line POSTs', async () => {
		const res = await ingest(thorKit);
		expect(res.status).toBe(201);
		const { root } = await res.json();
		expect(root.sku).toBe('kit-ingest-thor');
		expect(root.action).toBe('created');
		// A new node that lists children is promoted before its lines land.
		expect(root.floor).toBe('assemble');
		expect(root.lines).toHaveLength(2);
		for (const id of root.lines) expect(id).toMatch(/^[0-9a-f-]{36}$/);

		// Identity, not the name, decides: the seeded SOM is reused.
		expect(root.children.map((n: { sku: string }) => n.sku)).toEqual(['t4000-som', 'rogue-t5']);
		expect(root.children.every((n: { action: string }) => n.action === 'matched')).toBe(true);

		const bom = await (await app.request('/items/kit-ingest-thor/bom')).json();
		expect(bom.lineCount).toBe(2);
		expect(bom.lines.map((l: { childSku: string }) => l.childSku).sort()).toEqual([
			'rogue-t5',
			't4000-som'
		]);

		// The seed row is not relitigated by an ingest that names it.
		const som = await (await app.request('/items/t4000-som')).json();
		expect(som.name).toBe('NVIDIA Jetson T4000 SOM');
		expect(som.status).toBe('preferred');

		const spec = await (await app.request('/openapi.json')).json();
		expect(spec.paths['/ingest'].post).toBeTruthy();
		const root2 = createRoot(app);
		const wellKnown = await (await root2.request('/.well-known/openapi.json')).json();
		expect(wellKnown.paths['/ingest'].post.tags).toContain('Ingest');
	});

	it('sets qty on a repeat POST instead of adding lines or quotes', async () => {
		const before = await (await app.request('/quotes')).json();
		const again = await ingest({
			...thorKit,
			root: {
				...thorKit.root,
				children: thorKit.root.children.map((c) => ({ ...c, qty: 3 }))
			}
		});
		expect(again.status).toBe(201);
		const { root } = await again.json();
		expect(root.action).toBe('matched');

		const bom = await (await app.request('/items/kit-ingest-thor/bom')).json();
		expect(bom.lineCount).toBe(2);
		expect(bom.lines.every((l: { qty: number }) => l.qty === 3)).toBe(true);

		const after = await (await app.request('/quotes')).json();
		expect(after.quotes).toHaveLength(before.quotes.length);
	});

	it('matches on MPN alone and 409s when two rows share one MPN', async () => {
		const alone = await ingest({
			root: {
				sku: 'kit-ingest-mpn',
				name: 'MPN-only kit',
				kind: 'kit',
				category: 'kit',
				children: [{ mpn: '900-13834-0000-000', name: 'Some Thor module', qty: 1, role: 'som' }]
			}
		});
		expect(alone.status).toBe(201);
		expect((await alone.json()).root.children[0].sku).toBe('t4000-som');

		for (const sku of ['dup-mpn-a', 'dup-mpn-b']) {
			const made = await post('/items', {
				sku,
				name: `Dup ${sku}`,
				kind: 'part',
				category: 'compute',
				manufacturer: sku === 'dup-mpn-a' ? 'Acme' : 'Globex',
				mpn: 'DUP-MPN-1'
			});
			expect(made.status).toBe(201);
		}
		const ambiguous = await ingest({
			root: {
				sku: 'kit-ingest-dup',
				name: 'Ambiguous kit',
				kind: 'kit',
				category: 'kit',
				children: [{ mpn: 'DUP-MPN-1', name: 'Ambiguous part', qty: 1 }]
			}
		});
		expect(ambiguous.status).toBe(409);
		expect((await ambiguous.json()).error).toMatch(/DUP-MPN-1/);
		expect((await app.request('/items/kit-ingest-dup')).status).toBe(404);
	});

	it('409s a name-minted slug that lands on an identified row, writing nothing', async () => {
		const res = await ingest({
			root: {
				sku: 'kit-ingest-collide',
				name: 'Collide kit',
				kind: 'kit',
				category: 'kit',
				children: [
					{ mpn: '900-13834-0000-000', qty: 1, role: 'som' },
					{ name: 'T4000 SOM', qty: 1, role: 'spare' }
				]
			}
		});
		expect(res.status).toBe(409);
		expect((await res.json()).error).toMatch(/t4000-som/);
		expect((await app.request('/items/kit-ingest-collide')).status).toBe(404);
	});

	it('refuses to explode a buy SOM and rolls the whole tree back', async () => {
		const res = await ingest({
			root: {
				sku: 'kit-ingest-explode',
				name: 'Explode kit',
				kind: 'kit',
				category: 'kit',
				children: [
					{
						sku: 't4000-som',
						qty: 1,
						role: 'som',
						children: [{ name: 'Thor die', qty: 1, role: 'die' }]
					}
				]
			}
		});
		expect(res.status).toBe(409);
		expect((await res.json()).error).toMatch(/floor buy/);
		expect((await app.request('/items/kit-ingest-explode')).status).toBe(404);
		expect((await app.request('/items/thor-die')).status).toBe(404);
		const som = await (await app.request('/items/t4000-som/bom')).json();
		expect(som.lineCount).toBe(0);
		expect((await (await app.request('/items/t4000-som')).json()).floor).toBe('buy');
	});

	it('409s a cycle closed by sku reference and writes nothing', async () => {
		const res = await ingest({
			root: {
				sku: 'asm-thor-sandwich',
				children: [{ sku: 'kit-prod', qty: 1, role: 'oops' }]
			}
		});
		expect(res.status).toBe(409);
		expect((await res.json()).error).toMatch(/cycle/i);
		const bom = await (await app.request('/items/asm-thor-sandwich/bom')).json();
		expect(bom.lines.some((l: { role: string }) => l.role === 'oops')).toBe(false);
	});

	it('mints a name-only node as a placeholder and reuses it on the next POST', async () => {
		const body = {
			source: 'brief',
			root: {
				sku: 'kit-ingest-mint',
				name: 'Mint kit',
				kind: 'kit',
				category: 'kit',
				children: [{ name: 'Möbius Bräcket 3000', qty: 2, role: 'bracket' }]
			}
		};
		const first = await ingest(body);
		expect(first.status).toBe(201);
		const minted = (await first.json()).root.children[0];
		expect(minted.sku).toBe('mobius-bracket-3000');
		expect(minted.action).toBe('created');

		const made = await (await app.request('/items/mobius-bracket-3000')).json();
		expect(made.status).toBe('placeholder');
		expect(made.floor).toBe('buy');
		expect(made.source).toBe('brief');

		// A name-minted slug that hits a row with no pair is the same identity.
		const second = await ingest(body);
		expect(second.status).toBe(201);
		expect((await second.json()).root.children[0].action).toBe('matched');
	});

	it('rejects a non-kebab sku and an unmintable name', async () => {
		const shouty = await ingest({ root: { sku: 'KIT-SHOUTY', name: 'Shouty' } });
		expect(shouty.status).toBe(422);

		const nameless = await ingest({
			root: {
				sku: 'kit-ingest-nameless',
				name: 'Nameless kit',
				kind: 'kit',
				category: 'kit',
				children: [{ name: '???', qty: 1 }]
			}
		});
		expect(nameless.status).toBe(422);
		expect((await app.request('/items/kit-ingest-nameless')).status).toBe(404);
	});

	it('415s a PDF or markdown body and never parses it', async () => {
		const pdf = await ingest('%PDF-1.7 binary', 'application/pdf');
		expect(pdf.status).toBe(415);
		expect((await pdf.json()).error).toMatch(/application\/pdf/);

		const md = await ingest('# Shopping list', 'text/markdown');
		expect(md.status).toBe(415);
	});

	it('refuses to prefer a superseded row', async () => {
		const item = await (await app.request('/items/t4000-som')).json();
		const stale = item.quotes.find((q: { method: string }) => q.method === 'seed');
		const current = item.quotes.find((q: { method: string }) => q.method === 'api');

		const bad = await patch(`/quotes/${stale.id}`, { isPreferred: true });
		expect(bad.status).toBe(422);

		const good = await patch(`/quotes/${current.id}`, { isPreferred: true });
		expect(good.status).toBe(200);
		expect((await good.json()).isPreferred).toBe(true);
	});
	// --- add-price-skills -------------------------------------------------
	// The price-quote skill is HTTP-only, so it is exercised through a fetch
	// that routes daBOM URLs at this in-memory app and mocks the vendor legs.
	// Nothing here imports the skill's writes past POST /quotes.

	const LADDER_BASE = 'http://dabom.test/api/v1';

	const ladderClient = (routes: Record<string, () => Response>): DabomClient => {
		const fetcher = async (url: string, init?: RequestInit) => {
			if (url.startsWith(LADDER_BASE)) return app.request(url.slice(LADDER_BASE.length), init);
			for (const [prefix, answer] of Object.entries(routes)) {
				if (url.startsWith(prefix)) return answer();
			}
			throw new Error(`unrouted fetch: ${url}`);
		};
		return { base: LADDER_BASE, fetch: fetcher };
	};

	const asJson = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

	it('writes a method api quote when the Arrow API prices the SOM exactly', async () => {
		const client = ladderClient({
			'https://api.arrow.com/': () => asJson(arrowResponse('900-13834-0000-000'))
		});
		const item = await getItem(client, 't4000-som');
		expect(item.mpn).toBe('900-13834-0000-000');

		const result = await refreshVendor(client, item, 'arrow', {
			fetch: client.fetch,
			env: { ARROW_LOGIN: 'duke@worldtree.io', ARROW_API_KEY: 'test-key' },
			now: new Date('2026-09-10T17:00:00Z')
		});

		expect(result.posted).not.toBeNull();
		const som = await (await app.request('/items/t4000-som')).json();
		const written = som.quotes.find((q: { id: string }) => q.id === result.posted?.id);
		expect(written).toMatchObject({
			vendorId: 'arrow',
			method: 'api',
			priceCents: 299900,
			currency: 'USD',
			checkedAt: '2026-09-10',
			url: 'https://www.arrow.com/en/products/900-13834-0000-000/nvidia'
		});
		expect(written.notes).toMatch(/price break qty 1/);
	});

	it('inserts nothing when the only page is behind a login wall', async () => {
		const client = ladderClient({
			'https://api.firecrawl.dev/v2/search': () =>
				asJson({ data: { web: [{ url: 'https://connecttech.com/product/rogue-t5/' }] } }),
			'https://api.firecrawl.dev/v2/scrape': () =>
				asJson({ data: { markdown: LOGIN_WALL_PAGE, metadata: { statusCode: 200 } } })
		});
		const item = await getItem(client, 'rogue-t5');
		const before = await (await app.request('/quotes')).json();

		const result = await refreshVendor(client, item, 'cti', {
			fetch: client.fetch,
			env: { FIRECRAWL_API_KEY: 'fc-test' },
			now: new Date('2026-09-10T17:00:00Z')
		});

		expect(result.posted).toBeNull();
		expect(result.next).toBe('headed');
		const after = await (await app.request('/quotes')).json();
		expect(after.quotes).toHaveLength(before.quotes.length);
	});
});
