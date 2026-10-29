import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { parseMarkdown } from './candidates';
import { composeFromCart } from './compose';

it('POSTs the exact hand-edited tree file once, with removed sources still removed', async () => {
	const doc = parseMarkdown(`### Cart T — Links
1. [Widget](https://parts.example/widget) — https://parts.example/spec.pdf, $249
`);
	const request = composeFromCart(doc, 'Cart T', { source: 'brief.md' });
	expect(request.root.children?.[0]?.sources).toHaveLength(2);
	request.root.children![0].sources = [];
	const edited = JSON.stringify(request, null, 2) + '\n';
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabom-ingest-post-'));
	const file = path.join(dir, 'edited-tree.json');
	const argv = process.argv;
	const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
	try {
		fs.writeFileSync(file, edited);
		process.argv = ['node', 'post.ts', file];
		vi.stubEnv('DABOM_API_BASE', 'http://crib.example/api/v1');
		vi.stubGlobal('fetch', fetch);
		vi.spyOn(console, 'log').mockImplementation(() => {});

		await import('../scripts/post');

		expect(fetch.mock.calls).toEqual([
			[
				'http://crib.example/api/v1/ingest',
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: edited
				}
			]
		]);
	} finally {
		process.argv = argv;
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
