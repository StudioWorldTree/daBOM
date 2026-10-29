import { asc, eq, inArray, or } from 'drizzle-orm';
import { getItemOrThrow, HttpError, type Db } from './bom';
import {
	enrichments,
	itemSources,
	items,
	sources,
	thoughts,
	thoughtSources,
	type DabomDb
} from './db';

type NewSource = typeof sources.$inferInsert;
type SourceInput = Pick<NewSource, 'kind' | 'locator' | 'title'>;

export async function getSourceOrThrow(db: Db, id: string) {
	const [source] = await db.select().from(sources).where(eq(sources.id, id));
	if (!source) throw new HttpError(404, `Source ${id} not found`);
	return source;
}

/** Retry reuses identity without changing the first recorded kind or title. */
export async function createSource(db: Db, input: SourceInput) {
	const locator = input.locator.trim();
	const [created] = await db
		.insert(sources)
		.values({ ...input, locator })
		.onConflictDoNothing({ target: sources.locator })
		.returning();
	if (created) return created;
	const [existing] = await db.select().from(sources).where(eq(sources.locator, locator));
	return existing;
}

export async function linkSource(
	db: DabomDb,
	sku: string,
	input: { sourceId: string } | SourceInput
) {
	return db.transaction(async (tx) => {
		await getItemOrThrow(tx, sku);
		const source =
			'sourceId' in input
				? await getSourceOrThrow(tx, input.sourceId)
				: await createSource(tx, input);
		const link = { itemSku: sku, sourceId: source.id };
		await tx.insert(itemSources).values(link).onConflictDoNothing();
		return link;
	});
}

export async function addEnrichment(
	db: DabomDb,
	sku: string,
	input: Omit<typeof enrichments.$inferInsert, 'id' | 'itemSku' | 'createdAt'>
) {
	return db.transaction(async (tx) => {
		await getItemOrThrow(tx, sku);
		if (input.sourceId) await getSourceOrThrow(tx, input.sourceId);
		const [row] = await tx
			.insert(enrichments)
			.values({ ...input, itemSku: sku })
			.returning();
		return row;
	});
}

export async function addThought(
	db: DabomDb,
	sku: string,
	input: { body: string; sourceIds: string[] }
) {
	return db.transaction(async (tx) => {
		await getItemOrThrow(tx, sku);
		const sourceIds = [...new Set(input.sourceIds)].sort();
		for (const id of sourceIds) await getSourceOrThrow(tx, id);
		const [thought] = await tx
			.insert(thoughts)
			.values({ itemSku: sku, body: input.body })
			.returning();
		if (sourceIds.length) {
			await tx
				.insert(thoughtSources)
				.values(sourceIds.map((sourceId) => ({ thoughtId: thought.id, sourceId })));
		}
		return { ...thought, sourceIds };
	});
}

export async function itemEvidence(db: Db, sku: string) {
	await getItemOrThrow(db, sku);
	const links = await db
		.select()
		.from(itemSources)
		.where(eq(itemSources.itemSku, sku))
		.orderBy(asc(itemSources.sourceId));
	const facts = await db
		.select()
		.from(enrichments)
		.where(eq(enrichments.itemSku, sku))
		.orderBy(asc(enrichments.createdAt), asc(enrichments.id));
	const notes = await db
		.select()
		.from(thoughts)
		.where(eq(thoughts.itemSku, sku))
		.orderBy(asc(thoughts.createdAt), asc(thoughts.id));
	const citations = await db
		.select({ thoughtId: thoughtSources.thoughtId, sourceId: thoughtSources.sourceId })
		.from(thoughtSources)
		.innerJoin(thoughts, eq(thoughts.id, thoughtSources.thoughtId))
		.where(eq(thoughts.itemSku, sku))
		.orderBy(asc(thoughtSources.sourceId));
	const ids = [
		...new Set([
			...links.map((link) => link.sourceId),
			...facts.flatMap((fact) => (fact.sourceId ? [fact.sourceId] : [])),
			...citations.map((citation) => citation.sourceId)
		])
	];
	const documents = ids.length
		? await db
				.select()
				.from(sources)
				.where(inArray(sources.id, ids))
				.orderBy(asc(sources.locator), asc(sources.id))
		: [];
	return {
		itemSku: sku,
		links,
		sources: documents,
		enrichments: facts,
		thoughts: notes.map((note) => ({
			...note,
			sourceIds: citations.filter((c) => c.thoughtId === note.id).map((c) => c.sourceId)
		}))
	};
}

export async function sourceEvidence(db: Db, id: string) {
	const source = await getSourceOrThrow(db, id);
	const linked = db
		.select({ sku: itemSources.itemSku })
		.from(itemSources)
		.where(eq(itemSources.sourceId, id));
	const enriched = db
		.select({ sku: enrichments.itemSku })
		.from(enrichments)
		.where(eq(enrichments.sourceId, id));
	const considered = db
		.select({ sku: thoughts.itemSku })
		.from(thoughts)
		.innerJoin(thoughtSources, eq(thoughtSources.thoughtId, thoughts.id))
		.where(eq(thoughtSources.sourceId, id));
	const reached = await db
		.select()
		.from(items)
		.where(
			or(inArray(items.sku, linked), inArray(items.sku, enriched), inArray(items.sku, considered))
		)
		.orderBy(asc(items.sku));
	return { source, items: reached };
}
