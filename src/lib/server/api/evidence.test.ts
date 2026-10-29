import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	enrichments,
	itemSources,
	sources,
	thoughts,
	thoughtSources,
	type DabomDb
} from '../db';
import { openDb } from '../db';
import type { ItemEvidence } from '../../types';
import { createApi } from './app';
import { createRoot } from './root';

const missingId = '11111111-1111-4111-8111-111111111111';

describe('item evidence API', () => {
	let client: PGlite;
	let db: DabomDb;
	let app: ReturnType<typeof createApi>;

	beforeAll(async () => {
		({ client, db } = await openDb({ dataDir: 'memory://' }));
		app = createApi(db);
	});
	afterAll(async () => {
		await client.close();
	});

	async function post(path: string, body: unknown, status = 201) {
		const response = await app.request(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		expect(response.status, await response.clone().text()).toBe(status);
		return response.json();
	}
	async function item(sku: string) {
		return post('/items', {
			sku,
			name: sku,
			kind: 'part',
			category: 'compute',
			manufacturer: 'Original',
			mpn: 'MPN',
			notes: 'Original notes',
			source: '../old.md'
		});
	}
	async function evidence(sku: string): Promise<ItemEvidence> {
		const response = await app.request(`/items/${sku}/evidence`);
		expect(response.status).toBe(200);
		return response.json();
	}
	async function source(locator: string) {
		return post('/sources', { kind: 'link', locator, title: 'First title' }, 200);
	}

	it('reuses the trimmed locator without changing kind or title', async () => {
		const first = await post(
			'/sources',
			{ kind: 'notebook', locator: '  ../AICamera/docs/research.md\t', title: 'Original' },
			200
		);
		const retry = await post(
			'/sources',
			{ kind: 'analysis', locator: '../AICamera/docs/research.md', title: 'Replacement' },
			200
		);
		expect(retry).toEqual(first);
		expect(first.locator).toBe('../AICamera/docs/research.md');
		expect(await db.select().from(sources).where(eq(sources.locator, first.locator))).toHaveLength(
			1
		);
		for (const locator of [
			'README.md',
			'docs/chip.pdf',
			'./notes/review.md',
			'https://example.com/chip',
			'http://example.com/chip'
		]) {
			await source(locator);
		}
	});

	it('rejects invalid locators on both creation paths without writing', async () => {
		await item('bad-locator');
		const before = await db.select().from(sources);
		for (const locator of [
			'',
			' \t\n ',
			'a legacy description',
			'/absolute/file.md',
			'//example.com/file',
			'ftp://example.com/file',
			'file:///tmp/file',
			'https://',
			'https://example.com/white space',
			'C:\\file.md',
			'~/file.md'
		]) {
			await post('/sources', { kind: 'link', locator }, 422);
			await post('/items/bad-locator/sources', { kind: 'link', locator }, 422);
		}
		expect(await db.select().from(sources)).toEqual(before);
		expect((await evidence('bad-locator')).links).toEqual([]);
	});

	it('links by locator or id idempotently without changing an item', async () => {
		const before = await item('linked');
		const link = await post(
			'/items/linked/sources',
			{ kind: 'datasheet', locator: 'https://example.com/linked' },
			200
		);
		expect(await post('/items/linked/sources', { sourceId: link.sourceId }, 200)).toEqual(link);
		expect(
			await post(
				'/items/linked/sources',
				{ kind: 'analysis', locator: ' https://example.com/linked ', title: 'Ignored' },
				200
			)
		).toEqual(link);
		const result = await evidence('linked');
		expect(result.links).toEqual([link]);
		expect(result.sources).toMatchObject([{ id: link.sourceId, kind: 'datasheet', title: null }]);
		expect(result.enrichments).toEqual([]);
		expect(result.thoughts).toEqual([]);
		expect(await (await app.request('/items/linked')).json()).toEqual({ ...before, quotes: [] });
		const reverse = await (await app.request(`/sources/${link.sourceId}`)).json();
		expect(reverse.items.map((row: { sku: string }) => row.sku)).toEqual(['linked']);
	});

	it('rejects missing link references before creating a source or a link', async () => {
		await item('missing-refs');
		const before = await db.select().from(sources);
		await post(
			'/items/no-such-item/sources',
			{ kind: 'link', locator: 'https://example.com/never-created' },
			404
		);
		await post('/items/missing-refs/sources', { sourceId: missingId }, 404);
		expect(await db.select().from(sources)).toEqual(before);
		expect((await evidence('missing-refs')).links).toEqual([]);
	});

	it('appends facts and thoughts with server ids/time, preserving every item column and quotes', async () => {
		await item('history');
		await post('/quotes', { itemSku: 'history', vendorId: 'bh', priceCents: 1234 });
		const before = await (await app.request('/items/history')).json();
		const doc = await source('https://example.com/history');
		const since = Date.now();
		const fact1 = await post('/items/history/enrichments', {
			field: 'manufacturer',
			value: 'Observed one',
			sourceId: doc.id,
			method: 'ingest',
			body: 'Label on package'
		});
		const fact2 = await post('/items/history/enrichments', { value: 'Observed two' });
		const note1 = await post('/items/history/thoughts', {
			body: 'Keep the original notes.',
			sourceIds: [doc.id, doc.id]
		});
		const note2 = await post('/items/history/thoughts', { body: 'Uncited thought' });
		for (const row of [fact1, fact2, note1, note2]) {
			expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
			expect(Date.parse(row.createdAt)).toBeGreaterThanOrEqual(since - 1);
			expect(Date.parse(row.createdAt)).toBeLessThanOrEqual(Date.now());
		}
		expect(new Set([fact1.id, fact2.id, note1.id, note2.id]).size).toBe(4);
		expect(note1.sourceIds).toEqual([doc.id]);
		expect(note2.sourceIds).toEqual([]);
		const result = await evidence('history');
		expect(result.enrichments).toHaveLength(2);
		expect(result.thoughts).toHaveLength(2);
		expect(result.sources.map((row) => row.id)).toEqual([doc.id]);
		expect(result.links).toEqual([]);
		expect(await (await app.request('/items/history')).json()).toEqual(before);
	});

	it('missing sources, mixed citations, and missing items write no history', async () => {
		const doc = await source('https://example.com/valid-citation');
		const before = await evidence('missing-refs');
		await post(
			'/items/missing-refs/enrichments',
			{ value: 'Missing source', sourceId: missingId },
			404
		);
		await post(
			'/items/missing-refs/thoughts',
			{ body: 'Mixed references', sourceIds: [doc.id, missingId] },
			404
		);
		await post('/items/no-such-item/enrichments', { value: 'No item' }, 404);
		await post('/items/no-such-item/thoughts', { body: 'No item' }, 404);
		expect(await evidence('missing-refs')).toEqual(before);
	});

	it('rejects client identity/time, empty thoughts, invalid fields/methods and quote metadata', async () => {
		for (const extra of [
			{ id: missingId },
			{ createdAt: '2000-01-01T00:00:00Z' },
			{ priceCents: 10 },
			{ vendorId: 'bh' }
		]) {
			await post('/items/missing-refs/enrichments', { value: 'Observation', ...extra }, 422);
			await post('/items/missing-refs/thoughts', { body: 'Thought', ...extra }, 422);
		}
		for (const body of ['', ' \n\t']) await post('/items/missing-refs/thoughts', { body }, 422);
		await post('/items/missing-refs/enrichments', { value: 'Observation', method: 'api' }, 422);
		await post(
			'/items/missing-refs/enrichments',
			{ value: 'Observation', field: 'priceCents' },
			422
		);
		await post(
			'/sources',
			{ kind: 'link', locator: 'https://example.com/not-a-quote', priceCents: 10 },
			422
		);
		expect((await evidence('missing-refs')).enrichments).toEqual([]);
		expect((await evidence('missing-refs')).thoughts).toEqual([]);
	});

	it('orders complete histories by createdAt and then id, including ties', async () => {
		await item('ordered');
		const late = '2026-10-28T10:00:00.000Z';
		const early = '2026-10-27T10:00:00.000Z';
		for (const table of [enrichments, thoughts]) {
			const rows =
				table === enrichments
					? await Promise.all(
							[1, 2, 3].map((n) => post('/items/ordered/enrichments', { value: String(n) }))
						)
					: await Promise.all(
							[1, 2, 3].map((n) => post('/items/ordered/thoughts', { body: String(n) }))
						);
			const ids = rows.map((row) => row.id).sort();
			// The earliest timestamp belongs to the greatest id, proving time
			// takes precedence. The other two prove the tie breaker.
			await db
				.update(table)
				.set({ createdAt: new Date(late) })
				.where(eq(table.itemSku, 'ordered'));
			await db
				.update(table)
				.set({ createdAt: new Date(early) })
				.where(eq(table.id, ids[2]));
			const result = await evidence('ordered');
			expect(
				(table === enrichments ? result.enrichments : result.thoughts).map((row) => row.id)
			).toEqual([ids[2], ids[0], ids[1]]);
		}
	});

	it('does not expose single-record rewrite/delete routes', async () => {
		const before = await evidence('history');
		for (const [resource, id] of [
			['enrichments', before.enrichments[0].id],
			['thoughts', before.thoughts[0].id]
		]) {
			for (const prefix of ['/items/history', '']) {
				for (const method of ['PATCH', 'DELETE']) {
					const response = await app.request(`${prefix}/${resource}/${id}`, {
						method,
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ value: 'Rewrite', body: 'Rewrite' })
					});
					expect(response.status).toBe(404);
				}
			}
		}
		expect(await evidence('history')).toEqual(before);
	});

	it('reads every linked or cited item once and preserves shared sources when deleting', async () => {
		const doc = await source('https://example.com/shared');
		for (const sku of ['shared-linked', 'shared-fact', 'shared-thought', 'shared-delete'])
			await item(sku);
		await post('/items/shared-linked/sources', { sourceId: doc.id }, 200);
		await post('/items/shared-fact/enrichments', { value: 'Only enrichment', sourceId: doc.id });
		await post('/items/shared-thought/thoughts', { body: 'Only thought', sourceIds: [doc.id] });
		await post('/items/shared-delete/sources', { sourceId: doc.id }, 200);
		await post('/items/shared-delete/enrichments', { value: 'Also cites', sourceId: doc.id });
		const thought = await post('/items/shared-delete/thoughts', {
			body: 'Also thinks',
			sourceIds: [doc.id]
		});
		await post('/quotes', { itemSku: 'shared-delete', vendorId: 'bh', priceCents: 99 });
		const reverse = async () =>
			(await (await app.request(`/sources/${doc.id}`)).json()).items.map(
				(row: { sku: string }) => row.sku
			);
		expect(await reverse()).toEqual([
			'shared-delete',
			'shared-fact',
			'shared-linked',
			'shared-thought'
		]);
		for (const sku of ['shared-linked', 'shared-fact', 'shared-thought']) {
			expect((await evidence(sku)).sources.map((row) => row.id)).toEqual([doc.id]);
		}
		expect((await app.request('/items/shared-delete', { method: 'DELETE' })).status).toBe(200);
		expect((await app.request('/items/shared-delete')).status).toBe(404);
		expect(await reverse()).toEqual(['shared-fact', 'shared-linked', 'shared-thought']);
		expect(
			await db.select().from(thoughtSources).where(eq(thoughtSources.thoughtId, thought.id))
		).toEqual([]);
		expect(
			await db.select().from(itemSources).where(eq(itemSources.itemSku, 'shared-delete'))
		).toEqual([]);
		expect(
			await db.select().from(enrichments).where(eq(enrichments.itemSku, 'shared-delete'))
		).toEqual([]);
		expect(await db.select().from(thoughts).where(eq(thoughts.itemSku, 'shared-delete'))).toEqual(
			[]
		);
	});

	it('returns missing read references as 404', async () => {
		expect((await app.request('/items/no-such-item/evidence')).status).toBe(404);
		expect((await app.request(`/sources/${missingId}`)).status).toBe(404);
	});

	it('guards BOM usage before removing quotes or evidence', async () => {
		await post('/items/t4000-som/enrichments', { value: 'Keep me' });
		const before = await evidence('t4000-som');
		const itemBefore = await (await app.request('/items/t4000-som')).json();
		expect((await app.request('/items/t4000-som', { method: 'DELETE' })).status).toBe(409);
		expect(await evidence('t4000-som')).toEqual(before);
		expect(await (await app.request('/items/t4000-som')).json()).toEqual(itemBefore);
	});

	it('rolls back quotes and all evidence when item deletion fails after child deletes', async () => {
		await item('rollback-delete');
		const doc = await source('https://example.com/rollback');
		await post('/quotes', { itemSku: 'rollback-delete', vendorId: 'bh', priceCents: 100 });
		await post('/items/rollback-delete/sources', { sourceId: doc.id }, 200);
		await post('/items/rollback-delete/enrichments', { value: 'Keep fact', sourceId: doc.id });
		await post('/items/rollback-delete/thoughts', { body: 'Keep thought', sourceIds: [doc.id] });
		const before = await evidence('rollback-delete');
		const itemBefore = await (await app.request('/items/rollback-delete')).json();
		await client.exec(`CREATE FUNCTION fail_evidence_delete() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN RAISE EXCEPTION 'injected delete failure'; END $$;
			CREATE TRIGGER fail_evidence_delete BEFORE DELETE ON items FOR EACH ROW
			WHEN (OLD.sku = 'rollback-delete') EXECUTE FUNCTION fail_evidence_delete();`);
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			expect((await app.request('/items/rollback-delete', { method: 'DELETE' })).status).toBe(500);
			expect(await evidence('rollback-delete')).toEqual(before);
			expect(await (await app.request('/items/rollback-delete')).json()).toEqual(itemBefore);
		} finally {
			errors.mockRestore();
			await client.exec(
				'DROP TRIGGER fail_evidence_delete ON items; DROP FUNCTION fail_evidence_delete();'
			);
		}
	});

	it('publishes all six operations and history ids/times at well-known discovery', async () => {
		const versioned = await app.request('/openapi.json');
		const canonical = await createRoot(app).request('/.well-known/openapi.json');
		expect(await canonical.clone().text()).toBe(await versioned.text());
		const spec = await canonical.json();
		for (const [path, method] of [
			['/sources', 'post'],
			['/items/{sku}/sources', 'post'],
			['/items/{sku}/enrichments', 'post'],
			['/items/{sku}/thoughts', 'post'],
			['/items/{sku}/evidence', 'get'],
			['/sources/{id}', 'get']
		]) {
			expect(spec.paths[path][method]).toBeTruthy();
		}
		for (const name of ['Enrichment', 'Thought']) {
			expect(spec.components.schemas[name].required).toEqual(
				expect.arrayContaining(['id', 'createdAt'])
			);
			expect(spec.components.schemas[name].properties.createdAt.format).toBe('date-time');
		}
		for (const [path, operations] of Object.entries(spec.paths)) {
			if (/enrichments|thoughts/.test(path)) {
				expect(Object.keys(operations as object)).not.toContain('patch');
				expect(Object.keys(operations as object)).not.toContain('delete');
			}
		}
	});
});
