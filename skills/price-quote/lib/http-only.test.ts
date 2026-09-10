import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The skill's only write is POST /api/v1/quotes. The checkable form of that is
// that nothing in the skill directory names a database path or the app's
// server code. Tokens are built from fragments so this file does not fail its
// own grep.
const FORBIDDEN = ['driz' + 'zle', 'data/' + 'dabom', 'pg' + 'lite', '$lib/' + 'server'];

const SKILL_DIR = path.resolve(process.cwd(), 'skills/price-quote');

function walk(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

describe('the price skill is HTTP-only', () => {
	const files = walk(SKILL_DIR);

	it('has files to check', () => {
		expect(files.length).toBeGreaterThan(3);
	});

	for (const token of FORBIDDEN) {
		it(`never names ${token}`, () => {
			const hits = files.filter((file) => fs.readFileSync(file, 'utf8').includes(token));
			expect(hits).toEqual([]);
		});
	}

	it('never runs SQL', () => {
		const hits = files.filter((file) =>
			/\bSELECT\b|\bINSERT INTO\b/.test(fs.readFileSync(file, 'utf8'))
		);
		expect(hits).toEqual([]);
	});

	// Keys live in the environment. A committed key is a leak, not a config.
	it('commits no API key', () => {
		const hits = files.filter((file) =>
			/(api[_-]?key|access[_-]?token|apikey)\s*[:=]\s*['"][A-Za-z0-9_-]{16,}/i.test(
				fs.readFileSync(file, 'utf8')
			)
		);
		expect(hits).toEqual([]);
	});
});
