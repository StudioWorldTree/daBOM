#!/usr/bin/env -S npx tsx
/**
 * The bottom rung's write. After a human signs in with the Playwright MCP and
 * reads the price off the page, this posts it as method `headed`.
 *
 *   DABOM_API_BASE=http://localhost:5173/api/v1 \
 *     npx tsx skills/price-quote/scripts/post-quote.ts \
 *       --sku t4000-som --vendor cti --cents 249900 \
 *       --url https://connecttech.com/... --notes 'headed, signed in'
 *
 * `--method` defaults to `headed` and accepts `crawl` for a page an agent
 * read itself. It does not accept `manual` or `seed`: those are a human
 * correcting the crib, not this skill.
 */
import { fetchDate, postQuote, type DabomClient } from '../lib/dabom';

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
	const at = args.indexOf(`--${name}`);
	return at === -1 ? undefined : args[at + 1];
}

const sku = flag('sku');
const vendorId = flag('vendor');
const cents = Number(flag('cents'));
const method = flag('method') ?? 'headed';
if (!sku || !vendorId || !Number.isInteger(cents) || cents <= 0) {
	console.error(
		'usage: post-quote.ts --sku <sku> --vendor <id> --cents <int> [--url u] [--notes n] [--method headed|crawl]'
	);
	process.exit(2);
}
if (method !== 'headed' && method !== 'crawl') {
	console.error(`method ${method} is not a rung of this ladder; use headed or crawl`);
	process.exit(2);
}

const client: DabomClient = {
	base: process.env.DABOM_API_BASE ?? 'http://localhost:5173/api/v1',
	fetch: (url, init) => fetch(url, init)
};

const row = await postQuote(client, {
	itemSku: sku,
	vendorId,
	priceCents: cents,
	currency: 'USD',
	url: flag('url') ?? null,
	method,
	checkedAt: flag('checked-at') ?? fetchDate(),
	notes: flag('notes') ?? `${method} session`
});
console.log(JSON.stringify(row, null, 2));
