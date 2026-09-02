import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { bomLines, items, quotes, type DabomDb } from './db';

export class HttpError extends Error {
	constructor(
		public status: 400 | 404 | 409 | 422,
		message: string,
		public details?: unknown
	) {
		super(message);
	}
}

export async function getItemOrThrow(db: DabomDb, sku: string) {
	const row = await db.query.items.findFirst({
		where: eq(items.sku, sku),
		with: { quotes: true }
	});
	if (!row) throw new HttpError(404, `Item ${sku} not found`);
	return row;
}

export function pickQuote<T extends { isPreferred: boolean; priceCents: number | null }>(rows: T[]) {
	return rows.find((q) => q.isPreferred && q.priceCents != null) ?? rows.find((q) => q.priceCents != null) ?? null;
}

export async function wouldCycle(db: DabomDb, parentSku: string, childSku: string) {
	if (parentSku === childSku) return true;
	const descendants = new Set<string>();
	let frontier = [childSku];
	while (frontier.length) {
		const rows = await db
			.select({ childSku: bomLines.childSku })
			.from(bomLines)
			.where(inArray(bomLines.parentSku, frontier));
		const next: string[] = [];
		for (const r of rows) {
			if (r.childSku === parentSku) return true;
			if (!descendants.has(r.childSku)) {
				descendants.add(r.childSku);
				next.push(r.childSku);
			}
		}
		frontier = next;
	}
	return false;
}

export type BomLineView = {
	id: string;
	parentSku: string;
	childSku: string;
	qty: number;
	unit: string;
	role: string;
	notes: string | null;
	optional: boolean;
	sortOrder: number;
	child: {
		sku: string;
		name: string;
		kind: string;
		category: string;
		status: string;
		manufacturer: string | null;
		mpn: string | null;
	};
	unitPriceCents: number | null;
	extendedCents: number | null;
};

export async function listBom(db: DabomDb, parentSku: string): Promise<BomLineView[]> {
	const child = alias(items, 'child');
	const rows = await db
		.select({
			line: bomLines,
			child
		})
		.from(bomLines)
		.innerJoin(child, eq(bomLines.childSku, child.sku))
		.where(eq(bomLines.parentSku, parentSku))
		.orderBy(bomLines.sortOrder, bomLines.role);

	const skuSet = [...new Set(rows.map((r) => r.child.sku))];
	const qrows =
		skuSet.length === 0
			? []
			: await db.select().from(quotes).where(inArray(quotes.itemSku, skuSet));
	const bySku = new Map<string, typeof qrows>();
	for (const q of qrows) {
		const list = bySku.get(q.itemSku) ?? [];
		list.push(q);
		bySku.set(q.itemSku, list);
	}

	return rows.map(({ line, child: c }) => {
		const unitPriceCents = pickQuote(bySku.get(c.sku) ?? [])?.priceCents ?? null;
		const extendedCents = unitPriceCents == null ? null : unitPriceCents * line.qty;
		return {
			id: line.id,
			parentSku: line.parentSku,
			childSku: line.childSku,
			qty: line.qty,
			unit: line.unit,
			role: line.role,
			notes: line.notes,
			optional: line.optional,
			sortOrder: line.sortOrder,
			child: {
				sku: c.sku,
				name: c.name,
				kind: c.kind,
				category: c.category,
				status: c.status,
				manufacturer: c.manufacturer,
				mpn: c.mpn
			},
			unitPriceCents,
			extendedCents
		};
	});
}

export type ExplodedRow = BomLineView & { path: string[]; qtyEach: number; qtyRollup: number };

export async function explodeBom(db: DabomDb, rootSku: string): Promise<ExplodedRow[]> {
	const out: ExplodedRow[] = [];
	async function walk(sku: string, path: string[], factor: number) {
		const lines = await listBom(db, sku);
		for (const line of lines) {
			const qtyRollup = factor * line.qty;
			out.push({ ...line, path: [...path, line.childSku], qtyEach: line.qty, qtyRollup });
			if (line.child.kind !== 'part') {
				await walk(line.childSku, [...path, line.childSku], qtyRollup);
			}
		}
	}
	await walk(rootSku, [rootSku], 1);
	return out;
}

export type Rollup = {
	sku: string;
	requiredCents: number | null;
	optionalCents: number | null;
	knownRequiredCents: number;
	knownOptionalCents: number;
	missingQuotes: string[];
	massG: number | null;
	wattsTypical: number | null;
	knownMassG: number;
	knownWattsTypical: number;
	lineCount: number;
	partCount: number;
};

