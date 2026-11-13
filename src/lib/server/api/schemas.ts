import { z } from '@hono/zod-openapi';

export const Sku = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9-]*$/, 'sku must be lowercase kebab-case')
	.openapi({ example: 't4000-som', param: { name: 'sku', in: 'path' } });

export const ProjectSlug = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9-]*$/, 'project slug must be lowercase kebab-case')
	.openapi({ example: 'edgebox' });

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
export const QuoteMethod = z.enum(['api', 'headed', 'crawl', 'seed', 'manual']).openapi({
	description:
		'How the quote was obtained, best first. Roll-up ranks api > headed > crawl > seed > manual, then newest.',
	example: 'api'
});

export const SourceKind = z.enum(['notebook', 'datasheet', 'link', 'analysis']);

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
		method: QuoteMethod,
		checkedAt: z.string().nullable(),
		inStock: z.boolean().nullable(),
		isPreferred: z.boolean(),
		notes: z.string().nullable()
	})
	.openapi('Quote');

export const PurchaseLinkSchema = z
	.object({
		id: z.string().uuid(),
		itemSku: z.string(),
		vendorId: z.string(),
		url: z.string(),
		label: z.string().nullable(),
		vendorSku: z.string().nullable(),
		notes: z.string().nullable(),
		createdAt: z.string()
	})
	.openapi('PurchaseLink', {
		description:
			'A standing place to buy an item: one URL under one vendor. Quotes are prices seen there; ' +
			'a quote posted with this URL and no vendorId takes this vendor.'
	});

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
		project: z.string().nullable().openapi({
			description: 'Slug of the project this item belongs to, or null. A project kit is a variant.'
		}),
		createdAt: z.string(),
		updatedAt: z.string(),
		quotes: z.array(QuoteSchema).optional(),
		purchaseLinks: z.array(PurchaseLinkSchema).optional()
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
		wattsMax: z.number().int().nullable().optional(),
		project: ProjectSlug.nullable().optional()
	})
	.openapi('ItemCreate');

// Zod applies `.default()` even under `.partial()`, so a patch derived from
// the create schema would reset floor, status and description on every call.
// Patch schemas strip the defaults: a field the body omits stays as stored.
export const ItemPatchSchema = ItemCreateSchema.extend({
	floor: ItemFloor,
	status: ItemStatus,
	description: z.string()
})
	.partial()
	.omit({ sku: true })
	.openapi('ItemPatch');

export const ItemListQuery = z.object({
	q: z.string().optional().openapi({ example: 'thor' }),
	kind: ItemKind.optional(),
	floor: ItemFloor.optional(),
	category: ItemCategory.optional(),
	status: ItemStatus.optional(),
	project: ProjectSlug.optional()
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
		unitPriceCheckedAt: z.string().nullable(),
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
	qtyRollup: z.number().int(),
	containedBy: z.string().nullable().openapi({
		description:
			'SKU of the nearest bought bundle (a buy/foundry kit or assembly) this row ships inside, or null. Contained rows are real parts but their cost, mass and watts ride the bundle row; roll-up skips them and extendedCents is null.'
	})
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

export const BomLinePatchSchema = BomLineCreateSchema.extend({
	unit: z.string(),
	role: z.string(),
	optional: z.boolean(),
	sortOrder: z.number().int()
})
	.partial()
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
		asOf: z.string().nullable().openapi({
			description: 'Oldest checkedAt among the quotes behind this total. Null if none are dated.',
			example: '2026-09-01'
		}),
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
		vendorId: z.string().min(1).optional().openapi({
			description:
				"Omit to take the vendor from `url`: the item's purchase link for that URL, else the one vendor whose home URL shares its host. 422 when neither decides."
		}),
		priceCents: z.number().int().nullable().optional(),
		currency: z.string().default('USD'),
		url: z.string().nullable().optional(),
		method: QuoteMethod.default('manual'),
		checkedAt: z.string().nullable().optional(),
		inStock: z.boolean().nullable().optional(),
		isPreferred: z.boolean().default(false),
		notes: z.string().nullable().optional()
	})
	.openapi('QuoteCreate');

/**
 * Quotes are append-only. Price, url, method and checkedAt are what the
 * vendor said at a moment; a correction is a new row with method `manual`,
 * not a rewrite. Strict, so a PATCH carrying `priceCents` is 422 rather
 * than a silently dropped field.
 */
