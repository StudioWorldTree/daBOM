import { describe, expect, it } from 'vitest';
import {
	arrowResponse,
	digikeyResponse,
	LOGIN_WALL_PAGE,
	mouserResponse,
	PRICED_PAGE
} from './fixtures';
import { refreshVendor, vendorsFor } from './ladder';
import type { DabomClient, QuoteRow } from './dabom';
import type { Fetcher } from './api';

const BASE = 'http://dabom.test/api/v1';
const SOM = { sku: 't4000-som', manufacturer: 'NVIDIA', mpn: '900-13834-0000-000' };

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

interface Harness {
	fetch: Fetcher;
	posts: Record<string, unknown>[];
	client: DabomClient;
}

/**
 * A fetch router. Every leg of the ladder is mocked here, so no test in this
 * skill reaches a distributor, Firecrawl, or a running daBOM.
 */
function harness(options: {
	quotes?: QuoteRow[];
	vendorUrl?: string | null;
	routes?: Record<string, () => Response>;
}): Harness {
	const posts: Record<string, unknown>[] = [];
	const fetch: Fetcher = async (url, init) => {
		if (url.startsWith(`${BASE}/items/`)) return jsonResponse(SOM);
		if (url === `${BASE}/quotes` && init?.method === 'POST') {
			const body = JSON.parse(String(init.body)) as Record<string, unknown>;
			posts.push(body);
			return jsonResponse({ id: `q-${posts.length}`, isPreferred: false, ...body }, 201);
		}
		if (url === `${BASE}/quotes`) return jsonResponse({ quotes: options.quotes ?? [] });
		if (url.startsWith(`${BASE}/vendors/`)) {
			return jsonResponse({ url: options.vendorUrl ?? 'https://www.arrow.com' });
		}
		for (const [prefix, answer] of Object.entries(options.routes ?? {})) {
			if (url.startsWith(prefix)) return answer();
		}
		throw new Error(`unrouted fetch: ${url}`);
	};
	return { fetch, posts, client: { base: BASE, fetch } };
}

function quoteRow(over: Partial<QuoteRow>): QuoteRow {
	return {
		id: 'seed-1',
		itemSku: 't4000-som',
		vendorId: 'arrow',
		priceCents: 289900,
		currency: 'USD',
		url: null,
		method: 'seed',
		checkedAt: '2026-09-01',
		inStock: null,
		isPreferred: true,
		notes: null,
		...over
	};
}

describe('the API rung', () => {
	const env = { ARROW_LOGIN: 'duke@worldtree.io', ARROW_API_KEY: 'test-key' };
	const now = new Date('2026-09-10T17:00:00Z');

	it('posts method api on an exact Arrow match, at the quantity-1 tier', async () => {
		const h = harness({
			routes: { 'https://api.arrow.com/': () => jsonResponse(arrowResponse(SOM.mpn)) }
		});
		const result = await refreshVendor(h.client, SOM, 'arrow', { fetch: h.fetch, env, now });

		expect(result.rungs[0]).toEqual({ rung: 'api', ok: true });
		expect(h.posts).toHaveLength(1);
		expect(h.posts[0]).toMatchObject({
			itemSku: 't4000-som',
			vendorId: 'arrow',
			method: 'api',
			priceCents: 299900,
			currency: 'USD',
			checkedAt: '2026-09-10',
			url: `https://www.arrow.com/en/products/${SOM.mpn}/nvidia`
		});
		// The tier that produced the price is on the row, so a later change can
		// move to BOM-line quantity without re-reading history.
		expect(String(h.posts[0].notes)).toMatch(/price break qty 1/);
	});

	it('reads Digi-Key and Mouser shapes at the same quantity-1 rule', async () => {
		const dk = harness({
			routes: { 'https://api.digikey.com/': () => jsonResponse(digikeyResponse(SOM.mpn)) }
		});
		await refreshVendor(dk.client, SOM, 'digikey', {
			fetch: dk.fetch,
			env: { DIGIKEY_CLIENT_ID: 'id', DIGIKEY_ACCESS_TOKEN: 'token' },
			now
		});
		expect(dk.posts[0]).toMatchObject({ method: 'api', priceCents: 314900 });

		const mo = harness({
			routes: { 'https://api.mouser.com/': () => jsonResponse(mouserResponse(SOM.mpn)) }
		});
		await refreshVendor(mo.client, SOM, 'mouser', {
			fetch: mo.fetch,
			env: { MOUSER_API_KEY: 'key' },
			now
		});
		expect(mo.posts[0]).toMatchObject({ method: 'api', priceCents: 319900, inStock: true });
	});

	it('inserts nothing for a fuzzy part number and falls to the next rung', async () => {
		const h = harness({
			routes: { 'https://api.arrow.com/': () => jsonResponse(arrowResponse('900-13834-0000-001')) }
		});
		const result = await refreshVendor(h.client, SOM, 'arrow', { fetch: h.fetch, env, now });

		expect(h.posts).toEqual([]);
		expect(result.posted).toBeNull();
		expect(result.rungs[0].reason).toMatch(/no exact match/);
		expect(result.next).toBe('headed');
	});

	it('skips the rung when the item has no mpn', async () => {
		const h = harness({ routes: {} });
		const result = await refreshVendor(
			h.client,
			{ sku: 'resin-shell-front', manufacturer: null, mpn: null },
			'arrow',
			{ fetch: h.fetch, env, now }
		);
		expect(h.posts).toEqual([]);
		expect(result.rungs[0].reason).toMatch(/no mpn/);
	});

	it('does not try an API for a vendor that has none', async () => {
		const h = harness({ routes: {} });
		const result = await refreshVendor(h.client, SOM, 'bh', { fetch: h.fetch, env, now });
		expect(result.rungs[0]).toMatchObject({ rung: 'api', ok: false });
		expect(h.posts).toEqual([]);
	});
});

