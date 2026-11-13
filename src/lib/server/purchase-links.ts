import { and, eq } from 'drizzle-orm';
import { HttpError, type Db } from './bom';
import { purchaseLinks, vendors, type PurchaseLink } from './db';

/** Query params that track the visit, not the product. */
const TRACKING = /^(utm_.*|spm|scm|ref|ref_|gclid|fbclid|mc_cid|mc_eid|_ga|tag|psc|th)$/i;

/**
 * One spelling per product page, so the same listing pasted twice is one
 * link. Drops the fragment and tracking params; keeps params that pick the
 * product (`?variant=`, `?id=`).
 */
export function normalizeUrl(raw: string): string {
	let u: URL;
	try {
		u = new URL(raw.trim());
	} catch {
		throw new HttpError(422, `Not an absolute URL: ${raw}`);
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		throw new HttpError(422, `Purchase links are http(s) URLs: ${raw}`);
	}
	u.hash = '';
	for (const key of [...u.searchParams.keys()]) {
		if (TRACKING.test(key)) u.searchParams.delete(key);
	}
	return u.toString();
}

export function hostOf(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
	} catch {
		return null;
	}
}

export function purchaseLinkDto(row: PurchaseLink) {
	return {
		id: row.id,
		itemSku: row.itemSku,
		vendorId: row.vendorId,
		url: row.url,
		label: row.label,
		vendorSku: row.vendorSku,
		notes: row.notes,
		createdAt: row.createdAt.toISOString()
	};
}

export async function listPurchaseLinks(db: Db, itemSku: string) {
	return db
		.select()
		.from(purchaseLinks)
		.where(eq(purchaseLinks.itemSku, itemSku))
		.orderBy(purchaseLinks.vendorId, purchaseLinks.createdAt);
}

export async function findPurchaseLink(db: Db, itemSku: string, url: string) {
	const [row] = await db
		.select()
		.from(purchaseLinks)
		.where(and(eq(purchaseLinks.itemSku, itemSku), eq(purchaseLinks.url, url)));
	return row ?? null;
}

/**
 * Which vendor sells at this URL. The item's own purchase link wins; else
 * the one vendor whose home URL has the same host. A marketplace host
 * (alibaba.com, amazon.com) names no single seller, so it resolves only
 * through a purchase link someone recorded with a vendor.
 */
export async function resolveVendor(db: Db, itemSku: string, url: string) {
	const link = await findPurchaseLink(db, itemSku, url);
	if (link) return { vendorId: link.vendorId, via: 'purchase-link' as const };
	const host = hostOf(url);
	if (!host) return null;
	const rows = await db.select({ id: vendors.id, url: vendors.url }).from(vendors);
	const hits = rows.filter((v) => hostOf(v.url) === host);
	return hits.length === 1 ? { vendorId: hits[0].id, via: 'vendor-host' as const } : null;
}

/** Record a URL the item can be bought at; a URL already listed is left as it is. */
export async function rememberPurchaseLink(
	db: Db,
	row: { itemSku: string; vendorId: string; url: string }
) {
	await db.insert(purchaseLinks).values(row).onConflictDoNothing();
}
