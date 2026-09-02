import { count } from 'drizzle-orm';
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
			await db.insert(quotes).values({ ...quote, itemSku: item.sku });
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

	const [{ n: after }] = await db.select({ n: count() }).from(items);
	return { seeded: true, itemCount: after };
}
