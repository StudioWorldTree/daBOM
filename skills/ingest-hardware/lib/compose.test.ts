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

	it('leaves the optional satellite plant off Cart T', () => {
		const text = (request.root.children ?? [])
			.map((child) => `${child.name ?? ''} ${child.lineNotes ?? ''}`)
			.join('\n');
		expect(text).not.toMatch(/turret|EVB|PoE\+/i);
	});

	it('carries the qty a cart line states', () => {
		const mini = parseMarkdown('### Cart Q — qty\n\n1. 2× Widget — `WIDGET-2`\n');
		const composed = composeFromCart(mini, 'Cart Q', { source: 'fixture' });
		expect(composed.root.children?.[0]?.qty).toBe(2);
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

describe('selected-line source links', () => {
	const linked = parseMarkdown(`
### NVIDIA [Widget](https://parts.example/widget) — $249
| PN | \`WIDGET-100\` |
| Notes | A widget for $249. |

### [Rejected part](https://rejected.example/heading)
| PN | \`REJECT-100\` |

### Cart T — [Selected](https://parts.example/kit)
1. 2× [Widget](https://shop.example/widget) — \`WIDGET-100\`, $249; http://vendor.example/spec
2. [Cable](https://shop.example/cable) — $19
3. Unlinked accessory — $10

### Cart R — Rejected
1. Other item — https://rejected.example/cart
`);

	it('keeps every link from selected cart lines and matching headings', () => {
		const request = composeFromCart(linked, 'Cart T', { source: 'brief.md' });
		expect(request.root.sources).toEqual([{ locator: 'https://parts.example/kit' }]);
		expect(request.root.children?.[0]).toMatchObject({
			name: 'NVIDIA Widget',
			qty: 2,
			source: 'brief.md',
			sources: [
				{ locator: 'https://parts.example/widget' },
				{ locator: 'https://shop.example/widget' },
				{ locator: 'http://vendor.example/spec' }
			]
		});
		expect(request.root.children?.[1]).toMatchObject({
			name: 'Cable',
			mpn: null,
			sources: [{ locator: 'https://shop.example/cable' }]
		});
		expect(request.root.children?.[2]?.sources).toEqual([]);
		expect(request.source).toBe('brief.md');
		expect(JSON.stringify(request)).not.toMatch(/rejected\.example|\$249|\$19|\$10/);
	});

	it('carries only the selected heading links for an explicit MPN selection', () => {
		const request = composeFromMpns(linked, ['WIDGET-100'], { source: 'brief.md' });
		expect(request.root.children?.[0]?.sources).toEqual([
			{ locator: 'https://parts.example/widget' }
		]);
		expect(JSON.stringify(request)).not.toMatch(
			/rejected\.example|shop\.example|vendor\.example|\$/
		);
	});

	it('keeps two markdown destinations on one line, without turning them into part numbers', () => {
		const doc = parseMarkdown(`### Cart T — Links
1. [Widget](https://parts.example/widget) [datasheet](https://parts.example/spec.pdf)
`);
		const node = composeFromCart(doc, 'Cart T', { source: 'brief.md' }).root.children?.[0];
		expect(node?.sources).toEqual([
			{ locator: 'https://parts.example/widget' },
			{ locator: 'https://parts.example/spec.pdf' }
		]);
		expect(node?.name).toBe('Widget datasheet');
		expect(node?.mpn).toBeNull();
	});

	it('keeps bare URL query strings and balanced parentheses, excluding prose punctuation', () => {
		const doc = parseMarkdown(`### Cart T — Links
1. Widget — https://parts.example/spec(v2)?a=1&b=2, (http://shop.example/widget).
`);
		expect(
			composeFromCart(doc, 'Cart T', { source: 'brief.md' }).root.children?.[0]?.sources
		).toEqual([
			{ locator: 'https://parts.example/spec(v2)?a=1&b=2' },
			{ locator: 'http://shop.example/widget' }
		]);
	});

	it('reads titled and angle-wrapped markdown links without extracting URLs from titles', () => {
		const doc = parseMarkdown(`### Cart T — Links
1. [Widget](<https://parts.example/spec(v2)> "see https://title.example") [local](docs/spec.pdf)
`);
		const node = composeFromCart(doc, 'Cart T', { source: 'brief.md' }).root.children?.[0];
		expect(node?.sources).toEqual([
			{ locator: 'https://parts.example/spec(v2)' },
			{ locator: 'docs/spec.pdf' }
		]);
		expect(node?.name).toBe('Widget local');
	});
});
