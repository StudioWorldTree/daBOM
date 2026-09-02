export type Quote = {
	id: string;
	itemSku: string;
	vendorId: string;
	priceCents: number | null;
	currency: string;
	url: string | null;
	checkedAt: string | null;
	inStock: boolean | null;
	isPreferred: boolean;
	notes: string | null;
};

export type Item = {
	sku: string;
	name: string;
	kind: 'part' | 'assembly' | 'kit';
	category: string;
	status: string;
	description: string;
	manufacturer: string | null;
	mpn: string | null;
	notes: string | null;
	source: string | null;
	massG: number | null;
	widthMm: number | null;
	heightMm: number | null;
	depthMm: number | null;
	wattsTypical: number | null;
	wattsMax: number | null;
	createdAt: string;
	updatedAt: string;
	quotes?: Quote[];
};

export type BomLine = {
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
	path?: string[];
	qtyEach?: number;
	qtyRollup?: number;
};

export type Bom = {
	parent: Item;
	lines: BomLine[];
	lineCount: number;
};

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

export type WhereUsed = {
	sku: string;
	usedIn: {
		id: string;
		parentSku: string;
		parentName: string;
		parentKind: string;
		qty: number;
		role: string;
		optional: boolean;
	}[];
};
