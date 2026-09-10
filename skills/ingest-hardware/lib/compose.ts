/**
 * Selection → `IngestRequest`. A document is a menu; a BOM is a selection
 * from it. Nothing composes "every heading with a PN row" into a tree.
 *
 * The shape mirrors `IngestNode` / `IngestRequest` in
 * `/.well-known/openapi.json`. It is re-declared here rather than imported so
 * the skill stays HTTP-only and never reaches into the app.
 */

import type { Candidate, Cart, CartLine, ParsedDocument } from './candidates';

export interface IngestNode {
	sku?: string;
	name?: string;
	kind?: string;
	category?: string;
	manufacturer?: string | null;
	mpn?: string | null;
	notes?: string | null;
	source?: string | null;
	qty?: number;
	role?: string;
	lineNotes?: string | null;
	children?: IngestNode[];
}

export interface IngestRequest {
	source?: string | null;
	root: IngestNode;
}

export interface ComposeOptions {
	/** Document path, written to `source` on every node. */
	source: string;
	/** Root name. Defaults to the cart title. */
	rootName?: string;
	/** Only ever set when a human names one. The server ladder mints otherwise. */
	rootSku?: string;
}

/** Match a cart line to a heading candidate by part number, never by guess. */
function candidateFor(line: CartLine, candidates: Candidate[]): Candidate | null {
	for (const code of line.codes) {
		const hit = candidates.find((c) => c.mpn && c.mpn.toLowerCase() === code.toLowerCase());
		if (hit) return hit;
	}
	const bare = candidates.find(
		(c) => c.mpn && new RegExp(`\\b${escape(c.mpn)}\\b`, 'i').test(line.raw)
	);
	return bare ?? null;
}

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One cart line → one node. A line whose codes match no candidate and carries
 * more than one code is ambiguous (the ATS heatsink line offers a passive and
 * an active part), so it keeps no MPN and lands name-minted as a placeholder.
 * Cart lines with no part number anywhere in the document do the same. Price
 * cells are dropped; quotes are `add-price-skills`.
 */
function nodeFor(line: CartLine, candidates: Candidate[], source: string): IngestNode {
	const match = candidateFor(line, candidates);
	const mpn = match?.mpn ?? (line.codes.length === 1 ? line.codes[0] : null);
	return {
		name: match?.heading ?? line.name,
		manufacturer: match?.manufacturer ?? null,
		mpn,
		notes: match?.notes ?? null,
		source,
		qty: line.qty,
		lineNotes: line.raw
	};
}

/** Compose the tree for a cart the document names, e.g. `Cart T`. */
export function composeFromCart(
	doc: ParsedDocument,
	cartId: string,
	options: ComposeOptions
): IngestRequest {
	const cart = doc.carts.find((c) => c.id.toLowerCase() === cartId.toLowerCase());
	if (!cart) {
		const known = doc.carts.map((c) => c.id).join(', ') || 'none';
		throw new Error(`No cart named ${cartId} in the document (found: ${known})`);
	}
	if (cart.lines.length === 0) {
		throw new Error(
			`${cart.id} has no numbered lines to select from; compose another cart and hand edit the tree file`
		);
	}
	return treeOf(cart.lines, doc.candidates, options.rootName ?? cart.title, options);
}

/** Compose the tree from an explicit list of MPNs a human passed in. */
export function composeFromMpns(
	doc: ParsedDocument,
	mpns: string[],
	options: ComposeOptions
): IngestRequest {
	const lines: CartLine[] = mpns.map((mpn) => ({ raw: mpn, name: mpn, qty: 1, codes: [mpn] }));
	const missing = lines.filter((line) => !candidateFor(line, doc.candidates)).map((l) => l.raw);
	if (missing.length) {
		throw new Error(`No candidate in the document for: ${missing.join(', ')}`);
	}
	return treeOf(lines, doc.candidates, options.rootName ?? 'Selected parts', options);
}

function treeOf(
	lines: CartLine[],
	candidates: Candidate[],
	rootName: string,
	options: ComposeOptions
): IngestRequest {
	const root: IngestNode = {
		name: rootName,
		kind: 'kit',
		source: options.source,
		children: lines.map((line) => nodeFor(line, candidates, options.source))
	};
	if (options.rootSku) root.sku = options.rootSku;
	return { source: options.source, root };
}
