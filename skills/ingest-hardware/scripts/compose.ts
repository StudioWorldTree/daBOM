#!/usr/bin/env -S npx tsx
/**
 * Selection → tree file. This is the review artifact. Read it, edit it, then
 * POST it with `post.ts`.
 *
 *   npx tsx skills/ingest-hardware/scripts/compose.ts \
 *     --source ../AICamera/docs/SHOPPING.md --cart "Cart T" --out /tmp/cart-t.json
 *   npx tsx skills/ingest-hardware/scripts/compose.ts \
 *     --source doc.md --mpn 900-13834-0000-000 --mpn AGX302 --out /tmp/pair.json
 */
import fs from 'node:fs';
import { parseMarkdown } from '../lib/candidates';
import { composeFromCart, composeFromMpns } from '../lib/compose';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
}

function args(name: string): string[] {
	return process.argv.flatMap((token, i) => (token === `--${name}` ? [process.argv[i + 1]] : []));
}

const source = arg('source');
const out = arg('out');
if (!source || !out) {
	console.error('usage: compose.ts --source <md> (--cart "Cart T" | --mpn X --mpn Y) --out <json>');
	process.exit(2);
}

const doc = parseMarkdown(fs.readFileSync(source, 'utf8'));
const options = { source, rootName: arg('name'), rootSku: arg('sku') };
const cart = arg('cart');
const mpns = args('mpn');

if (!cart && mpns.length === 0) {
	console.error('Pick a selection: --cart or one or more --mpn. A document is not a BOM.');
	process.exit(2);
}

const request = cart ? composeFromCart(doc, cart, options) : composeFromMpns(doc, mpns, options);

fs.writeFileSync(out, JSON.stringify(request, null, 2) + '\n');
console.log(`Wrote ${out}. Read it before you POST it.`);
