/**
 * Markdown → candidates. A candidate is evidence that a part exists in the
 * document; it is not a BOM line. Composition into a tree happens in
 * `compose.ts` from an explicit selection.
 *
 * Nothing here touches the app: no database, no server import, no HTTP. The
 * only writer in this skill is `scripts/post.ts`, which POSTs a tree file.
 */

/** A part the document describes under its own heading, or names in a cart. */
export interface Candidate {
	/** Cleaned heading or cart-line text. */
	heading: string;
	/** Manufacturer when the heading names one, else null. */
	manufacturer: string | null;
	/** Part number as written in the document. Never invented. */
	mpn: string | null;
	/** The `Notes` cell, or the raw cart line. */
	notes: string | null;
}

/** One numbered line inside a `### Cart X` section. */
export interface CartLine {
	/** Raw list item text, minus the number. */
	raw: string;
	/** Name after the qty prefix and before the em-dash aside. */
	name: string;
	/** Leading `2×` style quantity. A range (`1–2×`) yields the low end. */
	qty: number;
	/** Every backticked code on the line that looks like a part number. */
	codes: string[];
}

/** A `### Cart X — ...` section: a named selection the document itself makes. */
export interface Cart {
	/** Section id as an agent would name it, e.g. `Cart T`. */
	id: string;
	/** Full heading text, e.g. `Cart T — T4000 + Rogue-T5`. */
	title: string;
	lines: CartLine[];
}

export interface ParsedDocument {
	candidates: Candidate[];
	carts: Cart[];
}

/**
 * Manufacturers this repo's hardware docs name in headings. A heading that
 * does not start with one of these gets a null manufacturer, which is what
 * the ingest route wants: MPN alone then resolves identity.
 */
const MANUFACTURERS = [
	'NVIDIA',
	'Connect Tech',
	'FORECR',
	'Auvidea',
	'Blackmagic Design',
	'Blackmagic',
	'ATS',
	'Advanced Thermal Solutions'
];

/** Backticked codes shaped like a part number, not prose in code font. */
const PART_NUMBER = /^[A-Z0-9][A-Z0-9._/-]{3,}$/i;

/**
 * A `PN` label anywhere in a table row, including a compound cell: the label
 * may be its own cell (`| PN | \`900-…\` |`) or sit inside one
 * (`| Carrier-only | PN \`AGX302\` … |`).
 */
const PN_IN_ROW = /\bPN\b[^`]{0,40}`([^`]+)`/;

const HEADING = /^(#{2,6})\s+(.*)$/;
const LIST_ITEM = /^\s*\d+\.\s+(.*)$/;
const QTY_PREFIX = /^(\d+)(?:\s*[–—-]\s*\d+)?\s*[×x]\s+/;

/**
 * Prices in the brief are a snapshot, and quotes are a separate skill. Strip
 * every money token so no price reaches the tree file as free text.
 */
export function dropPrices(text: string): string {
	return text
		.replace(/[~≈]?[A-Z]{0,2}[$€£]\s?[\d.,]+\s*[kK]?\+?(?:\s*[–—-]\s*[\d.,]+\s*[kK]?)?/g, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([,.;])/g, '$1')
		.replace(/\s*[–—-]\s*$/, '')
		.trim();
}

/** Strip emphasis, links and code font so a heading reads as a part name. */
function plain(text: string): string {
	return text
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\*{1,3}/g, '')
		.replace(/`/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Heading → part name: drop the em-dash aside and the trailing parenthetical. */
function headingName(text: string): string {
	return plain(text)
		.replace(/\s*\([^)]*\)/g, ' ')
		.split(/\s+[–—]\s+/)[0]
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/** Cart heading → root name: keep the em-dash subtitle, drop the aside. */
function cartTitle(text: string): string {
	return plain(text)
		.replace(/\s*\([^)]*\)\s*$/, '')
		.trim();
}

function manufacturerOf(name: string): string | null {
	const hit = MANUFACTURERS.find((m) => name.toLowerCase().startsWith(m.toLowerCase() + ' '));
	return hit ?? null;
}

function cells(row: string): string[] {
	return row
		.replace(/^\s*\|/, '')
		.replace(/\|\s*$/, '')
		.split('|')
		.map((cell) => cell.trim());
}

/** The label cell of a two-column spec row, lowercased. */
function labelOf(row: string): string {
	return cells(row)[0]?.toLowerCase() ?? '';
}

/**
 * Part number for a heading's body. Reads `PN` inside *any* table cell, not
 * only a `| PN |` label row: the Rogue-T5 keeps its number in a
 * `| Carrier-only | PN \`AGX302\` … |` row and a label-only match misses it.
 */
function partNumberOf(body: string[], heading: string): string | null {
	for (const row of body) {
		if (!row.trimStart().startsWith('|')) continue;
		const hit = PN_IN_ROW.exec(row);
		if (hit && PART_NUMBER.test(hit[1].trim())) return hit[1].trim();
	}
	const inHeading = /`([^`]+)`/.exec(heading);
	if (inHeading && PART_NUMBER.test(inHeading[1].trim())) return inHeading[1].trim();
	return null;
}

function notesOf(body: string[]): string | null {
	for (const row of body) {
		if (labelOf(row) === 'notes') {
			const value = dropPrices(plain(cells(row)[1] ?? ''));
			if (value) return value;
		}
	}
	return null;
}

function cartLine(raw: string): CartLine {
	const qtyHit = QTY_PREFIX.exec(raw);
	const body = qtyHit ? raw.slice(qtyHit[0].length) : raw;
	const codes = [...body.matchAll(/`([^`]+)`/g)]
		.map((m) => m[1].trim())
		.filter((code) => PART_NUMBER.test(code));
	return {
		raw: dropPrices(plain(raw)),
		name: plain(body.split(/\s+[–—]\s+/)[0]),
		qty: qtyHit ? Number(qtyHit[1]) : 1,
		codes
	};
}

/**
 * Read a markdown hardware brief. PDFs go through `pdf2md` first; this
 * function never sees PDF bytes.
 */
export function parseMarkdown(markdown: string): ParsedDocument {
	const lines = markdown.split('\n');
	const candidates: Candidate[] = [];
	const carts: Cart[] = [];

	let heading: { text: string; level: number } | null = null;
	let cart: Cart | null = null;
	let body: string[] = [];

	const flush = () => {
		if (!heading || cart) return;
		const name = headingName(heading.text);
		const mpn = partNumberOf(body, heading.text);
		if (!name) return;
		candidates.push({
			heading: name,
			manufacturer: manufacturerOf(name),
			mpn,
			notes: notesOf(body)
		});
	};

	for (const line of lines) {
		const hit = HEADING.exec(line);
		if (hit) {
			flush();
			body = [];
			const text = hit[2].trim();
			const level = hit[1].length;
			heading = { text, level };
			const cartHit = /^(Cart\s+[A-Z])\b/.exec(plain(text));
			if (cartHit) {
				cart = { id: cartHit[1], title: cartTitle(text), lines: [] };
				carts.push(cart);
			} else if (level <= 2) {
				cart = null;
				heading = null;
			} else {
				cart = null;
			}
			continue;
		}
		if (cart) {
			const item = LIST_ITEM.exec(line);
			if (item) cart.lines.push(cartLine(item[1].trim()));
			continue;
		}
		if (heading) body.push(line);
	}
	flush();

	return { candidates, carts };
}
