/**
 * The daBOM client. HTTP only: `GET /items/{sku}`, `GET /quotes`, and the one
 * write, `POST /api/v1/quotes`. The skill never opens the local Postgres file
 * and never imports the app's server code, so the 422 guards and the
 * supersede-preferred transaction apply to every row it writes.
 */

import type { Fetcher, ItemRef } from './api';

export interface DabomClient {
	base: string;
	fetch: Fetcher;
}

export interface QuoteRow {
	id: string;
	itemSku: string;
	vendorId: string;
	priceCents: number | null;
	currency: string;
	url: string | null;
	method: string;
	checkedAt: string | null;
	inStock: boolean | null;
	isPreferred: boolean;
	notes: string | null;
}

export interface QuotePost {
	itemSku: string;
	vendorId: string;
	priceCents: number;
	currency: string;
	url: string | null;
	method: 'api' | 'crawl' | 'headed';
	checkedAt: string;
	inStock?: boolean | null;
	notes?: string | null;
}

async function readJson(response: Response, what: string): Promise<unknown> {
	const text = await response.text();
	if (!response.ok) throw new Error(`${what} answered ${response.status}: ${text}`);
	return JSON.parse(text);
}

/** The item the ladder is refreshing. `manufacturer` and `mpn` drive the API rung. */
export async function getItem(client: DabomClient, sku: string): Promise<ItemRef> {
	const body = (await readJson(
		await client.fetch(`${client.base}/items/${encodeURIComponent(sku)}`),
		`GET /items/${sku}`
	)) as { sku: string; manufacturer: string | null; mpn: string | null };
	return { sku: body.sku, manufacturer: body.manufacturer ?? null, mpn: body.mpn ?? null };
}

/** Every quote, newest first within an (item, vendor) pair. */
export async function listQuotes(client: DabomClient): Promise<QuoteRow[]> {
	const body = (await readJson(await client.fetch(`${client.base}/quotes`), 'GET /quotes')) as {
		quotes: QuoteRow[];
	};
	return body.quotes;
}

/**
 * The crawl rung's starting URL, per the advise pin: the URL on the latest
 * quote row for that (item, vendor). `GET /quotes` already orders newest
 * first inside a pair, so the first hit is the latest. Null means the ladder
 * has to search for a page instead.
 */
export function latestQuoteUrl(rows: QuoteRow[], sku: string, vendorId: string): string | null {
	const hit = rows.find((row) => row.itemSku === sku && row.vendorId === vendorId && row.url);
	return hit?.url ?? null;
}

/** The one write. A non-2xx is reported, never retried as a different method. */
export async function postQuote(client: DabomClient, quote: QuotePost): Promise<QuoteRow> {
	const response = await client.fetch(`${client.base}/quotes`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(quote)
	});
	return (await readJson(response, 'POST /quotes')) as QuoteRow;
}

/** `checkedAt` is the skill's fetch date, never a date lifted off the page. */
export function fetchDate(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

/**
 * The vendor's homepage host, used to scope a Firecrawl search. The vendors
 * table holds a homepage and nothing more, which is exactly why the crawl
 * rung has to search when no prior quote carries a product URL.
 */
export async function vendorDomain(client: DabomClient, vendorId: string): Promise<string | null> {
	const body = (await readJson(
		await client.fetch(`${client.base}/vendors/${encodeURIComponent(vendorId)}`),
		`GET /vendors/${vendorId}`
	)) as { url: string | null };
	if (!body.url) return null;
	try {
		return new URL(body.url).host.replace(/^www\./, '');
	} catch {
		return null;
	}
}
