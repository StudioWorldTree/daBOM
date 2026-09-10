/**
 * The ladder: API, then crawl, then headed. One SKU per call.
 *
 * The posted `method` is the rung that actually produced the price. A crawl
 * result posted as `api` would corrupt roll-up rank, which is the only thing
 * `method` is for. A rung that fails is not a quote: the ladder moves down,
 * and if every rung fails nothing is posted and the answer is a headed
 * session so a human can sign in.
 */

import { apiRung, apiVendor, type Fetcher, type ItemRef, type RungOutcome } from './api';
import { crawlRung } from './crawl';
import {
	fetchDate,
	getItem,
	latestQuoteUrl,
	listQuotes,
	postQuote,
	vendorDomain,
	type DabomClient,
	type QuotePost,
	type QuoteRow
} from './dabom';

export interface LadderDeps {
	fetch: Fetcher;
	env: Record<string, string | undefined>;
	/** Fetch time, injected so a test does not depend on the wall clock. */
	now?: Date;
	/** Walk the ladder and report the row, but do not POST it. */
	dryRun?: boolean;
}

export interface RungReport {
	rung: 'api' | 'crawl' | 'headed';
	ok: boolean;
	reason?: string;
}

export interface VendorResult {
	vendorId: string;
	/** The row the server wrote, or null when every rung failed. */
	posted: QuoteRow | null;
	/** The payload a successful rung produced. Set on a dry run too. */
	quote?: QuotePost;
	rungs: RungReport[];
	/** Set when the ladder ran out: the operator's next step. */
	next: 'headed' | null;
}

/**
 * Vendors that are places to buy a part. `print` is the resin printer and
 * `tbd` is a placeholder until a PO lands; neither has a page to price.
 */
const NOT_A_STOREFRONT = new Set(['print', 'tbd']);

/**
 * Which vendors to try for one item: the vendors it already has quotes for,
 * plus every API vendor once the item carries an MPN. The exact-MPN rule then
 * stops the ladder posting a Digi-Key quote for a part Digi-Key does not
 * carry.
 */
export function vendorsFor(rows: QuoteRow[], item: ItemRef): string[] {
	const seen = rows.filter((row) => row.itemSku === item.sku).map((row) => row.vendorId);
	const api = item.mpn ? ['digikey', 'mouser', 'arrow'] : [];
	return [...new Set([...seen, ...api])].filter((id) => !NOT_A_STOREFRONT.has(id));
}

/** Walk the ladder for one (item, vendor) and POST the first rung that prices it. */
export async function refreshVendor(
	client: DabomClient,
	item: ItemRef,
	vendorId: string,
	deps: LadderDeps,
	quotes?: QuoteRow[]
): Promise<VendorResult> {
	const rungs: RungReport[] = [];
	const rows = quotes ?? (await listQuotes(client));

	const attempts: (() => Promise<RungOutcome>)[] = [
		() => apiRung(item, vendorId, deps),
		async () => {
			const domain = await vendorDomain(client, vendorId);
			return crawlRung(deps, {
				startUrl: latestQuoteUrl(rows, item.sku, vendorId),
				searchQuery: [item.manufacturer, item.mpn].filter(Boolean).join(' ') || item.sku,
				domain,
				vendorId
			});
		}
	];
	const names: RungReport['rung'][] = ['api', 'crawl'];

	for (const [index, attempt] of attempts.entries()) {
		if (index === 0 && !apiVendor(vendorId)) {
			rungs.push({ rung: 'api', ok: false, reason: `${vendorId} has no day-one API` });
			continue;
		}
		const outcome = await attempt();
		if (!outcome.ok) {
			rungs.push({ rung: names[index], ok: false, reason: outcome.reason });
			continue;
		}
		rungs.push({ rung: outcome.method, ok: true });
		const quote: QuotePost = {
			itemSku: item.sku,
			vendorId,
			priceCents: outcome.priceCents,
			currency: outcome.currency,
			url: outcome.url,
			method: outcome.method,
			checkedAt: fetchDate(deps.now),
			inStock: outcome.inStock,
			notes: outcome.notes
		};
		if (deps.dryRun) return { vendorId, posted: null, quote, rungs, next: null };
		return { vendorId, posted: await postQuote(client, quote), quote, rungs, next: null };
	}

	// Nothing priced it unauthenticated. The headed rung is a human in a
	// browser, not a code path, so this returns without inserting a row.
	rungs.push({ rung: 'headed', ok: false, reason: 'needs a headed Playwright session' });
	return { vendorId, posted: null, rungs, next: 'headed' };
}

/** Refresh one SKU across the vendors that could price it. */
export async function refreshItem(
	client: DabomClient,
	sku: string,
	deps: LadderDeps
): Promise<{ item: ItemRef; results: VendorResult[] }> {
	const item = await getItem(client, sku);
	const rows = await listQuotes(client);
	const results: VendorResult[] = [];
	for (const vendorId of vendorsFor(rows, item)) {
		// One vendor failing or rate-limiting must not abort the rest.
		try {
			results.push(await refreshVendor(client, item, vendorId, deps, rows));
		} catch (error) {
			results.push({
				vendorId,
				posted: null,
				rungs: [{ rung: 'api', ok: false, reason: (error as Error).message }],
				next: 'headed'
			});
		}
	}
	return { item, results };
}
