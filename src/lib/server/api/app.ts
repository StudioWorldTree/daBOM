import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { and, count, desc, eq, ilike, ne, or } from 'drizzle-orm';
import {
	addBomLine,
	deleteBomLine,
	explodeBom,
	getItemOrThrow,
	HttpError,
	isLeaf,
	listBom,
	rollup,
	updateBomLine,
	whereUsed,
	wouldCycle
} from '../bom';
import { bomLines, items, quotes, vendors, type DabomDb } from '../db';
import { itemDto, quoteDto, vendorDto } from './dto';
import {
	BomLineCreateSchema,
	BomLinePatchSchema,
	BomLineSchema,
	BomReplaceSchema,
	BomSchema,
	ErrorSchema,
	ExplodeQuery,
	ExplodedBomSchema,
	ItemCreateSchema,
	ItemListQuery,
	ItemListSchema,
	ItemPatchSchema,
	ItemSchema,
	LineParam,
	HealthSchema,
	QuoteCreateSchema,
	QuoteListSchema,
	QuoteParam,
	QuotePatchSchema,
	QuoteSchema,
	RollupSchema,
	SkuParam,
	VendorCreateSchema,
	VendorParam,
	VendorListSchema,
	VendorSchema,
	WhereUsedSchema
} from './schemas';

const json = <T>(schema: T, description: string) => ({
	content: { 'application/json': { schema } },
	description
});

function err(status: 400 | 404 | 409 | 422, description: string) {
	return { [status]: json(ErrorSchema, description) } as const;
}

/** Rows for one (item, vendor) pair, newest insert first. */
async function pairHistory(db: Pick<DabomDb, 'select'>, itemSku: string, vendorId: string) {
	return db
		.select()
		.from(quotes)
		.where(and(eq(quotes.itemSku, itemSku), eq(quotes.vendorId, vendorId)))
		.orderBy(desc(quotes.createdAt), desc(quotes.id));
}

