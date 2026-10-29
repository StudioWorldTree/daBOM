import { sql } from 'drizzle-orm';
import type { DabomDb } from './seed';

/** Seed runs after migration, so new catalog rows need the same links as an upgrade. */
export async function backfillSourceLinks(db: Pick<DabomDb, 'execute'>) {
	await db.execute(sql`
		INSERT INTO sources (kind, locator)
		SELECT DISTINCT 'notebook', regexp_replace(source, '^[[:space:]]+|[[:space:]]+$', '', 'g')
		FROM items
		WHERE source IS NOT NULL
		  AND regexp_replace(source, '^[[:space:]]+|[[:space:]]+$', '', 'g') <> ''
		ON CONFLICT (locator) DO NOTHING
	`);
	await db.execute(sql`
		INSERT INTO item_sources (item_sku, source_id)
		SELECT items.sku, sources.id FROM items
		JOIN sources ON sources.locator = regexp_replace(items.source, '^[[:space:]]+|[[:space:]]+$', '', 'g')
		ON CONFLICT DO NOTHING
	`);
}