describe('the crawl rung', () => {
	const env = { FIRECRAWL_API_KEY: 'fc-test' };
	const now = new Date('2026-09-10T17:00:00Z');

	it('inserts nothing behind a login wall and hands off to a headed session', async () => {
		const h = harness({
			quotes: [quoteRow({ vendorId: 'cti', url: 'https://connecttech.com/product/rogue-t5/' })],
			vendorUrl: 'https://connecttech.com',
			routes: {
				'https://api.firecrawl.dev/v2/scrape': () =>
					jsonResponse({ data: { markdown: LOGIN_WALL_PAGE, metadata: { statusCode: 200 } } })
			}
		});
		const result = await refreshVendor(h.client, SOM, 'cti', { fetch: h.fetch, env, now });

		expect(h.posts).toEqual([]);
		expect(result.posted).toBeNull();
		expect(result.next).toBe('headed');
		expect(result.rungs.at(-2)?.reason).toMatch(/sign-in/);
	});

	it('crawls the latest quote URL and posts method crawl with the URL it fetched', async () => {
		const page = 'https://www.bhphotovideo.com/c/product/t4000';
		const h = harness({
			quotes: [quoteRow({ vendorId: 'bh', url: page })],
			vendorUrl: 'https://www.bhphotovideo.com',
			routes: {
				'https://api.firecrawl.dev/v2/scrape': () =>
					jsonResponse({
						data: { markdown: PRICED_PAGE, metadata: { statusCode: 200, sourceURL: page } }
					})
			}
		});
		const result = await refreshVendor(h.client, SOM, 'bh', { fetch: h.fetch, env, now });

		expect(result.posted?.method).toBe('crawl');
		expect(h.posts[0]).toMatchObject({ method: 'crawl', priceCents: 299900, url: page });
	});

	it('searches the vendor domain when no prior quote carries a URL', async () => {
		const found = 'https://www.bhphotovideo.com/c/product/found';
		const queries: string[] = [];
		const h = harness({
			vendorUrl: 'https://www.bhphotovideo.com',
			routes: {
				'https://api.firecrawl.dev/v2/search': () =>
					jsonResponse({ data: { web: [{ url: found }] } }),
				'https://api.firecrawl.dev/v2/scrape': () =>
					jsonResponse({
						data: { markdown: PRICED_PAGE, metadata: { statusCode: 200, sourceURL: found } }
					})
			}
		});
		const spy: Fetcher = async (url, init) => {
			if (url.includes('/search') && init?.body)
				queries.push(String(JSON.parse(String(init.body)).query));
			return h.fetch(url, init);
		};
		const result = await refreshVendor({ base: BASE, fetch: spy }, SOM, 'bh', {
			fetch: spy,
			env,
			now
		});

		expect(queries[0]).toBe(`NVIDIA ${SOM.mpn} site:bhphotovideo.com`);
		expect(h.posts[0]).toMatchObject({ url: found, method: 'crawl' });
		expect(result.next).toBeNull();
	});

	it('inserts nothing when the page answers 403', async () => {
		const h = harness({
			quotes: [quoteRow({ vendorId: 'bh', url: 'https://www.bhphotovideo.com/c/product/x' })],
			vendorUrl: 'https://www.bhphotovideo.com',
			routes: {
				'https://api.firecrawl.dev/v2/scrape': () =>
					jsonResponse({ data: { markdown: 'blocked', metadata: { statusCode: 403 } } })
			}
		});
		const result = await refreshVendor(h.client, SOM, 'bh', { fetch: h.fetch, env, now });
		expect(h.posts).toEqual([]);
		expect(result.next).toBe('headed');
	});

	it('does not crawl when no Firecrawl key is set', async () => {
		const h = harness({ vendorUrl: 'https://www.bhphotovideo.com', routes: {} });
		const result = await refreshVendor(h.client, SOM, 'bh', { fetch: h.fetch, env: {}, now });
		expect(h.posts).toEqual([]);
		expect(result.rungs.at(-2)?.reason).toMatch(/FIRECRAWL_API_KEY unset/);
	});
});

describe('which vendors the ladder tries', () => {
	it('takes the vendors an item already has, plus the API three', () => {
		const rows = [quoteRow({ vendorId: 'bh' }), quoteRow({ vendorId: 'print' })];
		expect(vendorsFor(rows, SOM)).toEqual(['bh', 'digikey', 'mouser', 'arrow']);
	});

	it('adds no API vendor for an item with no mpn', () => {
		const rows = [quoteRow({ vendorId: 'cti', itemSku: 'resin-shell-front' })];
		const item = { sku: 'resin-shell-front', manufacturer: null, mpn: null };
		expect(vendorsFor(rows, item)).toEqual(['cti']);
		expect(vendorsFor([], item)).toEqual([]);
	});
});
