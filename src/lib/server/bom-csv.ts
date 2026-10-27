import type { ExplodedRow } from './bom';

/** One exploded line, or the item itself when it has no children. */
export type CsvLine = {
	level: number;
	path: string;
	sku: string;
	name: string;
	qty: number;
	qtyForOne: number;
	unit: string;
	role: string;
	optional: boolean;
	floor: string;
	kind: string;
	category: string;
	status: string;
	manufacturer: string | null;
	mpn: string | null;
	/** Cents. Blank in the file unless this row is a buy leaf. */
	unitPriceCents: number | null;
	currency: string;
	vendor: string;
	productUrl: string | null;
	priceChecked: string | null;
	notes: string | null;
};

export type CsvQuote = {
	vendorName: string;
	currency: string;
	url: string | null;
	checkedAt: string | null;
};

export const BOM_CSV_HEADER = [
	'level',
	'path',
	'sku',
	'name',
	'qty',
	'qty_for_one',
	'unit',
	'role',
	'optional',
	'floor',
	'kind',
	'category',
	'status',
	'manufacturer',
	'mpn',
	'unit_price_usd',
	'ext_for_one_usd',
	'currency',
	'vendor',
	'product_url',
	'price_checked',
	'notes'
] as const;

/** RFC 4180. Numbers stay bare so a spreadsheet can sum them. */
export function csvCell(value: string | number | null | undefined): string {
	if (value == null) return '';
	const s = String(value);
	if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
	return s;
}

/** Exact dollars from integer cents. Never a binary float. */
export function centsToDollars(cents: number | null): string {
	if (cents == null) return '';
	const sign = cents < 0 ? '-' : '';
	const abs = Math.abs(cents);
	return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function csvFilename(sku: string): string {
	const safe = sku.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[_._]+|[_._]+$/g, '') || 'bom';
	return `${safe}.csv`;
}

export function explodedToCsvLine(row: ExplodedRow, quote: CsvQuote | undefined): CsvLine {
	return {
		level: Math.max(0, row.path.length - 1),
		path: row.path.join(' / '),
		sku: row.childSku,
		name: row.child.name,
		qty: row.qtyEach,
		qtyForOne: row.qtyRollup,
		unit: row.unit,
		role: row.role,
		optional: row.optional,
		floor: row.child.floor,
		kind: row.child.kind,
		category: row.child.category,
		status: row.child.status,
		manufacturer: row.child.manufacturer,
		mpn: row.child.mpn,
		unitPriceCents: row.unitPriceCents,
		currency: quote?.currency ?? '',
		vendor: quote?.vendorName ?? '',
		productUrl: quote?.url ?? null,
		priceChecked: quote?.checkedAt ?? null,
		notes: row.notes
	};
}

/**
 * One row per exploded line. Money is written only on buy rows, so a sum of
 * `ext_for_one_usd` is the known leaf total and does not double-count assemblies.
 * Optional lines are included; filter `optional=no` for the required set.
 * Leading BOM and CRLF so Excel opens the names.
 */
export function bomLinesToCsv(lines: CsvLine[]): string {
	const body = [BOM_CSV_HEADER.join(',')];
	for (const line of lines) {
		const buy = line.floor !== 'assemble';
		const unit = buy ? line.unitPriceCents : null;
		const ext = unit == null ? null : unit * line.qtyForOne;
		const cells = [
			line.level,
			line.path,
			line.sku,
			line.name,
			line.qty,
			line.qtyForOne,
			line.unit,
			line.role,
			line.optional ? 'yes' : 'no',
			line.floor,
			line.kind,
			line.category,
			line.status,
			line.manufacturer,
			line.mpn,
			centsToDollars(unit),
			centsToDollars(ext),
			buy && unit != null ? line.currency : '',
			buy && unit != null ? line.vendor : '',
			buy && unit != null ? line.productUrl : '',
			buy && unit != null ? line.priceChecked : '',
			line.notes
		];
		body.push(cells.map((cell) => csvCell(cell)).join(','));
	}
	return `\uFEFF${body.join('\r\n')}\r\n`;
}
