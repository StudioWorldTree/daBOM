#!/usr/bin/env -S npx tsx
/**
 * Tree file → POST /api/v1/ingest. The only input is a tree file path, never
 * a source document, so no code path can skip the file step.
 *
 *   DABOM_API_BASE=http://localhost:5173/api/v1 \
 *     npx tsx skills/ingest-hardware/scripts/post.ts /tmp/cart-t.json
 *
 * On a non-2xx: read the body, edit the tree file, re-POST the whole file.
 * Never hand-POST /items and /bom lines around a 409.
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file || file.endsWith('.md') || file.endsWith('.pdf')) {
	console.error('usage: post.ts <IngestRequest json file>  (a tree file, not a document)');
	process.exit(2);
}

const base = process.env.DABOM_API_BASE ?? 'http://localhost:5173/api/v1';
const body = fs.readFileSync(file, 'utf8');
JSON.parse(body); // fail here, not at the server, if the hand edit broke it

const response = await fetch(`${base}/ingest`, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body
});

const text = await response.text();
console.log(`${response.status} ${response.statusText}`);
console.log(text);
if (!response.ok) process.exit(1);
