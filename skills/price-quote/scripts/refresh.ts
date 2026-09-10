#!/usr/bin/env -S npx tsx
/**
 * Walk the ladder for one SKU and POST what it priced.
 *
 *   DABOM_API_BASE=http://localhost:5173/api/v1 \
 *     npx tsx skills/price-quote/scripts/refresh.ts t4000-som --vendor arrow
 *
 * Keys come from the environment: DIGIKEY_CLIENT_ID / DIGIKEY_ACCESS_TOKEN,
 * MOUSER_API_KEY, ARROW_LOGIN / ARROW_API_KEY, FIRECRAWL_API_KEY. A vendor
 * whose keys are unset simply starts a rung lower. Never commit a key.
 *
 * `--dry-run` walks every rung and prints the row without writing it.
 */
import { getItem, listQuotes, type DabomClient } from '../lib/dabom';
import { refreshItem, refreshVendor, type VendorResult } from '../lib/ladder';

const args = process.argv.slice(2);
const sku = args.find((arg) => !arg.startsWith('-'));
if (!sku) {
	console.error('usage: refresh.ts <sku> [--vendor <id>] [--dry-run]');
	process.exit(2);
}
const vendorFlag = args.indexOf('--vendor');
const vendorId = vendorFlag === -1 ? null : args[vendorFlag + 1];

const client: DabomClient = {
	base: process.env.DABOM_API_BASE ?? 'http://localhost:5173/api/v1',
	fetch: (url, init) => fetch(url, init)
};
const deps = { fetch: client.fetch, env: process.env, dryRun: args.includes('--dry-run') };

function report(result: VendorResult): void {
	for (const rung of result.rungs) {
		console.log(
			`  ${rung.ok ? 'ok  ' : 'skip'} ${rung.rung}${rung.reason ? ` — ${rung.reason}` : ''}`
		);
	}
	if (result.posted) {
		console.log(
			`  wrote ${result.posted.method} ${result.posted.priceCents} ${result.posted.currency} ${result.posted.url ?? ''}`
		);
	} else if (result.quote) {
		console.log(`  would write ${JSON.stringify(result.quote)}`);
	} else {
		console.log('  no row. Next step: headed Playwright session, then post-quote.ts');
	}
}

if (vendorId) {
	const item = await getItem(client, sku);
	const rows = await listQuotes(client);
	console.log(`${sku} / ${vendorId}`);
	report(await refreshVendor(client, item, vendorId, deps, rows));
} else {
	const { results } = await refreshItem(client, sku, deps);
	for (const result of results) {
		console.log(`${sku} / ${result.vendorId}`);
		report(result);
	}
	if (results.every((result) => !result.posted && !result.quote)) process.exit(1);
}
