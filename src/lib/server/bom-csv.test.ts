import { describe, expect, it } from 'vitest';
import { bomLinesToCsv, centsToDollars, csvCell, csvFilename, type CsvLine } from './bom-csv';

function line(over: Partial<CsvLine> = {}): CsvLine {
	return {
		level: 1,
		path: 'kit-prod / t4000-som',
		sku: 't4000-som',
		name: 'NVIDIA Jetson T4000 SOM',
		qty: 1,
		qtyForOne: 1,
		unit: 'ea',
		role: 'som',
		optional: false,
		floor: 'buy',
		kind: 'part',
		category: 'compute',
		status: 'preferred',
		manufacturer: 'NVIDIA',
		mpn: '900-13834-0000-000',
		unitPriceCents: 274900,
		currency: 'USD',
		vendor: 'Arrow',
		productUrl: 'https://www.arrow.com/en/products/900-13834-0000-000/nvidia',
		priceChecked: '2026-09-01',
		notes: null,
		...over
	};
}

describe('bom csv', () => {
	it('prints cents as exact dollars', () => {
		expect(centsToDollars(274900)).toBe('2749.00');
		expect(centsToDollars(5)).toBe('0.05');
		expect(centsToDollars(null)).toBe('');
		expect(centsToDollars(-120)).toBe('-1.20');
	});

	it('quotes commas, quotes, and newlines', () => {
		expect(csvCell('plain')).toBe('plain');
		expect(csvCell('say "hi", friend')).toBe('"say ""hi"", friend"');
		expect(csvCell('a\nb')).toBe('"a\nb"');
		expect(csvCell(null)).toBe('');
	});

	it('keeps the filename to the sku', () => {
		expect(csvFilename('kit-prod')).toBe('kit-prod.csv');
		expect(csvFilename('Cart T!')).toBe('Cart_T.csv');
	});

	it('prices buy rows only and rolls qty into the extension', () => {
		const csv = bomLinesToCsv([
			line({
				level: 1,
				path: 'kit-prod / asm-sat-mule',
				sku: 'asm-sat-mule',
				name: 'Sat encode mule',
				floor: 'assemble',
				kind: 'assembly',
				qty: 2,
				qtyForOne: 2,
				unitPriceCents: 999,
				notes: 'has a quote, still not a buy'
			}),
			line({
				level: 2,
				path: 'kit-prod / asm-sat-mule / rv1126b-turret',
				sku: 'rv1126b-turret',
				name: 'Turret, "PoE"',
				qty: 1,
				qtyForOne: 2,
				unitPriceCents: 15000,
				optional: true,
				notes: 'line, with comma'
			})
		]);
		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(csv).toContain('\r\n');
		const rows = csv
			.replace(/^\uFEFF/, '')
			.trim()
			.split('\r\n');
		expect(rows[0]?.split(',')[0]).toBe('level');
		expect(rows[1]).toContain('asm-sat-mule');
		expect(rows[1]).not.toContain('9.99');
		expect(rows[2]).toContain('"Turret, ""PoE"""');
		expect(rows[2]).toContain('300.00');
		expect(rows[2]).toContain('"line, with comma"');
		expect(rows[2]).toContain(',yes,');
	});
});
