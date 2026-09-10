/**
 * The middle rung: a Firecrawl fetch of the public product page. Reached only
 * when the vendor has no API, no key is set, or the API named no exact match.
 *
 * A page that will not price a part unauthenticated is a login wall, and a
 * login wall is not a quote. The answer to one is the headed rung, not a
 * guessed number.
 */

import type { Fetcher, RungOutcome } from './api';
import { toCents } from './offers';

export interface CrawlDeps {
	fetch: Fetcher;
	env: Record<string, string | undefined>;
}

const FIRECRAWL = 'https://api.firecrawl.dev/v2';

/** Phrases a distributor uses when it is holding the price behind a sign-in. */
const LOGIN_WALL =
	/(sign in|log in|login|register|create an account)[^.\n]{0,40}(to see|to view|for)[^.\n]{0,20}(price|pricing|cost)|price[^.\n]{0,20}(available|shown)[^.\n]{0,30}(after|once)[^.\n]{0,20}(sign|log)|add to cart to see price|call for (a )?(price|quote)|request (a )?quote for pricing|member[- ]only pricing/i;

/** A page that is the sign-in form itself rather than the product page. */
const LOGIN_PAGE = /(^|\n)#{1,3}\s*(sign in|log in|create your account)\b/i;

/** A money token the page labels as the price, then any money token. */
const LABELLED_PRICE =
	/(?:price|each|unit price|your price|1\s*\+|qty\s*1)[^$\n]{0,40}\$\s?([\d,]+(?:\.\d{2})?)/i;
const ANY_PRICE = /\$\s?([\d,]+(?:\.\d{2})?)/;

export function looksLikeLoginWall(markdown: string): boolean {
	return LOGIN_WALL.test(markdown) || LOGIN_PAGE.test(markdown);
}

/**
 * Page text → cents. A labelled price wins over the first money token on the
 * page, because distributor pages open with accessory and bundle prices. No
 * money at all is a parse miss, which fails the rung like any other failed
 * fetch.
 */
export function extractPriceCents(markdown: string): number | null {
	const hit = LABELLED_PRICE.exec(markdown) ?? ANY_PRICE.exec(markdown);
	return hit ? toCents(hit[1]) : null;
}

/** Firecrawl search, scoped to the vendor's own domain. */
export async function searchProductUrl(
	deps: CrawlDeps,
	query: string,
	domain: string | null
): Promise<string | null> {
	const key = deps.env.FIRECRAWL_API_KEY;
	if (!key) return null;
	const response = await deps.fetch(`${FIRECRAWL}/search`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
		body: JSON.stringify({ query: domain ? `${query} site:${domain}` : query, limit: 5 })
	});
	if (!response.ok) return null;
	const body = (await response.json()) as {
		data?: { web?: { url?: string }[] } | { url?: string }[];
	};
	const rows = Array.isArray(body.data) ? body.data : (body.data?.web ?? []);
	const urls = rows.map((row) => row.url).filter((url): url is string => typeof url === 'string');
	if (!domain) return urls[0] ?? null;
	return urls.find((url) => url.includes(domain)) ?? null;
}

/** Firecrawl scrape. Markdown out, plus the URL Firecrawl actually landed on. */
export async function scrape(
	deps: CrawlDeps,
	url: string
): Promise<{ markdown: string; url: string; status: number } | null> {
	const key = deps.env.FIRECRAWL_API_KEY;
	if (!key) return null;
	const response = await deps.fetch(`${FIRECRAWL}/scrape`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
		body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true })
	});
	if (!response.ok) return null;
	const body = (await response.json()) as {
		data?: { markdown?: string; metadata?: { sourceURL?: string; statusCode?: number } };
	};
	const markdown = body.data?.markdown;
	if (typeof markdown !== 'string') return null;
	return {
		markdown,
		url: body.data?.metadata?.sourceURL ?? url,
		status: body.data?.metadata?.statusCode ?? 200
	};
}

/**
 * Try the crawl rung. `startUrl` is the URL on the latest quote for this
 * (item, vendor); when there is none the rung searches on manufacturer plus
 * MPN scoped to the vendor domain. The URL actually fetched goes on the
 * posted row, so the next run does not search again.
 */
export async function crawlRung(
	deps: CrawlDeps,
	options: { startUrl: string | null; searchQuery: string; domain: string | null; vendorId: string }
): Promise<RungOutcome> {
	if (!deps.env.FIRECRAWL_API_KEY) {
		return { ok: false, reason: 'FIRECRAWL_API_KEY unset; the crawl rung does not apply' };
	}
	const url =
		options.startUrl ?? (await searchProductUrl(deps, options.searchQuery, options.domain));
	if (!url) {
		return {
			ok: false,
			reason: `no product page found for ${options.searchQuery} on ${options.domain ?? 'the web'}`
		};
	}

	const page = await scrape(deps, url);
	if (!page) return { ok: false, reason: `crawl of ${url} did not return a page` };
	if (page.status === 401 || page.status === 403) {
		return { ok: false, reason: `${url} answered ${page.status}; sign in with the headed rung` };
	}
	if (looksLikeLoginWall(page.markdown)) {
		return {
			ok: false,
			reason: `${url} holds its price behind a sign-in; the next step is a headed session`
		};
	}

	const priceCents = extractPriceCents(page.markdown);
	if (priceCents === null || priceCents <= 0) {
		return { ok: false, reason: `no price parsed from ${page.url}; read it in a headed session` };
	}
	return {
		ok: true,
		method: 'crawl',
		priceCents,
		currency: 'USD',
		url: page.url,
		inStock: /out of stock|backorder|currently unavailable/i.test(page.markdown) ? false : null,
		notes: `${options.vendorId} public page, crawled; unit price at qty 1 as listed`
	};
}