export const QuotePatchSchema = z
	.strictObject({
		isPreferred: z.boolean().optional(),
		inStock: z.boolean().nullable().optional(),
		notes: z.string().nullable().optional()
	})
	.openapi('QuotePatch');

export const PurchaseLinkListSchema = z
	.object({ purchaseLinks: z.array(PurchaseLinkSchema) })
	.openapi('PurchaseLinkList');

export const PurchaseLinkCreateSchema = z
	.strictObject({
		url: z.string().min(1).openapi({
			description:
				'Absolute http(s) product URL. Fragment and tracking params (utm_*, spm, ref…) are dropped.',
			example: 'https://www.pishop.us/product/raspberry-pi-5-8gb/'
		}),
		vendorId: z.string().min(1).optional().openapi({
			description:
				'Omit when one vendor owns the URL host. Marketplaces (alibaba.com, amazon.com) need it named.'
		}),
		label: z.string().nullable().optional().openapi({ example: '4GB, single board' }),
		vendorSku: z.string().nullable().optional(),
		notes: z.string().nullable().optional()
	})
	.openapi('PurchaseLinkCreate');

export const PurchaseLinkPatchSchema = z
	.strictObject({
		vendorId: z.string().min(1).optional(),
		label: z.string().nullable().optional(),
		vendorSku: z.string().nullable().optional(),
		notes: z.string().nullable().optional()
	})
	.openapi('PurchaseLinkPatch');

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
export const ProjectParam = z.object({
	slug: ProjectSlug.openapi({ param: { name: 'slug', in: 'path' } })
});
export const LineParam = z.object({ sku: Sku, lineId: LineId });
export const VendorParam = z.object({ id: VendorId });
export const QuoteParam = z.object({ id: QuoteId });
export const PurchaseLinkParam = z.object({ id: QuoteId });
export const ExplodeQuery = z.object({
	explode: z.enum(['true', 'false']).optional()
});

/**
 * One ingest node. Every field is optional because identity is resolved
 * (pair, MPN, supplied sku, mint) rather than declared: a node may be a bare
 * `{ mpn }` reference to a seeded row or a full new part. `qty`, `unit`,
 * `role`, `lineNotes`, `optional` and `sortOrder` describe this node's line
 * under its parent and are ignored on the root.
 */
export const IngestNodeSchema = z
	.object({
		sku: z.string().optional().openapi({ example: 't4000-som' }),
		name: z.string().optional().openapi({ example: 'NVIDIA Jetson T4000 SOM' }),
		kind: ItemKind.optional(),
		category: ItemCategory.optional(),
		status: ItemStatus.optional(),
		floor: ItemFloor.optional(),
		description: z.string().optional(),
		manufacturer: z.string().nullable().optional(),
		mpn: z.string().nullable().optional(),
		notes: z.string().nullable().optional(),
		source: z.string().nullable().optional(),
		sources: z
			.array(
				z.strictObject({
					kind: SourceKind.optional(),
					locator: z.string().openapi({
						description:
							'Repository-relative path or absolute http/https URL; blank entries are ignored.'
					})
				})
			)
			.optional()
			.openapi({ description: 'Additional source links, not field citations.' }),
		qty: z.number().int().min(1).optional(),
		unit: z.string().optional(),
		role: z.string().optional(),
		lineNotes: z.string().nullable().optional(),
		optional: z.boolean().optional(),
		sortOrder: z.number().int().optional(),
		get children() {
			return z.array(IngestNodeSchema).optional();
		}
	})
	.openapi('IngestNode');

export const IngestRequestSchema = z
	.object({
		source: z.string().nullable().optional().openapi({ example: '../AICamera/docs/SHOPPING.md' }),
		root: IngestNodeSchema
	})
	.openapi('IngestRequest');

export const IngestNodeResultSchema = z
	.object({
		sku: z.string(),
		action: z.enum(['created', 'matched']),
		floor: ItemFloor,
		lines: z.array(z.string().uuid()).openapi({
			description: 'Ids of the BOM lines from this node to its children.'
		}),
		get children() {
			return z.array(IngestNodeResultSchema);
		}
	})
	.openapi('IngestNodeResult');

export const IngestResultSchema = z
	.object({
		root: IngestNodeResultSchema
	})
	.openapi('IngestResult');

export const EnrichmentMethod = z.enum(['ingest', 'manual']);

