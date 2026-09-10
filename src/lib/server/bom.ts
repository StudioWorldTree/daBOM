import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { bomLines, items, quotes, type DabomDb } from './db';

/**
 * The handle a transaction callback hands back. Every read/write helper here
 * takes `Db` so ingest can run the same guards inside one transaction that a
 * single-line POST runs against the pool.
 */
export type DabomTx = Parameters<Parameters<DabomDb['transaction']>[0]>[0];
export type Db = DabomDb | DabomTx;

export class HttpError extends Error {
	constructor(
		public status: 400 | 404 | 409 | 415 | 422,
		message: string,
		public details?: unknown
	) {
		super(message);
	}
}

export async function getItemOrThrow(db: Db, sku: string) {
	const row = await db.query.items.findFirst({
		where: eq(items.sku, sku),
		with: { quotes: true }
	});
	if (!row) throw new HttpError(404, `Item ${sku} not found`);
	return row;
}

/**
 * The one leaf predicate. Explode, partCount and the roll-up leaf sum all
 * branch here so they cannot drift. `buy` and `foundry` are both leaves;
 * nothing in this file may branch on `foundry` differently from `buy`.
 */
export function isLeaf(item: { floor: string }) {
	return item.floor !== 'assemble';
}

export type QuoteRow = {
	vendorId: string;
	isPreferred: boolean;
	priceCents: number | null;
	method: string;
	checkedAt: string | null;
	createdAt: Date | string;
};

const METHOD_RANK: Record<string, number> = {
	api: 0,
	headed: 1,
	crawl: 2,
	seed: 3,
	manual: 4
};

function methodRank(method: string) {
	return METHOD_RANK[method] ?? METHOD_RANK.manual;
}

/** Newest first. A row with no `checkedAt` is undated, so it sorts last. */
function newestFirst(a: QuoteRow, b: QuoteRow) {
	if (a.checkedAt !== b.checkedAt) {
		if (a.checkedAt == null) return 1;
		if (b.checkedAt == null) return -1;
		return a.checkedAt < b.checkedAt ? 1 : -1;
	}
	return String(b.createdAt).localeCompare(String(a.createdAt));
}

function bestForVendor(a: QuoteRow, b: QuoteRow) {
	const rank = methodRank(a.method) - methodRank(b.method);
	return rank !== 0 ? rank : newestFirst(a, b);
}

/**
 * The roll-up rule, and the only place it lives.
 *
 * Within a vendor: best method rank, then newest. Not "latest row", because
 * a Sep 1 `api` price is the vendor speaking and a Sep 8 `crawl` of the same
 * page is us guessing.
 *
 * Across vendors: the preferred vendor if it has a priced row, else best
 * method rank, then newest, then vendor id so the answer never depends on
 * row order. Priceless rows never win — a failed fetch or an unanswered
 * "quote with the carrier" is not a price.
 */
export function pickQuote<T extends QuoteRow>(rows: T[]) {
	const priced = rows.filter((q) => q.priceCents != null);
	if (priced.length === 0) return null;

	const preferredVendors = new Set(rows.filter((q) => q.isPreferred).map((q) => q.vendorId));

	const byVendor = new Map<string, T>();
	for (const row of priced) {
		const held = byVendor.get(row.vendorId);
		if (!held || bestForVendor(row, held) < 0) byVendor.set(row.vendorId, row);
	}

	const chosen = [...byVendor.values()];
	const preferred = chosen.filter((q) => preferredVendors.has(q.vendorId));
	const pool = preferred.length ? preferred : chosen;
	return pool.sort((a, b) => bestForVendor(a, b) || a.vendorId.localeCompare(b.vendorId))[0];
}

export async function wouldCycle(db: Db, parentSku: string, childSku: string) {
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
		floor: string;
		category: string;
		status: string;
		manufacturer: string | null;
		mpn: string | null;
	};
	unitPriceCents: number | null;
	unitPriceCheckedAt: string | null;
	extendedCents: number | null;
};

export async function listBom(db: Db, parentSku: string): Promise<BomLineView[]> {
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
		const quote = pickQuote(bySku.get(c.sku) ?? []);
		const unitPriceCents = quote?.priceCents ?? null;
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
				floor: c.floor,
				category: c.category,
				status: c.status,
				manufacturer: c.manufacturer,
				mpn: c.mpn
			},
			unitPriceCents,
			unitPriceCheckedAt: quote?.checkedAt ?? null,
			extendedCents
		};
	});
}

