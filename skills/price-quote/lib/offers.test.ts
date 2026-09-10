import { describe, expect, it } from 'vitest';
import { arrowResponse, mouserResponse } from './fixtures';
import { offersFrom, sameMpn, tierNote, toCents, unitAtQty } from './offers';

describe('reading a distributor response', () => {
	it('pulls the part number, breaks, url and stock out of Arrow nesting', () => {
		const offers = offersFrom(arrowResponse('900-13834-0000-000'));
		expect(offers).toHaveLength(1);
		expect(offers[0].mpn).toBe('900-13834-0000-000');
		expect(offers[0].breaks).toEqual([
			{ qty: 1, unitPriceCents: 299900 },
			{ qty: 10, unitPriceCents: 279900 }
		]);
		expect(offers[0].currency).toBe('USD');
		expect(offers[0].inStock).toBe(true);
	});

	it('reads Mouser money strings as cents', () => {
		const offers = offersFrom(mouserResponse('AGX302'));
		expect(offers[0].breaks[0]).toEqual({ qty: 1, unitPriceCents: 319900 });
		expect(toCents('$1,234.56')).toBe(123456);
		expect(toCents(1234.56)).toBe(123456);
		expect(toCents('call for price')).toBeNull();
	});
});

describe('the exact-mpn rule', () => {
	it('matches on case and whitespace only, never on a near part number', () => {
		expect(sameMpn('AGX302', ' agx302 ')).toBe(true);
		expect(sameMpn('900-13834-0000-000', '900-13834-0000-001')).toBe(false);
		expect(sameMpn('900-13834-0000-000', '900138340000000')).toBe(false);
		expect(sameMpn(null, 'AGX302')).toBe(false);
	});
});

describe('the quantity rule', () => {
	const breaks = [
		{ qty: 1, unitPriceCents: 299900 },
		{ qty: 10, unitPriceCents: 279900 }
	];

	it('takes the unit price at quantity 1 and names the tier', () => {
		const tier = unitAtQty(breaks);
		expect(tier).toEqual({ qty: 1, unitPriceCents: 299900 });
		expect(tierNote(tier!)).toMatch(/price break qty 1/);
	});

	it('falls to the vendor minimum when there is no quantity-1 break', () => {
		const tier = unitAtQty([{ qty: 5, unitPriceCents: 1000 }]);
		expect(tier).toEqual({ qty: 5, unitPriceCents: 1000 });
		expect(tierNote(tier!)).toMatch(/vendor minimum qty 5/);
	});

	it('has no answer with no breaks, which fails the rung', () => {
		expect(unitAtQty([])).toBeNull();
	});
});
