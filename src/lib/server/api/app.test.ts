import { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db';
import { seed } from '../db/seed';
import { createApi } from './app';

const MIGRATIONS = path.resolve(process.cwd(), 'drizzle');

describe('daBOM API', () => {
	let app: ReturnType<typeof createApi>;
	let client: PGlite;

	beforeAll(async () => {
		client = new PGlite();
		const db = createDb(client);
		await migrate(db, { migrationsFolder: MIGRATIONS });
		await seed(db);
		app = createApi(db);
	});

	afterAll(async () => {
		await client.close();
	});

	it('serves OpenAPI 3', async () => {
		const res = await app.request('/openapi.json');
		expect(res.status).toBe(200);
		const spec = await res.json();
		expect(spec.openapi).toMatch(/^3/);
		expect(spec.info.title).toBe('daBOM');
		expect(spec.paths['/items/{sku}/bom']).toBeTruthy();
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
	});

	it('rolls up Cart T and rejects a cyclic line', async () => {
		const roll = await app.request('/items/kit-prod/rollup');
		expect(roll.status).toBe(200);
		const json = await roll.json();
		expect(json.partCount).toBeGreaterThan(3);
		expect(json.knownRequiredCents).toBeGreaterThan(300000);
		expect(json.missingQuotes).toContain('rogue-t5');

		const cycle = await app.request('/items/t4000-som/bom', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ childSku: 'kit-prod', qty: 1, role: 'oops' })
		});
		expect(cycle.status).toBe(409);
	});

	it('adds and drops a BOM line on a leaf', async () => {
		const add = await app.request('/items/hdmi-cable/bom', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ childSku: 'hdmi-usb-capture', qty: 2, role: 'test' })
		});
		expect(add.status).toBe(201);
		const line = await add.json();
		const drop = await app.request(`/items/hdmi-cable/bom/${line.id}`, { method: 'DELETE' });
		expect(drop.status).toBe(200);
	});
});
