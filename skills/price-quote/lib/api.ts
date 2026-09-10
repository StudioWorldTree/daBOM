/**
 * The top rung: a distributor API. Digi-Key, Mouser and Arrow answer for a
 * manufacturer part number; B&H and CTI/WDL have no day-one API and start at
 * the crawl rung.
 *
 * Keys come from the environment and never from a file in this repo. A vendor
 * whose keys are unset is not an error, it is a rung that does not apply.
 */

import { offersFrom, sameMpn, tierNote, unitAtQty, type Offer } from './offers';

export interface ItemRef {
	sku: string;
	manufacturer: string | null;
	mpn: string | null;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface RungDeps {
	fetch: Fetcher;
	env: Record<string, string | undefined>;
}

/** What a rung produced. `ok: false` is a rung that failed, never a quote. */
export type RungOutcome =
	| {
			ok: true;
			method: 'api' | 'crawl' | 'headed';
			priceCents: number;
			currency: string;
			url: string | null;
			inStock: boolean | null;
			notes: string;
	  }
	| { ok: false; reason: string };

export interface ApiVendor {
	id: string;
	/** Env vars that must all be set before the rung is attempted. */
	env: string[];
	request(mpn: string, env: Record<string, string | undefined>): { url: string; init: RequestInit };
}

/**
 * US locale is pinned on every client so `currency` stays `USD`. A response
 * in another currency fails the rung rather than posting a number the roll-up
 * would add to dollars.
 */
export const API_VENDORS: ApiVendor[] = [
	{
		id: 'digikey',
		env: ['DIGIKEY_CLIENT_ID', 'DIGIKEY_ACCESS_TOKEN'],
		request: (mpn, env) => ({
			url: 'https://api.digikey.com/products/v4/search/keyword',
			init: {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${env.DIGIKEY_ACCESS_TOKEN}`,
					'X-DIGIKEY-Client-Id': env.DIGIKEY_CLIENT_ID ?? '',
					'X-DIGIKEY-Locale-Site': 'US',
					'X-DIGIKEY-Locale-Language': 'en',
					'X-DIGIKEY-Locale-Currency': 'USD'
				},
				body: JSON.stringify({ Keywords: mpn, Limit: 10 })
			}
		})
	},
	{
		id: 'mouser',
		env: ['MOUSER_API_KEY'],
		request: (mpn, env) => ({
			url: `https://api.mouser.com/api/v1/search/partnumber?apiKey=${encodeURIComponent(env.MOUSER_API_KEY ?? '')}`,
			init: {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					SearchByPartRequest: { mouserPartNumber: mpn, partSearchOptions: 'Exact' }
				})
			}
		})
	},
	{
		id: 'arrow',
		env: ['ARROW_LOGIN', 'ARROW_API_KEY'],
		request: (mpn, env) => {
			const query = new URLSearchParams({
				login: env.ARROW_LOGIN ?? '',
				apikey: env.ARROW_API_KEY ?? '',
				search_token: mpn,
				country: 'US',
				currency: 'USD'
			});
			return {
				url: `https://api.arrow.com/itemservice/v4/en/search/token?${query.toString()}&resources[]=pricing`,
				init: { method: 'GET', headers: { accept: 'application/json' } }
			};
		}
	}
];

export function apiVendor(vendorId: string): ApiVendor | null {
	return API_VENDORS.find((vendor) => vendor.id === vendorId) ?? null;
}

/** Every offer whose manufacturer part number is exactly the item's. */
function exactHits(offers: Offer[], mpn: string): Offer[] {
	return offers.filter((offer) => sameMpn(offer.mpn, mpn));
}

/**
 * Try the API rung for one (item, vendor). Per the advise pin, this posts
 * only on an exact manufacturer-part-number match: a null `mpn` skips the
 * rung, and a fuzzy hit is a failed fetch, not a row. A near-miss part posted
 * as `api` would out-rank the correct price in the roll-up, which is worse
 * than no row at all.
 */
export async function apiRung(
	item: ItemRef,
	vendorId: string,
	deps: RungDeps,
	qty = 1
): Promise<RungOutcome> {
	const vendor = apiVendor(vendorId);
	if (!vendor)
		return { ok: false, reason: `${vendorId} has no day-one API; start at the crawl rung` };
	if (!item.mpn)
		return { ok: false, reason: `${item.sku} has no mpn; the API rung does not apply` };

	const missing = vendor.env.filter((name) => !deps.env[name]);
	if (missing.length) {
		return { ok: false, reason: `${vendorId} API keys unset (${missing.join(', ')}); next rung` };
	}

	const { url, init } = vendor.request(item.mpn, deps.env);
	let response: Response;
	try {
		response = await deps.fetch(url, init);
	} catch (error) {
		return { ok: false, reason: `${vendorId} API request failed: ${(error as Error).message}` };
	}
	if (!response.ok) {
		return { ok: false, reason: `${vendorId} API answered ${response.status}` };
	}

	let json: unknown;
	try {
		json = await response.json();
	} catch {
		return { ok: false, reason: `${vendorId} API answered a body that is not JSON` };
	}

	const offers = offersFrom(json);
	const hits = exactHits(offers, item.mpn);
	if (hits.length === 0) {
		const near = offers
			.map((offer) => offer.mpn)
			.filter(Boolean)
			.slice(0, 5);
		return {
			ok: false,
			reason: `${vendorId} returned no exact match for ${item.mpn}${near.length ? ` (saw ${near.join(', ')})` : ''}`
		};
	}

	for (const hit of hits) {
		const tier = unitAtQty(hit.breaks, qty);
		if (!tier) continue;
		if (hit.currency !== 'USD') {
			return { ok: false, reason: `${vendorId} priced ${item.mpn} in ${hit.currency}, not USD` };
		}
		return {
			ok: true,
			method: 'api',
			priceCents: tier.unitPriceCents,
			currency: 'USD',
			url: hit.url,
			inStock: hit.inStock,
			notes: `${vendorId} API, exact mpn ${hit.mpn}; ${tierNote(tier, qty)}`
		};
	}
	return { ok: false, reason: `${vendorId} matched ${item.mpn} but published no price break` };
}
