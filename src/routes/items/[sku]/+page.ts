import { error } from '@sveltejs/kit';
import type { Bom, Item, Rollup, WhereUsed } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
	const explode = url.searchParams.get('explode') === 'true';
	const [itemRes, bomRes, usedRes, rollRes, catalogRes] = await Promise.all([
		fetch(`/api/v1/items/${params.sku}`),
		fetch(`/api/v1/items/${params.sku}/bom${explode ? '?explode=true' : ''}`),
		fetch(`/api/v1/items/${params.sku}/where-used`),
		fetch(`/api/v1/items/${params.sku}/rollup`),
		fetch('/api/v1/items')
	]);
	if (itemRes.status === 404) error(404, 'SKU not in the crib');
	if (!itemRes.ok) error(itemRes.status, 'item fetch failed');
	const item = (await itemRes.json()) as Item;
	const bom = (await bomRes.json()) as Bom;
	const used = (await usedRes.json()) as WhereUsed;
	const rollup = (await rollRes.json()) as Rollup;
	const catalog = catalogRes.ok ? ((await catalogRes.json()) as { items: Item[] }).items : [];
	return { item, bom, used, rollup, catalog, explode };
};
