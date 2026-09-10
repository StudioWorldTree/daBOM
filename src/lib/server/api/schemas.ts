import { z } from '@hono/zod-openapi';

export const Sku = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9-]*$/, 'sku must be lowercase kebab-case')
	.openapi({ example: 't4000-som', param: { name: 'sku', in: 'path' } });

export const ItemKind = z.enum(['part', 'assembly', 'kit']);
export const ItemFloor = z.enum(['buy', 'assemble', 'foundry']);
export const ItemCategory = z.enum([
	'compute',
	'carrier',
	'camera',
	'interconnect',
	'power',
	'thermal',
	'enclosure',
	'lens',
	'lidar',
	'network',
	'storage',
	'accessory',
	'kit'
]);
export const ItemStatus = z.enum(['preferred', 'candidate', 'placeholder', 'do-not-buy']);

export const ErrorSchema = z
	.object({
		error: z.string(),
		details: z.unknown().nullable().optional()
	})
	.openapi('Error');

export const QuoteSchema = z
	.object({
		id: z.string().uuid(),
		itemSku: z.string(),
		vendorId: z.string(),
		priceCents: z.number().int().nullable(),
		currency: z.string(),
		url: z.string().nullable(),
		checkedAt: z.string().nullable(),
		inStock: z.boolean().nullable(),
		isPreferred: z.boolean(),
		notes: z.string().nullable()
	})
	.openapi('Quote');

export const ItemSchema = z
	.object({
		sku: z.string(),
		name: z.string(),
		kind: ItemKind,
		floor: ItemFloor,
		category: ItemCategory,
		status: ItemStatus,
		description: z.string(),
		manufacturer: z.string().nullable(),
		mpn: z.string().nullable(),
		notes: z.string().nullable(),
		source: z.string().nullable(),
		massG: z.number().int().nullable(),
		widthMm: z.number().int().nullable(),
		heightMm: z.number().int().nullable(),
		depthMm: z.number().int().nullable(),
		wattsTypical: z.number().int().nullable(),
		wattsMax: z.number().int().nullable(),
		createdAt: z.string(),
		updatedAt: z.string(),
		quotes: z.array(QuoteSchema).optional()
	})
	.openapi('Item');

export const ItemCreateSchema = z
	.object({
		sku: Sku,
		name: z.string().min(1),
		kind: ItemKind,
		floor: ItemFloor.default('buy'),
		category: ItemCategory,
		status: ItemStatus.default('candidate'),
		description: z.string().default(''),
		manufacturer: z.string().nullable().optional(),
		mpn: z.string().nullable().optional(),
		notes: z.string().nullable().optional(),
		source: z.string().nullable().optional(),
		massG: z.number().int().nullable().optional(),
		widthMm: z.number().int().nullable().optional(),
		heightMm: z.number().int().nullable().optional(),
		depthMm: z.number().int().nullable().optional(),
		wattsTypical: z.number().int().nullable().optional(),
		wattsMax: z.number().int().nullable().optional()
	})
	.openapi('ItemCreate');

export const ItemPatchSchema = ItemCreateSchema.partial().omit({ sku: true }).openapi('ItemPatch');

export const ItemListQuery = z.object({
	q: z.string().optional().openapi({ example: 'thor' }),
	kind: ItemKind.optional(),
	floor: ItemFloor.optional(),
	category: ItemCategory.optional(),
	status: ItemStatus.optional()
});

export const ItemListSchema = z
	.object({
		items: z.array(ItemSchema),
		total: z.number().int()
	})
	.openapi('ItemList');

export const ChildRefSchema = z
	.object({
		sku: z.string(),
		name: z.string(),
		kind: z.string(),
		floor: z.string(),
		category: z.string(),
		status: z.string(),
		manufacturer: z.string().nullable(),
		mpn: z.string().nullable()
	})
	.openapi('ChildRef');

export const BomLineSchema = z
	.object({
		id: z.string().uuid(),
		parentSku: z.string(),
		childSku: z.string(),
		qty: z.number().int(),
		unit: z.string(),
		role: z.string(),
		notes: z.string().nullable(),
		optional: z.boolean(),
		sortOrder: z.number().int(),
		child: ChildRefSchema,
		unitPriceCents: z.number().int().nullable(),
		extendedCents: z.number().int().nullable()
	})
	.openapi('BomLine');

