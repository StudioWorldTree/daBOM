import type { Item, Rollup } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const kitsRes = await fetch('/api/v1/kits');
	if (!kitsRes.ok) throw new Error(`kits ${kitsRes.status}`);
	const kitsJson = (await kitsRes.json()) as { items: Item[] };

	const rollups = await Promise.all(
		kitsJson.items.map(async (kit) => {
			const r = await fetch(`/api/v1/items/${kit.sku}/rollup`);
			const rollup = r.ok ? ((await r.json()) as Rollup) : null;
			return { kit, rollup };
		})
	);

	const itemsRes = await fetch('/api/v1/items');
	const itemsJson = itemsRes.ok ? ((await itemsRes.json()) as { total: number }) : { total: 0 };

	return { cards: rollups, itemCount: itemsJson.total };
};