export function createApi(db: DabomDb) {
	const app = new OpenAPIHono({
		defaultHook: (result, c) => {
			if (!result.success) {
				return c.json({ error: 'validation failed', details: result.error.flatten() }, 422);
			}
		}
	});

	app.onError((err, c) => {
		if (err instanceof HttpError) {
			return c.json({ error: err.message, details: err.details ?? null }, err.status);
		}
		console.error(err);
		return c.json({ error: err instanceof Error ? err.message : 'internal error' }, 500);
	});

	app.openapi(
		createRoute({
			method: 'get',
			path: '/health',
			tags: ['Meta'],
			summary: 'Liveness',
			responses: { 200: json(HealthSchema, 'ok') }
		}),
		(c) => c.json({ ok: true })
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/items',
			tags: ['Items'],
			summary: 'List items',
			request: { query: ItemListQuery },
			responses: { 200: json(ItemListSchema, 'Catalog') }
		}),
		async (c) => {
			const q = c.req.valid('query');
			const filters = [];
			if (q.kind) filters.push(eq(items.kind, q.kind));
			if (q.floor) filters.push(eq(items.floor, q.floor));
			if (q.category) filters.push(eq(items.category, q.category));
			if (q.status) filters.push(eq(items.status, q.status));
			if (q.q) {
				const like = `%${q.q}%`;
				filters.push(
					or(
						ilike(items.sku, like),
						ilike(items.name, like),
						ilike(items.mpn, like),
						ilike(items.manufacturer, like)
					)
				);
			}
			const where = filters.length ? and(...filters) : undefined;
			const rows = await db.query.items.findMany({
				where,
				with: { quotes: true },
				orderBy: (t, { asc }) => [asc(t.kind), asc(t.name)]
			});
			const [{ n }] = await db.select({ n: count() }).from(items).where(where);
			return c.json({ items: rows.map(itemDto), total: n });
		}
	);

	app.openapi(
		createRoute({
			method: 'post',
			path: '/items',
			tags: ['Items'],
			summary: 'Create an item (empty BOM)',
			request: { body: json(ItemCreateSchema, 'New item') },
			responses: {
				201: json(ItemSchema, 'Created'),
				...err(409, 'SKU exists'),
				...err(422, 'Invalid')
			}
		}),
		async (c) => {
			const body = c.req.valid('json');
			const existing = await db.query.items.findFirst({ where: eq(items.sku, body.sku) });
			if (existing) throw new HttpError(409, `SKU ${body.sku} already exists`);
			const [row] = await db.insert(items).values(body).returning();
			return c.json(itemDto(row), 201);
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/items/{sku}',
			tags: ['Items'],
			summary: 'Get one item',
			request: { params: SkuParam },
			responses: { 200: json(ItemSchema, 'Item'), ...err(404, 'Missing') }
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			return c.json(itemDto(await getItemOrThrow(db, sku)));
		}
	);

	app.openapi(
		createRoute({
			method: 'patch',
			path: '/items/{sku}',
			tags: ['Items'],
			summary: 'Update an item',
			request: { params: SkuParam, body: json(ItemPatchSchema, 'Patch') },
			responses: {
				200: json(ItemSchema, 'Updated'),
				...err(404, 'Missing'),
				...err(409, 'Floor demoted while children exist')
			}
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			await getItemOrThrow(db, sku);
			const patch = c.req.valid('json');
			// Second door on the same invariant as the BOM-line insert guard:
			// an item that already has children cannot be demoted to a leaf.
			if (patch.floor && patch.floor !== 'assemble') {
				const children = await listBom(db, sku);
				if (children.length) {
					throw new HttpError(
						409,
						`${sku} has ${children.length} BOM lines; cannot set floor ${patch.floor}`,
						{
							childLines: children.length
						}
					);
				}
			}
			const [row] = await db
				.update(items)
				.set({ ...patch, updatedAt: new Date() })
				.where(eq(items.sku, sku))
				.returning();
			return c.json(itemDto(row));
		}
	);

	app.openapi(
		createRoute({
			method: 'delete',
			path: '/items/{sku}',
			tags: ['Items'],
			summary: 'Delete an item (must not be on any BOM)',
			request: { params: SkuParam },
			responses: { 200: json(ItemSchema, 'Deleted'), ...err(404, 'Missing'), ...err(409, 'In use') }
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			const item = await getItemOrThrow(db, sku);
			const used = await whereUsed(db, sku);
			const children = await listBom(db, sku);
			if (used.length || children.length) {
				throw new HttpError(409, 'Item is on a BOM; empty where-used and children first', {
					usedIn: used.length,
					childLines: children.length
				});
			}
			await db.delete(quotes).where(eq(quotes.itemSku, sku));
			await db.delete(items).where(eq(items.sku, sku));
			return c.json(itemDto(item));
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/items/{sku}/bom',
			tags: ['BOM'],
			summary: 'BOM for an item (empty for leaves). ?explode=true walks children.',
			request: { params: SkuParam, query: ExplodeQuery },
			responses: {
				200: json(BomSchema.or(ExplodedBomSchema), 'BOM'),
				...err(404, 'Missing')
			}
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			const { explode } = c.req.valid('query');
			const parent = await getItemOrThrow(db, sku);
			if (explode === 'true') {
				const lines = await explodeBom(db, sku);
				return c.json({ parent: itemDto(parent), lines, lineCount: lines.length });
			}
			const lines = await listBom(db, sku);
			return c.json({ parent: itemDto(parent), lines, lineCount: lines.length });
		}
	);

	app.openapi(
		createRoute({
			method: 'post',
			path: '/items/{sku}/bom',
			tags: ['BOM'],
			summary: 'Add a BOM line',
			request: { params: SkuParam, body: json(BomLineCreateSchema, 'Line') },
			responses: {
				201: json(BomLineSchema, 'Created'),
				...err(404, 'Missing'),
				...err(409, 'Cycle or duplicate'),
				...err(422, 'Invalid')
			}
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			const body = c.req.valid('json');
			await addBomLine(db, sku, body);
			const lines = await listBom(db, sku);
			const line = lines.find((l) => l.childSku === body.childSku && l.role === (body.role ?? ''));
			if (!line) throw new HttpError(404, 'Line missing after insert');
			return c.json(line, 201);
		}
	);

	app.openapi(
		createRoute({
			method: 'put',
			path: '/items/{sku}/bom',
			tags: ['BOM'],
			summary: 'Replace the entire BOM',
			request: { params: SkuParam, body: json(BomReplaceSchema, 'Lines') },
			responses: { 200: json(BomSchema, 'Replaced'), ...err(404, 'Missing'), ...err(409, 'Cycle') }
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			const { lines: incoming } = c.req.valid('json');
			const parent = await getItemOrThrow(db, sku);
			if (incoming.length && isLeaf(parent)) {
				throw new HttpError(
					409,
					`${sku} has floor ${parent.floor}; only assemble items can have BOM lines`
				);
			}
			for (const line of incoming) {
				if (await wouldCycle(db, sku, line.childSku)) {
					throw new HttpError(409, `Replacing BOM would cycle via ${line.childSku}`);
				}
			}
			await db.delete(bomLines).where(eq(bomLines.parentSku, sku));
			for (const [i, line] of incoming.entries()) {
				await addBomLine(db, sku, { ...line, sortOrder: line.sortOrder ?? i * 10 });
			}
			const lines = await listBom(db, sku);
			return c.json({ parent: itemDto(parent), lines, lineCount: lines.length });
		}
	);

	app.openapi(
		createRoute({
			method: 'patch',
			path: '/items/{sku}/bom/{lineId}',
			tags: ['BOM'],
			summary: 'Patch a BOM line',
			request: { params: LineParam, body: json(BomLinePatchSchema, 'Patch') },
			responses: { 200: json(BomLineSchema, 'Updated'), ...err(404, 'Missing') }
		}),
		async (c) => {
			const { sku, lineId } = c.req.valid('param');
			await updateBomLine(db, sku, lineId, c.req.valid('json'));
			const lines = await listBom(db, sku);
			const line = lines.find((l) => l.id === lineId);
			if (!line) throw new HttpError(404, 'Line missing after update');
			return c.json(line);
		}
	);

	app.openapi(
		createRoute({
			method: 'delete',
			path: '/items/{sku}/bom/{lineId}',
			tags: ['BOM'],
			summary: 'Remove a BOM line',
			request: { params: LineParam },
			responses: { 200: json(BomLineSchema, 'Deleted'), ...err(404, 'Missing') }
		}),
		async (c) => {
			const { sku, lineId } = c.req.valid('param');
			const lines = await listBom(db, sku);
			const line = lines.find((l) => l.id === lineId);
			if (!line) throw new HttpError(404, `BOM line ${lineId} not found on ${sku}`);
			await deleteBomLine(db, sku, lineId);
			return c.json(line);
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/items/{sku}/where-used',
			tags: ['BOM'],
			summary: 'Parents that consume this item',
			request: { params: SkuParam },
			responses: { 200: json(WhereUsedSchema, 'Where used'), ...err(404, 'Missing') }
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			return c.json({ sku, usedIn: await whereUsed(db, sku) });
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/items/{sku}/rollup',
			tags: ['BOM'],
			summary: 'Rolled-up cost, mass, and watts from leaf parts',
			request: { params: SkuParam },
			responses: { 200: json(RollupSchema, 'Roll-up'), ...err(404, 'Missing') }
		}),
		async (c) => {
			const { sku } = c.req.valid('param');
			return c.json(await rollup(db, sku));
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/kits',
			tags: ['Items'],
			summary: 'Items with kind=kit, plus roll-up',
			responses: { 200: json(ItemListSchema, 'Kits') }
		}),
		async (c) => {
			const rows = await db.query.items.findMany({
				where: eq(items.kind, 'kit'),
				with: { quotes: true },
				orderBy: (t, { asc }) => [asc(t.sku)]
			});
			return c.json({ items: rows.map(itemDto), total: rows.length });
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/vendors',
			tags: ['Vendors'],
			summary: 'List vendors',
			responses: { 200: json(VendorListSchema, 'Vendors') }
		}),
		async (c) => {
			const rows = await db.select().from(vendors).orderBy(vendors.name);
			return c.json({ vendors: rows.map(vendorDto) });
		}
	);

	app.openapi(
		createRoute({
			method: 'post',
			path: '/vendors',
			tags: ['Vendors'],
			summary: 'Create a vendor',
			request: { body: json(VendorCreateSchema, 'Vendor') },
			responses: { 201: json(VendorSchema, 'Created'), ...err(409, 'Exists') }
		}),
		async (c) => {
			const body = c.req.valid('json');
			const existing = await db.query.vendors.findFirst({ where: eq(vendors.id, body.id) });
			if (existing) throw new HttpError(409, `Vendor ${body.id} already exists`);
			const [row] = await db.insert(vendors).values(body).returning();
			return c.json(vendorDto(row), 201);
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/vendors/{id}',
			tags: ['Vendors'],
			summary: 'Get a vendor',
			request: { params: VendorParam },
			responses: { 200: json(VendorSchema, 'Vendor'), ...err(404, 'Missing') }
		}),
		async (c) => {
			const { id } = c.req.valid('param');
			const row = await db.query.vendors.findFirst({ where: eq(vendors.id, id) });
			if (!row) throw new HttpError(404, `Vendor ${id} not found`);
			return c.json(vendorDto(row));
		}
	);

	app.openapi(
		createRoute({
			method: 'get',
			path: '/quotes',
			tags: ['Quotes'],
			summary: 'List quotes',
			responses: { 200: json(QuoteListSchema, 'Quotes') }
		}),
		async (c) => {
			const rows = await db
				.select()
				.from(quotes)
				.orderBy(quotes.itemSku, quotes.vendorId, desc(quotes.createdAt));
			return c.json({ quotes: rows.map(quoteDto) });
		}
	);

	app.openapi(
		createRoute({
			method: 'post',
			path: '/quotes',
			tags: ['Quotes'],
			summary: 'Add a quote',
			request: { body: json(QuoteCreateSchema, 'Quote') },
			responses: { 201: json(QuoteSchema, 'Created'), ...err(404, 'Missing item or vendor') }
		}),
		async (c) => {
			const body = c.req.valid('json');
			await getItemOrThrow(db, body.itemSku);
			const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, body.vendorId) });
			if (!vendor) throw new HttpError(404, `Vendor ${body.vendorId} not found`);

			// A failed fetch is not a quote. A fetched method that carries no
			// price, or no date for that price, is a login wall or a parse
			// miss, and the answer to those is the next rung of the ladder.
			const fetched = body.method === 'api' || body.method === 'headed' || body.method === 'crawl';
			if (fetched && body.priceCents == null) {
				throw new HttpError(
					422,
					`method ${body.method} requires priceCents; record no row instead`
				);
			}
			if (fetched && !body.checkedAt) {
				throw new HttpError(422, `method ${body.method} requires checkedAt`);
			}

			// Append, never overwrite. The new row supersedes the pair: it
			// inherits isPreferred, and the rows it replaces lose the flag, so
			// a refresh moves the vendor choice forward instead of stranding it.
			const row = await db.transaction(async (tx) => {
				const prior = await pairHistory(tx, body.itemSku, body.vendorId);
				const inherited = prior.some((p) => p.isPreferred);
				const [inserted] = await tx
					.insert(quotes)
					.values({ ...body, isPreferred: body.isPreferred || inherited })
					.returning();
				if (prior.length) {
					await tx
						.update(quotes)
						.set({ isPreferred: false })
						.where(
							and(
								eq(quotes.itemSku, body.itemSku),
								eq(quotes.vendorId, body.vendorId),
								ne(quotes.id, inserted.id)
							)
						);
				}
				return inserted;
			});
			return c.json(quoteDto(row), 201);
		}
	);

	app.openapi(
		createRoute({
			method: 'patch',
			path: '/quotes/{id}',
			tags: ['Quotes'],
			summary: 'Patch a quote (isPreferred, inStock, notes only — quotes are append-only)',
			request: { params: QuoteParam, body: json(QuotePatchSchema, 'Patch') },
			responses: {
				200: json(QuoteSchema, 'Updated'),
				...err(404, 'Missing'),
				...err(422, 'Immutable field, or preferring a superseded row')
			}
		}),
		async (c) => {
			const { id } = c.req.valid('param');
			const patch = c.req.valid('json');
			const existing = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
			if (!existing) throw new HttpError(404, `Quote ${id} not found`);
			if (Object.keys(patch).length === 0) return c.json(quoteDto(existing));

			if (patch.isPreferred === true) {
				// isPreferred is a vendor choice carried by the row that is
				// current for that vendor. Letting a superseded row hold it
				// would hide the flag from the roll-up.
				const history = await pairHistory(db, existing.itemSku, existing.vendorId);
				if (history[0]?.id !== id) {
					throw new HttpError(
						422,
						`Quote ${id} is superseded for ${existing.itemSku} / ${existing.vendorId}; prefer the current row ${history[0]?.id}`
					);
				}
				await db
					.update(quotes)
					.set({ isPreferred: false })
					.where(
						and(
							eq(quotes.itemSku, existing.itemSku),
							eq(quotes.vendorId, existing.vendorId),
							ne(quotes.id, id)
						)
					);
			}

			const [row] = await db.update(quotes).set(patch).where(eq(quotes.id, id)).returning();
			return c.json(quoteDto(row));
		}
	);

	app.doc31('/openapi.json', {
		openapi: '3.1.0',
		info: {
			title: 'daBOM',
			version: '0.1.0',
			description: [
				'Bill of materials for the All Systems Go AI camera. Every item has a BOM (leaves are empty).',
				'Source of truth is this REST API; the SvelteKit UI is a client.',
				'Canonical discovery: /.well-known/openapi.json',
				'',
				'**Price access ladder.** A refresh tries a distributor API (Digi-Key, Mouser, Arrow) first,',
				'then a crawl of the public product page, then a headed browser session so a human can clear',
				'a login wall. A fetch that cannot complete inserts no quote row: a priceless `api`, `crawl`',
				'or `headed` POST is rejected 422 rather than recorded as a failure.',
				'',
				'**Quotes are append-only.** POST /quotes never deletes history. A new row for the same',
				'(item, vendor) supersedes the previous one: it inherits `isPreferred` and clears the flag',
				'on the rows it replaces. PATCH may change only `isPreferred`, `inStock` and `notes`;',
				'`priceCents`, `url`, `method` and `checkedAt` are immutable, and a correction is a new row',
				'with method `manual`.',
				'',
				'**Roll-up.** Within a vendor, the best method wins, then the newest: `api` > `headed` >',
				'`crawl` > `seed` > `manual`, so a Sep 1 API price beats a Sep 8 crawl of the same page.',
				'Across vendors, the preferred vendor wins if its chosen row is priced, otherwise the same',
				'method rank then newest. Priceless rows never contribute. `asOf` on a roll-up is the oldest',
				'`checkedAt` behind the total.'
			].join('\n')
		},
		servers: [{ url: '/api/v1', description: 'Versioned REST' }],
		externalDocs: {
			description: 'Well-known OpenAPI document',
			url: '/.well-known/openapi.json'
		},
		tags: [
			{ name: 'Meta' },
			{ name: 'Items' },
			{ name: 'BOM' },
			{ name: 'Vendors' },
			{ name: 'Quotes' }
		]
	});

	app.get('/docs', swaggerUI({ url: '/api/v1/openapi.json' }));

	return app;
}
