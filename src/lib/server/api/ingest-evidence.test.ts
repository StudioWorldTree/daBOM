import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ItemEvidence } from '../../types';
import {
	bomLines,
	enrichments,
	items,
	itemSources,
	openDb,
	quotes,
	sources,
	thoughts,
	thoughtSources,
	type DabomDb
} from '../db';
import { createApi } from './app';
import { createRoot } from './root';

describe('ingest evidence', () => {
	let client: PGlite;
	let db: DabomDb;
	let root: ReturnType<typeof createRoot>;

	beforeAll(async () => {
		({ client, db } = await openDb({ dataDir: 'memory://' }));
		root = createRoot(createApi(db));
	});
	afterAll(async () => {
		await client.close();
	});

	async function write(path: string, body: unknown, status = 201, method = 'POST') {
		const response = await root.request(`/api/v1${path}`, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		expect(response.status, await response.clone().text()).toBe(status);
		return response.json();
	}
	const ingest = (body: unknown, status = 201) => write('/ingest', body, status);
	async function evidence(sku: string): Promise<ItemEvidence> {
		const response = await root.request(`/api/v1/items/${sku}/evidence`);
		expect(response.status).toBe(200);
		return response.json();
	}
	async function item(sku: string) {
		const response = await root.request(`/api/v1/items/${sku}`);
		expect(response.status).toBe(200);
		return response.json();
	}
	async function bareItem(sku: string, extra = {}) {
		return write('/items', { sku, name: sku, kind: 'part', category: 'accessory', ...extra });
	}
	async function snapshot() {
		return Promise.all([
			db.select().from(items),
			db.select().from(bomLines),
			db.select().from(sources),
			db.select().from(itemSources),
			db.select().from(enrichments),
			db.select().from(quotes),
			db.select().from(thoughts),
			db.select().from(thoughtSources)
		]);
	}

	it('creates persisted facts with a notebook citation and retries without duplicates', async () => {
		const body = {
			source: '  ../AICamera/docs/SHOPPING.md  ',
			root: {
				sku: 'evidence-part',
				manufacturer: '  Evidence Co  ',
				mpn: '  E-100  ',
				notes: '  pad  '
			}
		};
		const beforeQuotes = await db.select().from(quotes);
		const first = await ingest(body);
		expect(Object.keys(first.root).sort()).toEqual(['action', 'children', 'floor', 'lines', 'sku']);
		const saved = await item('evidence-part');
		expect(saved).toMatchObject({ manufacturer: 'Evidence Co', mpn: 'E-100', notes: '  pad  ' });
		const recorded = await evidence('evidence-part');
		expect(recorded.sources).toMatchObject([
			{ kind: 'notebook', locator: '../AICamera/docs/SHOPPING.md' }
		]);
		expect(recorded.links).toHaveLength(1);
		expect(recorded.enrichments).toHaveLength(3);
		for (const field of ['manufacturer', 'mpn', 'notes']) {
			expect(recorded.enrichments.find((fact) => fact.field === field)).toMatchObject({
				value: saved[field],
				method: 'ingest',
				sourceId: recorded.sources[0].id,
				body: null
			});
		}
		await ingest({ ...body, source: '../AICamera/docs/SHOPPING.md' });
		expect(await evidence('evidence-part')).toEqual(recorded);
		expect(recorded.thoughts).toEqual([]);
		expect(await db.select().from(quotes)).toEqual(beforeQuotes);
	});

	it('links every supplied locator, defaults kinds, and retains the first kind and title', async () => {
		const retained = await write(
			'/sources',
			{
				kind: 'analysis',
				locator: 'https://example.com/existing',
				title: 'Original'
			},
			200
		);
		await ingest({
			source: '../request.md',
			root: {
				sku: 'many-sources',
				mpn: 'MANY-100',
				source: ' https://example.com/support ',
				sources: [
					{ locator: 'https://example.com/existing', kind: 'datasheet' },
					{ locator: 'http://example.com/extra' },
					{ locator: 'docs/spec.pdf', kind: 'datasheet' },
					{ locator: 'docs/default.md' },
					{ locator: ' https://example.com/support ' },
					{ locator: ' \t ' }
				]
			}
		});
		const result = await evidence('many-sources');
		expect(result.links).toHaveLength(6);
		expect(result.sources).toHaveLength(6);
		expect(result.sources.find((s) => s.id === retained.id)).toEqual(retained);
		for (const [locator, kind] of [
			['../request.md', 'notebook'],
			['https://example.com/support', 'link'],
			['http://example.com/extra', 'link'],
			['docs/spec.pdf', 'datasheet'],
			['docs/default.md', 'notebook']
		])
			expect(result.sources.find((s) => s.locator === locator)?.kind).toBe(kind);
		expect(result.enrichments).toMatchObject([
			{
				field: 'mpn',
				value: 'MANY-100',
				sourceId: result.sources.find((s) => s.locator === 'https://example.com/support')!.id
			}
		]);
	});

	it('a child cites and links the request source rather than the parent override', async () => {
		await ingest({
			source: '../AICamera/docs/A.md',
			root: {
				sku: 'source-parent',
				source: '../AICamera/docs/B.md',
				notes: 'Parent note',
				children: [{ sku: 'source-child', mpn: 'CHILD-100' }]
			}
		});
		const parent = await evidence('source-parent');
		const child = await evidence('source-child');
		expect(parent.sources.map((s) => s.locator)).toEqual([
			'../AICamera/docs/A.md',
			'../AICamera/docs/B.md'
		]);
		expect(parent.enrichments[0].sourceId).toBe(parent.sources[1].id);
		expect(child.sources).toMatchObject([{ locator: '../AICamera/docs/A.md' }]);
		expect(child.links).toHaveLength(1);
		expect(child.enrichments[0].sourceId).toBe(child.sources[0].id);
		expect((await item('source-child')).source).toBe('../AICamera/docs/A.md');
	});

	it('matches fill-null fields and cites the incoming document while keeping an older source', async () => {
		await bareItem('fill-facts', { source: '../AICamera/docs/OLD.md', notes: 'Original note' });
		const body = {
			source: '../AICamera/docs/NEW.md',
			root: {
				sku: 'fill-facts',
				manufacturer: '  Fill Co  ',
				mpn: '  FILL-100  ',
				notes: 'Ignored'
			}
		};
		expect((await ingest(body)).root.action).toBe('matched');
		expect(await item('fill-facts')).toMatchObject({
			manufacturer: 'Fill Co',
			mpn: 'FILL-100',
			source: '../AICamera/docs/OLD.md',
			notes: 'Original note'
		});
		const recorded = await evidence('fill-facts');
		expect(recorded.enrichments).toHaveLength(2);
		expect(recorded.sources).toMatchObject([{ locator: '../AICamera/docs/NEW.md' }]);
		for (const fact of recorded.enrichments) {
			expect(fact.sourceId).toBe(recorded.sources[0].id);
			expect(fact.value).toBe(fact.field === 'mpn' ? 'FILL-100' : 'Fill Co');
		}
		await ingest(body);
		expect(await evidence('fill-facts')).toEqual(recorded);
		// Re-filling the same value after clearing columns exercises tuple deduplication.
		await write('/items/fill-facts', { manufacturer: null, mpn: null }, 200, 'PATCH');
		await ingest(body);
		expect(await evidence('fill-facts')).toEqual(recorded);
	});

	it('records only the MPN newly filled on an otherwise unpaired SKU match', async () => {
		await bareItem('fill-mpn', { source: '../old.md' });
		await ingest({ source: '../current.md', root: { sku: 'fill-mpn', mpn: ' ABC ' } });
		expect(await item('fill-mpn')).toMatchObject({ mpn: 'ABC', source: '../old.md' });
		const result = await evidence('fill-mpn');
		expect(result.enrichments).toMatchObject([
			{ field: 'mpn', value: 'ABC', sourceId: result.sources[0].id }
		]);
	});

	it('links a new document without recording unchanged populated fields or matched notes', async () => {
		await bareItem('unchanged-fields', { manufacturer: 'Fixed', mpn: 'FIXED-100', notes: 'Kept' });
		await ingest({
			source: 'https://example.com/new-link',
			root: { sku: 'unchanged-fields', manufacturer: 'Fixed', mpn: 'FIXED-100', notes: 'Ignore' }
		});
		const result = await evidence('unchanged-fields');
		expect(result.links).toHaveLength(1);
		expect(result.enrichments).toEqual([]);
		expect((await item('unchanged-fields')).notes).toBe('Kept');
	});

	it('does not revalidate a legacy item source when the match keeps it', async () => {
		await bareItem('legacy-source', { source: 'file:///old/unrestricted.pdf' });
		await ingest({
			source: '../current-legacy.md',
			root: { sku: 'legacy-source', mpn: 'LEGACY-100' }
		});
		expect((await item('legacy-source')).source).toBe('file:///old/unrestricted.pdf');
		const result = await evidence('legacy-source');
		expect(result.sources).toMatchObject([{ locator: '../current-legacy.md' }]);
		expect(result.enrichments[0].sourceId).toBe(result.sources[0].id);
	});

	it('preserves padded and empty notes and omits whitespace-only identity facts', async () => {
		await ingest({
			root: { sku: 'padded-fields', manufacturer: '   ', mpn: ' PAD-100 ', notes: '  pad  ' }
		});
		expect(await item('padded-fields')).toMatchObject({
			manufacturer: null,
			mpn: 'PAD-100',
			notes: '  pad  '
		});
		const padded = await evidence('padded-fields');
		expect(padded.enrichments.map((f) => [f.field, f.value]).sort()).toEqual([
			['mpn', 'PAD-100'],
			['notes', '  pad  ']
		]);
		await ingest({ root: { sku: 'empty-notes', manufacturer: '\t', mpn: ' ', notes: '' } });
		expect(await item('empty-notes')).toMatchObject({ manufacturer: null, mpn: null, notes: '' });
		expect((await evidence('empty-notes')).enrichments).toMatchObject([
			{ field: 'notes', value: '', sourceId: null }
		]);
		for (const notes of [undefined, null]) {
			const sku = notes === null ? 'null-notes' : 'omitted-notes';
			await ingest({ root: { sku, notes } });
			expect((await evidence(sku)).enrichments).toEqual([]);
		}
	});

	it.each([undefined, null, '', ' \t\n '])(
		'accepts absent or blank sources: %j',
		async (source) => {
			const sku = `blank-source-${source === undefined ? 'omitted' : source === null ? 'null' : source.length}`;
			const body = { source, root: { sku, source, manufacturer: ' Blank Co ', mpn: `MPN-${sku}` } };
			await ingest(body);
			const recorded = await evidence(sku);
			expect(recorded.sources).toEqual([]);
			expect(recorded.enrichments).toHaveLength(2);
			expect(recorded.enrichments.every((f) => f.sourceId === null)).toBe(true);
			await ingest(body);
			await write(`/items/${sku}`, { manufacturer: null, mpn: null }, 200, 'PATCH');
			await ingest(body);
			expect(await evidence(sku)).toEqual(recorded);
		}
	);

	it('blank node sources use the request citation while item source behavior stays unchanged', async () => {
		await ingest({
			source: '../blank-override.md',
			root: { sku: 'blank-override', source: '  ', notes: 'New' }
		});
		expect((await item('blank-override')).source).toBe('  ');
		const created = await evidence('blank-override');
		expect(created.enrichments[0].sourceId).toBe(created.sources[0].id);
		await bareItem('blank-match');
		await ingest({
			source: '../blank-match.md',
			root: { sku: 'blank-match', source: '  ', manufacturer: '  ', mpn: '  ' }
		});
		expect(await item('blank-match')).toMatchObject({
			manufacturer: null,
			mpn: null,
			source: '  '
		});
		const matched = await evidence('blank-match');
		expect(matched.links).toHaveLength(1);
		expect(matched.enrichments).toEqual([]);
	});

	it('supplemental sources are links and do not choose an otherwise null citation', async () => {
		await ingest({
			root: { sku: 'supplemental-only', mpn: 'SUPP-100', sources: [{ locator: 'docs/extra.pdf' }] }
		});
		const result = await evidence('supplemental-only');
		expect(result.links).toHaveLength(1);
		expect(result.enrichments).toMatchObject([{ field: 'mpn', sourceId: null }]);
	});

	it.each([
		'file:///tmp/brief.pdf',
		'/tmp/brief.pdf',
		'ftp://example.com/doc',
		'https://',
		'a legacy description'
	])('rejects illegal locators atomically in every candidate position: %s', async (locator) => {
		for (const body of [
			{ source: locator, root: { sku: 'illegal-request' } },
			{ source: '../valid-before-error.md', root: { sku: 'illegal-node', source: locator } },
			{
				source: '../valid-before-error.md',
				root: { sku: 'illegal-array', sources: [{ locator }] }
			},
			{
				source: '../valid-before-error.md',
				root: {
					sku: 'illegal-child-root',
					notes: 'Rolled back',
					children: [{ sku: 'illegal-child', source: locator }]
				}
			}
		]) {
			const before = await snapshot();
			await ingest(body, 422);
			expect(await snapshot()).toEqual(before);
		}
	});

	it('rejects invalid source array shapes and kinds without writes', async () => {
		for (const entries of [
			[{ kind: 'invented', locator: '../doc.md' }],
			[{ kind: 'link' }],
			['../doc.md']
		]) {
			const before = await snapshot();
			await ingest({ root: { sku: 'bad-source-shape', sources: entries } }, 422);
			expect(await snapshot()).toEqual(before);
		}
	});

	it('a floor rejection after evidence writes rolls the entire tree back', async () => {
		const before = await snapshot();
		await ingest(
			{
				source: '../rollback-floor.md',
				root: {
					sku: 'rollback-evidence-root',
					notes: 'Must disappear',
					children: [
						{
							sku: 't4000-som',
							children: [{ sku: 'rollback-evidence-child' }]
						}
					]
				}
			},
			409
		);
		expect(await snapshot()).toEqual(before);
		expect((await root.request('/api/v1/items/rollback-evidence-root')).status).toBe(404);
	});

	it('a cycle rejection rolls back evidence and null fills on existing items', async () => {
		await bareItem('cycle-evidence', { floor: 'assemble' });
		const before = await snapshot();
		await ingest(
			{
				source: '../rollback-cycle.md',
				root: {
					sku: 'cycle-evidence',
					mpn: 'CYCLE-100',
					children: [{ sku: 'cycle-evidence' }]
				}
			},
			409
		);
		expect(await snapshot()).toEqual(before);
	});

	it('a failed evidence insert rolls back items, sources, links, and previous facts', async () => {
		const before = await snapshot();
		await client.exec(`CREATE FUNCTION fail_ingest_fact() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN RAISE EXCEPTION 'injected evidence failure'; END $$;
			CREATE TRIGGER fail_ingest_fact BEFORE INSERT ON enrichments FOR EACH ROW
			WHEN (NEW.item_sku = 'fail-evidence-child') EXECUTE FUNCTION fail_ingest_fact();`);
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await ingest(
				{
					source: '../rollback-fact.md',
					root: {
						sku: 'fail-evidence-parent',
						notes: 'Parent fact',
						children: [{ sku: 'fail-evidence-child', notes: 'Fails' }]
					}
				},
				500
			);
			expect(await snapshot()).toEqual(before);
		} finally {
			errors.mockRestore();
			await client.exec(
				'DROP TRIGGER fail_ingest_fact ON enrichments; DROP FUNCTION fail_ingest_fact();'
			);
		}
	});

	it('publishes the optional recursive source links in canonical OpenAPI discovery', async () => {
		const canonical = await root.request('/.well-known/openapi.json');
		const versioned = await root.request('/api/v1/openapi.json');
		const text = await canonical.text();
		expect(text).toBe(await versioned.text());
		const spec = JSON.parse(text);
		const schema = spec.components.schemas.IngestNode;
		expect(schema.required ?? []).not.toContain('sources');
		expect(schema.properties.sources.items.required).toEqual(['locator']);
		expect(schema.properties.sources.items.properties.kind.enum).toEqual([
			'notebook',
			'datasheet',
			'link',
			'analysis'
		]);
		expect(schema.properties.children.items.$ref).toBe('#/components/schemas/IngestNode');
	});
});