export const BomSchema = z
	.object({
		parent: ItemSchema,
		lines: z.array(BomLineSchema),
		lineCount: z.number().int()
	})
	.openapi('Bom');

export const ExplodedRowSchema = BomLineSchema.extend({
	path: z.array(z.string()),
	qtyEach: z.number().int(),
	qtyRollup: z.number().int()
}).openapi('ExplodedRow');

export const ExplodedBomSchema = z
	.object({
		parent: ItemSchema,
		lines: z.array(ExplodedRowSchema),
		lineCount: z.number().int()
	})
	.openapi('ExplodedBom');

export const BomLineCreateSchema = z
	.object({
		childSku: z.string().min(1).openapi({ example: 't4000-som' }),
		qty: z.number().int().min(1).openapi({ example: 1 }),
		unit: z.string().default('ea'),
		role: z.string().default(''),
		notes: z.string().nullable().optional(),
		optional: z.boolean().default(false),
		sortOrder: z.number().int().default(0)
	})
	.openapi('BomLineCreate');

export const BomLinePatchSchema = BomLineCreateSchema.partial()
	.omit({ childSku: true })
	.openapi('BomLinePatch');

export const BomReplaceSchema = z
	.object({
		lines: z.array(BomLineCreateSchema)
	})
	.openapi('BomReplace');

export const WhereUsedRowSchema = z
	.object({
		id: z.string().uuid(),
		parentSku: z.string(),
		parentName: z.string(),
		parentKind: z.string(),
		qty: z.number().int(),
		role: z.string(),
		optional: z.boolean()
	})
	.openapi('WhereUsedRow');

export const WhereUsedSchema = z
	.object({
		sku: z.string(),
		usedIn: z.array(WhereUsedRowSchema)
	})
	.openapi('WhereUsed');

export const RollupSchema = z
	.object({
		sku: z.string(),
		requiredCents: z.number().int().nullable(),
		optionalCents: z.number().int().nullable(),
		knownRequiredCents: z.number().int(),
		knownOptionalCents: z.number().int(),
		missingQuotes: z.array(z.string()),
		massG: z.number().int().nullable(),
		wattsTypical: z.number().int().nullable(),
		knownMassG: z.number().int(),
		knownWattsTypical: z.number().int(),
		lineCount: z.number().int(),
		partCount: z.number().int()
	})
	.openapi('Rollup');

export const VendorSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		url: z.string().nullable(),
		email: z.string().nullable(),
		notes: z.string().nullable()
	})
	.openapi('Vendor');

export const VendorListSchema = z
	.object({
		vendors: z.array(VendorSchema)
	})
	.openapi('VendorList');

export const QuoteListSchema = z
	.object({
		quotes: z.array(QuoteSchema)
	})
	.openapi('QuoteList');

export const HealthSchema = z.object({ ok: z.boolean() }).openapi('Health');

export const VendorCreateSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		url: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
		notes: z.string().nullable().optional()
	})
	.openapi('VendorCreate');

export const QuoteCreateSchema = z
	.object({
		itemSku: z.string().min(1),
		vendorId: z.string().min(1),
		priceCents: z.number().int().nullable().optional(),
		currency: z.string().default('USD'),
		url: z.string().nullable().optional(),
		checkedAt: z.string().nullable().optional(),
		inStock: z.boolean().nullable().optional(),
		isPreferred: z.boolean().default(false),
		notes: z.string().nullable().optional()
	})
	.openapi('QuoteCreate');

export const QuotePatchSchema = QuoteCreateSchema.partial()
	.omit({ itemSku: true })
	.openapi('QuotePatch');

export const LineId = z
	.string()
	.uuid()
	.openapi({
		example: '00000000-0000-0000-0000-000000000000',
		param: { name: 'lineId', in: 'path' }
	});

export const QuoteId = z
	.string()
	.uuid()
	.openapi({
		param: { name: 'id', in: 'path' }
	});

export const VendorId = z
	.string()
	.min(1)
	.openapi({
		example: 'arrow',
		param: { name: 'id', in: 'path' }
	});

export const SkuParam = z.object({ sku: Sku });
export const LineParam = z.object({ sku: Sku, lineId: LineId });
export const VendorParam = z.object({ id: VendorId });
export const QuoteParam = z.object({ id: QuoteId });
export const ExplodeQuery = z.object({
	explode: z.enum(['true', 'false']).optional()
});
