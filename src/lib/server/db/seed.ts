import { count, inArray, sql } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { seedBoms, seedItems, seedVendors } from './catalog';
import * as schema from './schema';
import { bomLines, items, quotes, vendors } from './schema';

export type DabomDb = PgliteDatabase<typeof schema>;

export async function seed(db: DabomDb, opts: { force?: boolean } = {}) {
	const [{ n }] = await db.select({ n: count() }).from(items);
	if (n > 0 && !opts.force) return { seeded: false, itemCount: n };

	if (opts.force) {
		await db.delete(bomLines);
		await db.delete(quotes);
		await db.delete(items);
		await db.delete(vendors);
	}

	await db.insert(vendors).values(seedVendors).onConflictDoNothing();

	for (const row of seedItems) {
		const { quote, ...item } = row;
		await db
			.insert(items)
			.values(item)
			.onConflictDoUpdate({
				target: items.sku,
				set: {
					name: item.name,
					kind: item.kind,
					floor: item.floor,
					category: item.category,
					status: item.status,
					description: item.description,
					manufacturer: item.manufacturer,
					mpn: item.mpn,
					notes: item.notes,
					source: item.source,
					massG: item.massG,
					widthMm: item.widthMm,
					heightMm: item.heightMm,
					depthMm: item.depthMm,
					wattsTypical: item.wattsTypical,
					wattsMax: item.wattsMax,
					updatedAt: new Date()
				}
			});
		if (quote) {
			// Mirrors migration 0002. The catalog carries no method: a priced
			// catalog row is where a number came from (`seed`); a priceless one
			// is a human "ask them for a quote" note (`manual`).
			const method = quote.method ?? (quote.priceCents == null ? 'manual' : 'seed');
			await db.insert(quotes).values({ ...quote, method, itemSku: item.sku });
		}
	}

	if (seedBoms.length) {
		await db.insert(bomLines).values(
			seedBoms.map((line) => ({
				parentSku: line.parentSku,
				childSku: line.childSku,
				qty: line.qty,
				role: line.role ?? '',
				notes: line.notes,
				optional: line.optional ?? false,
				sortOrder: line.sortOrder ?? 0
			}))
		);
	}

	// Backfill, mirroring migration 0001. The shipped catalog now names the
	// floor on every row, so this is a no-op on the seed — the catalog test
	// pins all eight `seedBoms` parents to `assemble` already. It stays as a
	// second door for a catalog that grew a parent without naming it.
	await db
		.update(items)
		.set({ floor: 'assemble' })
		.where(inArray(items.sku, sql`(select distinct parent_sku from bom_lines)`));

	const [{ n: after }] = await db.select({ n: count() }).from(items);
	return { seeded: true, itemCount: after };
}
