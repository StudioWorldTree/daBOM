import { relations } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

export const itemKinds = ['part', 'assembly', 'kit'] as const;
export const itemCategories = [
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
] as const;
export const itemStatuses = ['preferred', 'candidate', 'placeholder', 'do-not-buy'] as const;

/**
 * Manufacturing floor: does this shop open the box?
 * Orthogonal to `kind` — a bought dev kit is `kind=kit, floor=buy`.
 * Explode and roll-up recurse through `assemble` only; `buy` and `foundry`
 * are leaves and behave identically at runtime.
 */
export const itemFloors = ['buy', 'assemble', 'foundry'] as const;

export const items = pgTable(
	'items',
	{
		sku: text('sku').primaryKey(),
		name: text('name').notNull(),
		kind: text('kind').notNull(),
		category: text('category').notNull(),
		status: text('status').notNull().default('candidate'),
		floor: text('floor').notNull().default('buy'),
		description: text('description').notNull().default(''),
		manufacturer: text('manufacturer'),
		mpn: text('mpn'),
		notes: text('notes'),
		source: text('source'),
		massG: integer('mass_g'),
		widthMm: integer('width_mm'),
		heightMm: integer('height_mm'),
		depthMm: integer('depth_mm'),
		wattsTypical: integer('watts_typical'),
		wattsMax: integer('watts_max'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('items_kind_idx').on(t.kind),
		index('items_category_idx').on(t.category),
		index('items_status_idx').on(t.status),
		index('items_floor_idx').on(t.floor)
	]
);

export const vendors = pgTable('vendors', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	url: text('url'),
	email: text('email'),
	notes: text('notes')
});

export const quotes = pgTable(
	'quotes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		itemSku: text('item_sku')
			.notNull()
			.references(() => items.sku),
		vendorId: text('vendor_id')
			.notNull()
			.references(() => vendors.id),
		priceCents: integer('price_cents'),
		currency: text('currency').notNull().default('USD'),
		url: text('url'),
		checkedAt: date('checked_at'),
		inStock: boolean('in_stock'),
		isPreferred: boolean('is_preferred').notNull().default(false),
		notes: text('notes')
	},
	(t) => [index('quotes_item_idx').on(t.itemSku), index('quotes_vendor_idx').on(t.vendorId)]
);

export const bomLines = pgTable(
	'bom_lines',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		parentSku: text('parent_sku')
			.notNull()
			.references(() => items.sku),
		childSku: text('child_sku')
			.notNull()
			.references(() => items.sku),
		qty: integer('qty').notNull(),
		unit: text('unit').notNull().default('ea'),
		role: text('role').notNull().default(''),
		notes: text('notes'),
		optional: boolean('optional').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [
		uniqueIndex('bom_parent_child_role_uidx').on(t.parentSku, t.childSku, t.role),
		index('bom_parent_idx').on(t.parentSku),
		index('bom_child_idx').on(t.childSku)
	]
);

export const itemsRelations = relations(items, ({ many }) => ({
	quotes: many(quotes),
	bomLines: many(bomLines, { relationName: 'bomParent' }),
	usedIn: many(bomLines, { relationName: 'bomChild' })
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
	quotes: many(quotes)
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
	item: one(items, { fields: [quotes.itemSku], references: [items.sku] }),
	vendor: one(vendors, { fields: [quotes.vendorId], references: [vendors.id] })
}));

export const bomLinesRelations = relations(bomLines, ({ one }) => ({
	parent: one(items, {
		fields: [bomLines.parentSku],
		references: [items.sku],
		relationName: 'bomParent'
	}),
	child: one(items, {
		fields: [bomLines.childSku],
		references: [items.sku],
		relationName: 'bomChild'
	})
}));

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type BomLine = typeof bomLines.$inferSelect;
export type NewBomLine = typeof bomLines.$inferInsert;
