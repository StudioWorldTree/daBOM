import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApi } from '../api/app';
import { seedItems } from './catalog';
import { createDb, openDb } from './index';
import { backfillSourceLinks } from './evidence';
import { enrichments, items, sources, thoughts, thoughtSources, itemSources } from './schema';
import { seed, type DabomDb } from './seed';

const migrations = path.resolve('drizzle');

async function catalogLinks(db: DabomDb) {
	return db
		.select({ sku: itemSources.itemSku, locator: sources.locator })
		.from(itemSources)
		.innerJoin(sources, eq(sources.id, itemSources.sourceId))
		.orderBy(itemSources.itemSku, sources.locator);
}
const expectedLinks = seedItems
	.filter((row) => row.source?.trim())
	.map((row) => ({ sku: row.sku, locator: row.source!.trim() }))
	.sort((a, b) => a.sku.localeCompare(b.sku));

/** A real pre-evidence migration history, so the normal migrator performs the upgrade. */
async function legacyDatabase() {
	const folder = await mkdtemp(path.join(os.tmpdir(), 'dabom-evidence-migrations-'));
	const client = new PGlite();
	try {
		await mkdir(path.join(folder, 'meta'));
		const journal = JSON.parse(await readFile(path.join(migrations, 'meta/_journal.json'), 'utf8'));
		journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 3);
		await writeFile(path.join(folder, 'meta/_journal.json'), JSON.stringify(journal));
		for (const entry of journal.entries)
			await copyFile(
				path.join(migrations, `${entry.tag}.sql`),
				path.join(folder, `${entry.tag}.sql`)
			);
		const db = createDb(client);
		await migrate(db, { migrationsFolder: folder });
		return { client, db };
	} catch (error) {
		await client.close();
		throw error;
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

describe('evidence migration, boot, and reseed', () => {
	it('upgrades existing catalog and legacy text without rewriting columns or inventing history', async () => {
		const { client, db } = await legacyDatabase();
		try {
			await db.insert(items).values(seedItems.map(({ quote: _quote, ...row }) => row));
			await db.insert(items).values([
				{
					sku: 'legacy-whitespace',
					name: 'Whitespace',
					kind: 'part',
					category: 'compute',
					source: ` \t${seedItems[0].source}\n `
				},
				{
					sku: 'legacy-invalid',
					name: 'Old prose',
					kind: 'part',
					category: 'compute',
					source: '  legacy prose, not a path  '
				},
				{ sku: 'legacy-blank', name: 'Blank', kind: 'part', category: 'compute', source: ' \n\t ' },
				{ sku: 'legacy-null', name: 'Null', kind: 'part', category: 'compute' }
			]);
			const before = await db.select().from(items).orderBy(items.sku);
			await migrate(db, { migrationsFolder: migrations });
			expect(await db.select().from(items).orderBy(items.sku)).toEqual(before);
			const links = await catalogLinks(db);
			expect(links.filter((row) => !row.sku.startsWith('legacy-'))).toEqual(expectedLinks);
			expect(links.filter((row) => row.sku.startsWith('legacy-'))).toEqual([
				{ sku: 'legacy-invalid', locator: 'legacy prose, not a path' },
				{ sku: 'legacy-whitespace', locator: seedItems[0].source!.trim() }
			]);
			const docs = await db.select().from(sources);
			expect(docs).toHaveLength(
				new Set([...expectedLinks.map((row) => row.locator), 'legacy prose, not a path']).size
			);
			expect(docs.every((row) => row.kind === 'notebook')).toBe(true);
			expect(await db.select().from(enrichments)).toEqual([]);
			expect(await db.select().from(thoughts)).toEqual([]);
			const app = createApi(db);
			const result = await (await app.request('/items/legacy-invalid/evidence')).json();
			expect(result.sources[0].locator).toBe('legacy prose, not a path');
			await migrate(db, { migrationsFolder: migrations });
			expect(await catalogLinks(db)).toEqual(links);
		} finally {
			await client.close();
		}
	});

	it('fresh openDb migrates before seed and links every catalog source', async () => {
		const { client, db } = await openDb({ dataDir: 'memory://' });
		try {
			expect(await catalogLinks(db)).toEqual(expectedLinks);
			expect(await db.select().from(sources)).toHaveLength(
				new Set(expectedLinks.map((row) => row.locator)).size
			);
			expect(await db.select().from(enrichments)).toEqual([]);
			expect(await db.select().from(thoughts)).toEqual([]);
			expect((await seed(db)).seeded).toBe(false);
			expect(await catalogLinks(db)).toEqual(expectedLinks);
		} finally {
			await client.close();
		}
	});

	it('force reseed removes all evidence children and restores the fresh catalog links', async () => {
		const { client, db } = await openDb({ dataDir: 'memory://' });
		try {
			const [doc] = await db.select().from(sources).limit(1);
			const before = await catalogLinks(db);
			await db
				.update(sources)
				.set({ kind: 'analysis', title: 'Keep original metadata' })
				.where(eq(sources.id, doc.id));
			await db
				.insert(enrichments)
				.values({ itemSku: seedItems[0].sku, value: 'Observation', sourceId: doc.id });
			const [thought] = await db
				.insert(thoughts)
				.values({ itemSku: seedItems[0].sku, body: 'Thought' })
				.returning();
			await db.insert(thoughtSources).values({ thoughtId: thought.id, sourceId: doc.id });
			expect((await seed(db, { force: true })).seeded).toBe(true);
			expect(await catalogLinks(db)).toEqual(before);
			expect(await catalogLinks(db)).toEqual(expectedLinks);
			expect(await db.select().from(enrichments)).toEqual([]);
			expect(await db.select().from(thoughts)).toEqual([]);
			expect(await db.select().from(thoughtSources)).toEqual([]);
			expect(await db.select().from(sources).where(eq(sources.id, doc.id))).toMatchObject([
				{ kind: 'analysis', title: 'Keep original metadata' }
			]);
			await backfillSourceLinks(db);
			expect(await catalogLinks(db)).toEqual(before);
		} finally {
			await client.close();
		}
	});
});
