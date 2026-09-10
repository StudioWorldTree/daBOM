/**
 * Distributor JSON → offers. Digi-Key, Mouser and Arrow answer three
 * different shapes for the same question, and every one of them buries the
 * price breaks a few levels down. Rather than three brittle path readers,
 * this walks the response for the *keys* each vendor uses.
 *
 * Nothing here touches the app: no database, no server import. The only
 * writer in this skill is `postQuote` in `ladder.ts`, which POSTs /quotes.
 */

/** One quantity tier as the vendor published it. */
export interface PriceBreak {
	qty: number;
	unitPriceCents: number;
}

/** A vendor's answer for one part number. */
export interface Offer {
	/** Manufacturer part number as the vendor wrote it. Never invented. */
	mpn: string | null;
	currency: string;
	/** Ascending by quantity, one row per tier. */
	breaks: PriceBreak[];
	url: string | null;
	inStock: boolean | null;
}

const MPN_KEYS = [
	'manufacturerproductnumber',
	'manufacturerpartnumber',
	'mfrpartnumber',
	'partnum',
	'mpn'
];
const QTY_KEYS = ['breakquantity', 'minqty', 'minimumquantity', 'quantity', 'qty'];
const PRICE_KEYS = ['unitprice', 'resaleprice', 'listprice', 'price'];
const URL_KEYS = ['producturl', 'productdetailurl', 'partdetailslink', 'buyurl', 'url'];
const CURRENCY_KEYS = ['currency', 'currencycode', 'pricecurrency'];
const STOCK_KEYS = [
	'quantityavailable',
	'quantityonhand',
	'fohquantity',
	'availability',
	'instock'
];

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** First value under any of `keys`, case-insensitively, on this object only. */
function pick(node: Record<string, Json>, keys: string[]): Json {
	for (const key of Object.keys(node)) {
		if (keys.includes(key.toLowerCase())) return node[key];
	}
	return undefined;
}

/**
 * Money → integer cents. Mouser answers `"$1,234.56"`, Digi-Key answers
 * `1234.56`, Arrow answers `"1234.5600"`. A value that is not money at all
 * is null, which fails the rung rather than posting a zero.
 */
export function toCents(value: Json): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? Math.round(value * 100) : null;
	}
	if (typeof value !== 'string') return null;
	const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '');
	if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
	return Math.round(Number(cleaned) * 100);
}

function currencyOf(value: Json): string | null {
	if (typeof value !== 'string') return null;
	const code = value.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(code) ? code : null;
}

function stockOf(value: Json): boolean | null {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value > 0;
	if (typeof value === 'string') {
		const cents = toCents(value);
		if (cents !== null) return cents > 0;
		if (/in\s?stock/i.test(value)) return true;
		if (/out\s?of\s?stock|no\s?stock/i.test(value)) return false;
	}
	return null;
}

/** Walk a subtree collecting anything that reads as a quantity/price pair. */
function collect(
	node: Json,
	offer: {
		breaks: PriceBreak[];
		currency: string | null;
		url: string | null;
		inStock: boolean | null;
	}
): void {
	if (Array.isArray(node)) {
		for (const child of node) collect(child, offer);
		return;
	}
	if (!isObject(node)) return;

	const qty = pick(node, QTY_KEYS);
	const price = pick(node, PRICE_KEYS);
	const cents = toCents(price);
	const quantity = typeof qty === 'number' ? qty : Number(String(qty ?? '').replace(/[^\d]/g, ''));
	if (cents !== null && Number.isFinite(quantity) && quantity > 0) {
		offer.breaks.push({ qty: quantity, unitPriceCents: cents });
	}

	offer.currency ??= currencyOf(pick(node, CURRENCY_KEYS));
	if (offer.url === null) {
		const url = pick(node, URL_KEYS);
		if (typeof url === 'string' && /^https?:\/\//.test(url)) offer.url = url;
	}
	if (offer.inStock === null) offer.inStock = stockOf(pick(node, STOCK_KEYS));

	for (const value of Object.values(node)) collect(value, offer);
}

/** Every object in the response that names a manufacturer part number. */
function products(node: Json, found: Record<string, Json>[]): void {
	if (Array.isArray(node)) {
		for (const child of node) products(child, found);
		return;
	}
	if (!isObject(node)) return;
	if (typeof pick(node, MPN_KEYS) === 'string') {
		found.push(node);
		return; // variations under a product belong to that product
	}
	for (const value of Object.values(node)) products(value, found);
}

/** Dedupe tiers by quantity, keeping the cheapest, ascending by quantity. */
function tidy(breaks: PriceBreak[]): PriceBreak[] {
	const best = new Map<number, number>();
	for (const row of breaks) {
		const seen = best.get(row.qty);
		if (seen === undefined || row.unitPriceCents < seen) best.set(row.qty, row.unitPriceCents);
	}
	return [...best.entries()]
		.map(([qty, unitPriceCents]) => ({ qty, unitPriceCents }))
		.sort((a, b) => a.qty - b.qty);
}

/** Distributor response → one offer per part number it named. */
export function offersFrom(json: Json): Offer[] {
	const found: Record<string, Json>[] = [];
	products(json, found);
	return found.map((node) => {
		const acc = {
			breaks: [] as PriceBreak[],
			currency: null as string | null,
			url: null as string | null,
			inStock: null as boolean | null
		};
		collect(node, acc);
		return {
			mpn: String(pick(node, MPN_KEYS)),
			currency: acc.currency ?? 'USD',
			breaks: tidy(acc.breaks),
			url: acc.url,
			inStock: acc.inStock
		};
	});
}

/**
 * Exact manufacturer part number, per the 2026-09-09 advise pin. Case and
 * surrounding whitespace differ between vendors for the same part; dashes and
 * suffixes do not. Anything looser is a different part wearing the top rung.
 */
export function sameMpn(a: string | null | undefined, b: string | null | undefined): boolean {
	if (!a || !b) return false;
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Unit price at a quantity. The quote holds one `priceCents`, so the rule is
 * fixed at quantity 1 and the tier that actually applied is written to
 * `notes`. When the vendor's lowest tier is above the target (a minimum order
 * quantity), that tier is the honest answer and the note says so.
 */
export function unitAtQty(breaks: PriceBreak[], qty = 1): PriceBreak | null {
	if (breaks.length === 0) return null;
	const rows = tidy(breaks);
	const applicable = rows.filter((row) => row.qty <= qty);
	return applicable.length ? applicable[applicable.length - 1] : rows[0];
}

/** The `notes` string that records which tier the posted price came from. */
export function tierNote(tier: PriceBreak, qty = 1): string {
	return tier.qty <= qty
		? `unit price at qty ${qty} (price break qty ${tier.qty})`
		: `unit price at vendor minimum qty ${tier.qty}; no qty ${qty} break published`;
}
