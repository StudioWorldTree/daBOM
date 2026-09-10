#!/usr/bin/env -S npx tsx
/**
 * List what a document offers. Reads markdown on stdin or from a path.
 * PDFs go through `pdf2md <file>` first; this script never sees PDF bytes.
 *
 *   npx tsx skills/ingest-hardware/scripts/candidates.ts ../AICamera/docs/SHOPPING.md
 */
import fs from 'node:fs';
import { parseMarkdown } from '../lib/candidates';

const file = process.argv[2];
if (!file) {
	console.error('usage: candidates.ts <markdown file>');
	process.exit(2);
}

const doc = parseMarkdown(fs.readFileSync(file, 'utf8'));

console.log(`# candidates (${doc.candidates.length})`);
for (const c of doc.candidates) {
	console.log(`- ${c.heading}${c.mpn ? ` — ${c.mpn}` : ' — (no part number)'}`);
}
console.log(`\n# carts (${doc.carts.length})`);
for (const cart of doc.carts) {
	console.log(`- ${cart.id}: ${cart.title} (${cart.lines.length} lines)`);
}
