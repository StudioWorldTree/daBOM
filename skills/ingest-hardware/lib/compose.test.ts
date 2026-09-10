import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './candidates';
import { composeFromCart, composeFromMpns } from './compose';

// The whole shopping brief, not an excerpt. The point of the fixture is that
// the document is a menu with rejected parts in it.
const SOURCE = '../AICamera/docs/SHOPPING.md';
const MARKDOWN = fs.readFileSync(path.resolve(process.cwd(), SOURCE), 'utf8');

const T4000 = '900-13834-0000-000';
const ROGUE_T5 = 'AGX302';
const DEV_KIT = '945-14070-0080-000';

const doc = parseMarkdown(MARKDOWN);

describe('candidates from the whole shopping brief', () => {
	it('reads a part number out of any table cell, not only a PN label row', () => {
		// The Rogue-T5 keeps its number in a `Carrier-only` row.
		const rogue = doc.candidates.find((c) => c.heading.includes('Rogue-T5'));
		expect(rogue?.mpn).toBe(ROGUE_T5);
		expect(rogue?.manufacturer).toBe('Connect Tech');
	});

	it('takes the manufacturer from the heading when it names one', () => {
		const som = doc.candidates.find((c) => c.mpn === T4000);
		expect(som?.manufacturer).toBe('NVIDIA');
		expect(som?.heading).toBe('NVIDIA Jetson T4000 SOM');
	});

	it('offers the rejected dev kit as a candidate', () => {
		// A candidate is evidence, not a BOM line: the menu still lists it.
		const kit = doc.candidates.find((c) => c.mpn === DEV_KIT);
		expect(kit?.heading).toBe('NVIDIA AGX Thor Developer Kit');
	});

	it('finds the carts the document names', () => {
		expect(doc.carts.map((c) => c.id)).toEqual(['Cart S', 'Cart T', 'Cart C']);
	});
});

describe('the production kit is not the shopping menu', () => {
	const request = composeFromCart(doc, 'Cart T', { source: SOURCE });
	const tree = JSON.stringify(request);
	const mpns = (request.root.children ?? []).map((child) => child.mpn);

	it('contains the T4000 SOM and the Rogue-T5', () => {
		expect(mpns).toContain(T4000);
		expect(mpns).toContain(ROGUE_T5);
	});

	it('does not contain the AGX Thor Developer Kit', () => {
		expect(mpns).not.toContain(DEV_KIT);
		expect(tree).not.toContain(DEV_KIT);
		expect(tree).not.toContain('Developer Kit');
	});

	it('does not contain the rejected carriers', () => {
		expect(tree).not.toContain('Gauntlet');
		expect(tree).not.toContain('DSBOARD-THRMAX');
		expect(tree).not.toContain('X242');
	});

	it('leaves a cart line with no part number name-minted', () => {
		const pyxis = (request.root.children ?? []).find((child) =>
			(child.name ?? '').includes('PYXIS 6K PL')
		);
		expect(pyxis?.mpn).toBeNull();
	});

	it('keeps an ambiguous two-part line off a part number', () => {
		// The heatsink line offers a passive and an active part; picking one
		// would be inventing a choice the document did not make.
		const heatsink = (request.root.children ?? []).find((child) =>
			(child.lineNotes ?? '').includes('ATS Thor HS')
		);
		expect(heatsink?.mpn).toBeNull();
	});

	it('carries the qty a cart line states', () => {
		const turrets = (request.root.children ?? []).find((child) =>
			(child.lineNotes ?? '').includes('PoE turrets')
		);
		expect(turrets?.qty).toBe(1);
	});

	it('leaves sku absent so the server ladder resolves identity', () => {
		expect(request.root.sku).toBeUndefined();
		for (const child of request.root.children ?? []) expect(child.sku).toBeUndefined();
	});

	it('drops price cells', () => {
		expect(tree).not.toContain('$2,749');
		expect(tree).not.toContain('3,675');
	});

	it('roots the tree at the cart the document names', () => {
		expect(request.root.name).toBe('Cart T — T4000 + Rogue-T5');
		expect(request.root.kind).toBe('kit');
	});

	it('names the document as the source', () => {
		expect(request.source).toBe(SOURCE);
	});
});

describe('a cart with no numbered lines is not a selection', () => {
	it('refuses Cart C, which only says "same as T"', () => {
		expect(() => composeFromCart(doc, 'Cart C', { source: SOURCE })).toThrow(/no numbered lines/);
	});
});

describe('an MPN list is the other selection', () => {
	it('composes only the named parts', () => {
		const request = composeFromMpns(doc, [T4000, ROGUE_T5], { source: SOURCE });
		expect((request.root.children ?? []).map((c) => c.mpn)).toEqual([T4000, ROGUE_T5]);
	});

	it('refuses an MPN the document does not carry', () => {
		expect(() => composeFromMpns(doc, ['NOT-IN-THE-DOC'], { source: SOURCE })).toThrow(
			/No candidate/
		);
	});
});