export const SourceLocator = z
	.string()
	.trim()
	.min(1)
	.refine((locator) => {
		if (/^https?:\/\//i.test(locator)) {
			try {
				const url = new URL(locator);
				return Boolean(url.hostname) && !/\s/.test(locator);
			} catch {
				return false;
			}
		}
		// Relative document paths, including sibling repositories. Schemes,
		// absolute paths, shell home expansion, and prose are not locators.
		return (
			!/^(?:[a-z][a-z0-9+.-]*:|\/|~)/i.test(locator) &&
			!/[\\\x00-\x1f?#]/.test(locator) &&
			/^(?:[^\s/]+\/)+[^/]+$|^[^\s/]+\.[^\s/.]+$/.test(locator)
		);
	}, 'locator must be a repository-relative path or an absolute http/https URL')
	.openapi({
		description: 'Trimmed repository-relative document path or absolute http/https URL.',
		example: '../AICamera/docs/SHOPPING.md'
	});

export const SourceCreateSchema = z
	.strictObject({
		kind: SourceKind,
		locator: SourceLocator,
		title: z.string().nullable().optional()
	})
	.openapi('SourceCreate');

export const SourceSchema = z
	.object({
		id: z.string().uuid(),
		kind: SourceKind,
		locator: z.string(),
		title: z.string().nullable()
	})
	.openapi('Source');

export const SourceParam = z.object({
	id: z
		.string()
		.uuid()
		.openapi({ param: { name: 'id', in: 'path' } })
});

export const ItemSourceCreateSchema = z
	.union([z.strictObject({ sourceId: z.string().uuid() }), SourceCreateSchema])
	.openapi('ItemSourceCreate');

export const ItemSourceSchema = z
	.object({
		itemSku: z.string(),
		sourceId: z.string().uuid()
	})
	.openapi('ItemSource');

export const EnrichmentCreateSchema = z
	.strictObject({
		field: z.enum(['manufacturer', 'mpn', 'notes']).nullable().optional(),
		value: z.string().min(1),
		body: z.string().nullable().optional(),
		sourceId: z.string().uuid().nullable().optional(),
		method: EnrichmentMethod.default('manual')
	})
	.openapi('EnrichmentCreate');

export const EnrichmentSchema = z
	.object({
		id: z.string().uuid(),
		itemSku: z.string(),
		field: z.enum(['manufacturer', 'mpn', 'notes']).nullable(),
		value: z.string(),
		body: z.string().nullable(),
		sourceId: z.string().uuid().nullable(),
		method: EnrichmentMethod,
		createdAt: z.string().datetime()
	})
	.openapi('Enrichment');

export const ThoughtCreateSchema = z
	.strictObject({
		body: z.string().refine((body) => body.trim().length > 0, 'body must be non-empty'),
		sourceIds: z.array(z.string().uuid()).default([])
	})
	.openapi('ThoughtCreate');

export const ThoughtSchema = z
	.object({
		id: z.string().uuid(),
		itemSku: z.string(),
		body: z.string(),
		sourceIds: z.array(z.string().uuid()),
		createdAt: z.string().datetime()
	})
	.openapi('Thought');

export const ItemEvidenceSchema = z
	.object({
		itemSku: z.string(),
		links: z.array(ItemSourceSchema),
		sources: z.array(SourceSchema),
		enrichments: z.array(EnrichmentSchema),
		thoughts: z.array(ThoughtSchema)
	})
	.openapi('ItemEvidence');

export const SourceEvidenceSchema = z
	.object({
		source: SourceSchema,
		items: z.array(ItemSchema)
	})
	.openapi('SourceEvidence');

// --- projects -----------------------------------------------------------

export const ProjectSchema = z
	.object({
		slug: z.string(),
		name: z.string(),
		description: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
		variants: z.array(ItemSchema).openapi({
			description:
				'Member kits that are built here (floor assemble) and that no other member consumes: the configurations you ship.'
		}),
		shared: z.array(ItemSchema).openapi({
			description:
				'Every other member: sub-kits and assemblies the variants consume, bought bundles, parts.'
		})
	})
	.openapi('Project');

export const ProjectListSchema = z
	.object({ projects: z.array(ProjectSchema) })
	.openapi('ProjectList');

export const ProjectCreateSchema = z
	.object({
		slug: ProjectSlug,
		name: z.string().min(1),
		description: z.string().default('')
	})
	.openapi('ProjectCreate');

export const ProjectPatchSchema = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().optional()
	})
	.openapi('ProjectPatch');