export async function rollup(db: DabomDb, rootSku: string): Promise<Rollup> {
	const root = await getItemOrThrow(db, rootSku);
	const exploded = await explodeBom(db, rootSku);
	const missing = new Set<string>();
	let required = 0;
	let optional = 0;
	let reqUnknown = false;
	let optUnknown = false;
	let mass = 0;
	let massUnknown = false;
	let watts = 0;
	let wattsUnknown = false;
	const leafSkus = new Set<string>();

	const itemCache = new Map<string, Awaited<ReturnType<typeof getItemOrThrow>>>();
	itemCache.set(root.sku, root);

	async function itemOf(sku: string) {
		const hit = itemCache.get(sku);
		if (hit) return hit;
		const row = await getItemOrThrow(db, sku);
		itemCache.set(sku, row);
		return row;
	}

	if (exploded.length === 0) {
		const q = pickQuote(root.quotes);
		const leaf = q?.priceCents ?? 0;
		return {
			sku: rootSku,
			requiredCents: q?.priceCents ?? null,
			optionalCents: 0,
			knownRequiredCents: q?.priceCents == null ? 0 : leaf,
			knownOptionalCents: 0,
			missingQuotes: q?.priceCents == null ? [rootSku] : [],
			massG: root.massG,
			wattsTypical: root.wattsTypical,
			knownMassG: root.massG ?? 0,
			knownWattsTypical: root.wattsTypical ?? 0,
			lineCount: 0,
			partCount: root.kind === 'part' ? 1 : 0
		};
	}

	for (const row of exploded) {
		if (row.child.kind === 'part') {
			leafSkus.add(row.childSku);
			const child = await itemOf(row.childSku);
			const price = row.unitPriceCents;
			if (price == null) {
				missing.add(row.childSku);
				if (row.optional) optUnknown = true;
				else reqUnknown = true;
			} else if (row.optional) {
				optional += price * row.qtyRollup;
			} else {
				required += price * row.qtyRollup;
			}
			if (child.massG == null) massUnknown = true;
			else mass += child.massG * row.qtyRollup;
			if (child.wattsTypical == null) wattsUnknown = true;
			else watts += child.wattsTypical * row.qtyRollup;
		}
	}

	return {
		sku: rootSku,
		requiredCents: reqUnknown ? null : required,
		optionalCents: optUnknown ? null : optional,
		knownRequiredCents: required,
		knownOptionalCents: optional,
		missingQuotes: [...missing],
		massG: massUnknown ? null : mass,
		wattsTypical: wattsUnknown ? null : watts,
		knownMassG: mass,
		knownWattsTypical: watts,
		lineCount: exploded.length,
		partCount: leafSkus.size
	};
}

export async function whereUsed(db: DabomDb, sku: string) {
	await getItemOrThrow(db, sku);
	const parent = alias(items, 'parent');
	const rows = await db
		.select({ line: bomLines, parent })
		.from(bomLines)
		.innerJoin(parent, eq(bomLines.parentSku, parent.sku))
		.where(eq(bomLines.childSku, sku))
		.orderBy(parent.name);
	return rows.map(({ line, parent: p }) => ({
		id: line.id,
		parentSku: p.sku,
		parentName: p.name,
		parentKind: p.kind,
		qty: line.qty,
		role: line.role,
		optional: line.optional
	}));
}

export async function addBomLine(
	db: DabomDb,
	parentSku: string,
	body: {
		childSku: string;
		qty: number;
		unit?: string;
		role?: string;
		notes?: string | null;
		optional?: boolean;
		sortOrder?: number;
	}
) {
	await getItemOrThrow(db, parentSku);
	await getItemOrThrow(db, body.childSku);
	if (body.qty < 1) throw new HttpError(422, 'qty must be >= 1');
	if (await wouldCycle(db, parentSku, body.childSku)) {
		throw new HttpError(409, `Adding ${body.childSku} under ${parentSku} would cycle the BOM`);
	}
	try {
		const [row] = await db
			.insert(bomLines)
			.values({
				parentSku,
				childSku: body.childSku,
				qty: body.qty,
				unit: body.unit ?? 'ea',
				role: body.role ?? '',
				notes: body.notes ?? null,
				optional: body.optional ?? false,
				sortOrder: body.sortOrder ?? 0
			})
			.returning();
		return row;
	} catch (err) {
		const bag = [
			err instanceof Error ? err.message : String(err),
			err instanceof Error && 'cause' in err ? String(err.cause) : '',
			typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : ''
		].join(' ');
		if (/unique|duplicate|23505|bom_parent_child_role/i.test(bag)) {
			throw new HttpError(409, 'A line with this child and role already exists on the parent');
		}
		throw err;
	}
}

export async function updateBomLine(
	db: DabomDb,
	parentSku: string,
	lineId: string,
	patch: Partial<{
		qty: number;
		unit: string;
		role: string;
		notes: string | null;
		optional: boolean;
		sortOrder: number;
	}>
) {
	const existing = await db.query.bomLines.findFirst({
		where: and(eq(bomLines.id, lineId), eq(bomLines.parentSku, parentSku))
	});
	if (!existing) throw new HttpError(404, `BOM line ${lineId} not found on ${parentSku}`);
	if (patch.qty != null && patch.qty < 1) throw new HttpError(422, 'qty must be >= 1');
	const [row] = await db
		.update(bomLines)
		.set(patch)
		.where(eq(bomLines.id, lineId))
		.returning();
	return row;
}

export async function deleteBomLine(db: DabomDb, parentSku: string, lineId: string) {
	const [row] = await db
		.delete(bomLines)
		.where(and(eq(bomLines.id, lineId), eq(bomLines.parentSku, parentSku)))
		.returning();
	if (!row) throw new HttpError(404, `BOM line ${lineId} not found on ${parentSku}`);
	return row;
}