export type ExplodedRow = BomLineView & { path: string[]; qtyEach: number; qtyRollup: number };

export async function explodeBom(db: Db, rootSku: string): Promise<ExplodedRow[]> {
	const out: ExplodedRow[] = [];
	async function walk(sku: string, path: string[], factor: number) {
		const lines = await listBom(db, sku);
		for (const line of lines) {
			const qtyRollup = factor * line.qty;
			out.push({ ...line, path: [...path, line.childSku], qtyEach: line.qty, qtyRollup });
			if (!isLeaf(line.child)) {
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
	/**
	 * Oldest `checkedAt` among the quotes this total is built from, or null if
	 * none of them carry a date. A method rank can keep a March `api` price
	 * ahead of a September crawl forever; `asOf` is what stops that being a
	 * silent lie.
	 */
	asOf: string | null;
	massG: number | null;
	wattsTypical: number | null;
	knownMassG: number;
	knownWattsTypical: number;
	lineCount: number;
	partCount: number;
};

export async function rollup(db: Db, rootSku: string): Promise<Rollup> {
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
	let asOf: string | null = null;

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
		const rootAsOf = q?.checkedAt ?? null;
		const leaf = q?.priceCents ?? 0;
		return {
			sku: rootSku,
			requiredCents: q?.priceCents ?? null,
			optionalCents: 0,
			knownRequiredCents: q?.priceCents == null ? 0 : leaf,
			knownOptionalCents: 0,
			missingQuotes: q?.priceCents == null ? [rootSku] : [],
			asOf: rootAsOf,
			massG: root.massG,
			wattsTypical: root.wattsTypical,
			knownMassG: root.massG ?? 0,
			knownWattsTypical: root.wattsTypical ?? 0,
			lineCount: 0,
			partCount: isLeaf(root) ? 1 : 0
		};
	}

	for (const row of exploded) {
		if (isLeaf(row.child)) {
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
			const dated = row.unitPriceCheckedAt;
			if (price != null && dated != null && (asOf == null || dated < asOf)) asOf = dated;
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
		asOf,
		massG: massUnknown ? null : mass,
		wattsTypical: wattsUnknown ? null : watts,
		knownMassG: mass,
		knownWattsTypical: watts,
		lineCount: exploded.length,
		partCount: leafSkus.size
	};
}

export async function whereUsed(db: Db, sku: string) {
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
	db: Db,
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
	const parent = await getItemOrThrow(db, parentSku);
	await getItemOrThrow(db, body.childSku);
	if (isLeaf(parent)) {
		throw new HttpError(
			409,
			`${parentSku} has floor ${parent.floor}; only assemble items can have BOM lines`
		);
	}
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
	db: Db,
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
	const [row] = await db.update(bomLines).set(patch).where(eq(bomLines.id, lineId)).returning();
	return row;
}

export async function deleteBomLine(db: Db, parentSku: string, lineId: string) {
	const [row] = await db
		.delete(bomLines)
		.where(and(eq(bomLines.id, lineId), eq(bomLines.parentSku, parentSku)))
		.returning();
	if (!row) throw new HttpError(404, `BOM line ${lineId} not found on ${parentSku}`);
	return row;
}

// --- ingest -----------------------------------------------------------
// Write-through: one POST becomes items and BOM lines in one transaction.
// There is no draft store, so every guard a single-line POST runs has to
// run here too, against the transaction handle rather than the pool.

const KEBAB = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The one slug function. Lowercase, NFKD, drop combining marks and anything
 * still non-ASCII, collapse the rest to single hyphens, trim the ends.
 * An empty result is the caller's 422 — a SKU is never invented from nothing.
 */
export function slugify(input: string) {
	return input
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\u0000-\u007f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Trimmed, case-folded, and empty-is-null, so " NVIDIA " and "nvidia" are one identity. */
function key(value: string | null | undefined) {
	const trimmed = (value ?? '').trim().toLowerCase();
	return trimmed === '' ? null : trimmed;
}

export type IngestNode = {
	sku?: string;
	name?: string;
	kind?: string;
	category?: string;
	status?: string;
	floor?: string;
	description?: string;
	manufacturer?: string | null;
	mpn?: string | null;
	notes?: string | null;
	source?: string | null;
	qty?: number;
	unit?: string;
	role?: string;
	lineNotes?: string | null;
	optional?: boolean;
	sortOrder?: number;
	children?: IngestNode[];
};

/** Mirrors `itemFloors`; the DTO layer needs the union, not `string`. */
export type FloorName = 'buy' | 'assemble' | 'foundry';

export type IngestResult = {
	sku: string;
	action: 'created' | 'matched';
	floor: FloorName;
	lines: string[];
	children: IngestResult[];
};

type Resolved = { sku: string; action: 'created' | 'matched'; floor: FloorName };

async function matchIngestRow(
	db: Db,
	row: {
		sku: string;
		floor: string;
		manufacturer: string | null;
		mpn: string | null;
		source: string | null;
	},
	node: IngestNode,
	source: string | null,
	hasChildren: boolean
): Promise<Resolved> {
	// "Cannot explode a buy SOM." Promotion is for nodes this request mints;
	// an existing leaf keeps its floor and the whole request is 409.
	if (hasChildren && row.floor !== 'assemble') {
		throw new HttpError(
			409,
			`${row.sku} has floor ${row.floor}; ingest cannot hang children on an existing ${row.floor} item`
		);
	}
	const patch: Partial<typeof items.$inferInsert> = {};
	if (row.manufacturer == null && node.manufacturer?.trim())
		patch.manufacturer = node.manufacturer.trim();
	if (row.mpn == null && node.mpn?.trim()) patch.mpn = node.mpn.trim();
	const incomingSource = node.source ?? source;
	if (row.source == null && incomingSource) patch.source = incomingSource;
	// Fill nulls only. Name, kind, category, status and floor on a matched
	// row are what a human or the seed decided; ingest does not relitigate.
	if (Object.keys(patch).length) {
		await db
			.update(items)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(items.sku, row.sku));
	}
	return { sku: row.sku, action: 'matched', floor: row.floor as FloorName };
}

async function createIngestRow(
	db: Db,
	sku: string,
	node: IngestNode,
	source: string | null,
	hasChildren: boolean
): Promise<Resolved> {
	const [row] = await db
		.insert(items)
		.values({
			sku,
			name: node.name?.trim() || sku,
			kind: node.kind ?? (hasChildren ? 'assembly' : 'part'),
			category: node.category ?? 'accessory',
			// Not `candidate`: a node ingest invented has nobody standing
			// behind it until someone looks.
			status: node.status ?? 'placeholder',
			floor: hasChildren ? 'assemble' : (node.floor ?? 'buy'),
			description: node.description ?? '',
			manufacturer: node.manufacturer?.trim() || null,
			mpn: node.mpn?.trim() || null,
			notes: node.notes ?? null,
			source: node.source ?? source
		})
		.returning();
	return { sku: row.sku, action: 'created', floor: row.floor as FloorName };
}

/**
 * Identity, in the order the delta pins: pair match, MPN-only match,
 * supplied sku, mint. A minted or supplied sku that lands on a *different*
 * identity is 409 — ingest never appends a `-2` suffix.
 */
async function resolveIngestNode(
	db: Db,
	node: IngestNode,
	source: string | null,
	hasChildren: boolean
): Promise<Resolved> {
	const mfr = key(node.manufacturer);
	const mpn = key(node.mpn);

	if (mpn) {
		const rows = await db
			.select()
			.from(items)
			.where(sql`lower(btrim(${items.mpn})) = ${mpn}`);
		if (mfr) {
			const pair = rows
				.filter((r) => key(r.manufacturer) === mfr)
				.sort((a, b) => a.sku.localeCompare(b.sku));
			if (pair.length) return matchIngestRow(db, pair[0], node, source, hasChildren);
		} else if (rows.length > 1) {
			throw new HttpError(
				409,
				`MPN ${node.mpn} matches ${rows.length} items; supply a manufacturer or a sku`,
				{ skus: rows.map((r) => r.sku).sort() }
			);
		} else if (rows.length === 1) {
			return matchIngestRow(db, rows[0], node, source, hasChildren);
		}
	}

	if (node.sku != null) {
		const supplied = node.sku.trim();
		if (!KEBAB.test(supplied)) throw new HttpError(422, `sku ${node.sku} is not kebab-case`);
		const row = await db.query.items.findFirst({ where: eq(items.sku, supplied) });
		if (row) {
			// A supplied sku is a reference. An incoming node with no
			// (manufacturer, mpn) pair claims no identity, so it never
			// collides — otherwise referencing `t4000-som` by sku would 409.
			const rowPaired = key(row.manufacturer) != null || key(row.mpn) != null;
			const incomingPaired = mfr != null || mpn != null;
			const same = key(row.manufacturer) === mfr && key(row.mpn) === mpn;
			if (rowPaired && incomingPaired && !same) {
				throw new HttpError(
					409,
					`sku ${supplied} is ${row.manufacturer ?? '—'} / ${row.mpn ?? '—'}, not ${node.manufacturer ?? '—'} / ${node.mpn ?? '—'}`
				);
			}
			return matchIngestRow(db, row, node, source, hasChildren);
		}
		return createIngestRow(db, supplied, node, source, hasChildren);
	}

	const minted =
		mfr && mpn
			? `${slugify(node.manufacturer as string)}-${slugify(node.mpn as string)}`
			: slugify(node.name ?? '');
	if (!minted || !KEBAB.test(minted)) {
		throw new HttpError(422, `cannot mint a kebab sku from ${JSON.stringify(node.name ?? '')}`);
	}
	const row = await db.query.items.findFirst({ where: eq(items.sku, minted) });
	if (row) {
		// A minted slug is a guess, not a reference. Landing on a row that
		// carries an MPN is a collision, not a match.
		const rowPaired = key(row.manufacturer) != null || key(row.mpn) != null;
		const same = key(row.manufacturer) === mfr && key(row.mpn) === mpn;
		if (rowPaired && !same) {
			throw new HttpError(
				409,
				`minted sku ${minted} already belongs to ${row.manufacturer ?? '—'} / ${row.mpn ?? '—'}`
			);
		}
		return matchIngestRow(db, row, node, source, hasChildren);
	}
	return createIngestRow(db, minted, node, source, hasChildren);
}

/** Idempotent on `(parent, child, role)`: a re-POST sets qty, it never adds a line. */
async function upsertIngestLine(
	db: Db,
	parentSku: string,
	childSku: string,
	node: IngestNode,
	index: number
) {
	const role = node.role ?? '';
	const qty = node.qty ?? 1;
	const existing = await db.query.bomLines.findFirst({
		where: and(
			eq(bomLines.parentSku, parentSku),
			eq(bomLines.childSku, childSku),
			eq(bomLines.role, role)
		)
	});
	if (existing) {
		if (qty < 1) throw new HttpError(422, 'qty must be >= 1');
		const [row] = await db
			.update(bomLines)
			.set({
				qty,
				unit: node.unit ?? existing.unit,
				notes: node.lineNotes ?? existing.notes,
				optional: node.optional ?? existing.optional,
				sortOrder: node.sortOrder ?? existing.sortOrder
			})
			.where(eq(bomLines.id, existing.id))
			.returning();
		return row.id;
	}
	// Same door as POST /items/{sku}/bom: floor guard, cycle guard, unique
	// index — on the transaction handle, so a cycle rolls the tree back.
	const row = await addBomLine(db, parentSku, {
		childSku,
		qty,
		unit: node.unit,
		role,
		notes: node.lineNotes ?? null,
		optional: node.optional,
		sortOrder: node.sortOrder ?? index * 10
	});
	return row.id;
}

async function walkIngest(db: Db, node: IngestNode, source: string | null): Promise<IngestResult> {
	const children = node.children ?? [];
	const self = await resolveIngestNode(db, node, source, children.length > 0);
	const lines: string[] = [];
	const kids: IngestResult[] = [];
	for (const [i, child] of children.entries()) {
		const kid = await walkIngest(db, child, source);
		kids.push(kid);
		lines.push(await upsertIngestLine(db, self.sku, kid.sku, child, i));
	}
	return { ...self, lines, children: kids };
}

/**
 * One transaction for the whole tree. Any throw rolls every row back, so a
 * 409 on the last child leaves no half-built root behind.
 */
export async function ingestTree(
	db: DabomDb,
	body: { source?: string | null; root: IngestNode }
): Promise<IngestResult> {
	return db.transaction((tx) => walkIngest(tx, body.root, body.source ?? null));
}
