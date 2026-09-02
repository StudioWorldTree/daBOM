import type { Item } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const q = url.searchParams.get('q') ?? '';
	const kind = url.searchParams.get('kind') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const params = new URLSearchParams();
	if (q) params.set('q', q);
	if (kind) params.set('kind', kind);
	if (status) params.set('status', status);
	const res = await fetch(`/api/v1/items?${params}`);
	if (!res.ok) throw new Error(`items ${res.status}`);
	const json = (await res.json()) as { items: Item[]; total: number };
	return { ...json, q, kind, status };
};
