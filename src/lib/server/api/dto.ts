import {
	itemCategories,
	itemKinds,
	itemStatuses,
	type Item,
	type Quote,
	type Vendor
} from '../db/schema';

export function iso(d: Date | string | null | undefined) {
	if (d == null) return null;
	if (d instanceof Date) return d.toISOString();
	return String(d);
}

function asUnion<T extends readonly string[]>(value: string, allowed: T): T[number] {
	if ((allowed as readonly string[]).includes(value)) return value as T[number];
	return value as T[number];
}

export function itemDto(row: Item & { quotes?: Quote[] }) {
	return {
		sku: row.sku,
		name: row.name,
		kind: asUnion(row.kind, itemKinds),
		category: asUnion(row.category, itemCategories),
		status: asUnion(row.status, itemStatuses),
		description: row.description,
		manufacturer: row.manufacturer,
		mpn: row.mpn,
		notes: row.notes,
		source: row.source,
		massG: row.massG,
		widthMm: row.widthMm,
		heightMm: row.heightMm,
		depthMm: row.depthMm,
		wattsTypical: row.wattsTypical,
		wattsMax: row.wattsMax,
		createdAt: iso(row.createdAt) ?? '',
		updatedAt: iso(row.updatedAt) ?? '',
		quotes: row.quotes?.map(quoteDto)
	};
}

export function quoteDto(row: Quote) {
	return {
		id: row.id,
		itemSku: row.itemSku,
		vendorId: row.vendorId,
		priceCents: row.priceCents,
		currency: row.currency,
		url: row.url,
		checkedAt: row.checkedAt,
		inStock: row.inStock,
		isPreferred: row.isPreferred,
		notes: row.notes
	};
}

export function vendorDto(row: Vendor) {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		email: row.email,
		notes: row.notes
	};
}
