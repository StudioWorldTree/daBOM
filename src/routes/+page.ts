import type { Item, Project, Rollup } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [projectsRes, kitsRes] = await Promise.all([
		fetch('/api/v1/projects'),
		fetch('/api/v1/kits')
	]);
	if (!projectsRes.ok) throw new Error(`projects ${projectsRes.status}`);
	if (!kitsRes.ok) throw new Error(`kits ${kitsRes.status}`);
	const { projects } = (await projectsRes.json()) as { projects: Project[] };
	const kits = ((await kitsRes.json()) as { items: Item[] }).items;

	// Built kits outside every project. Bought kits (bundles) are parts, not
	// things this crib assembles, so they stay off the board.
	const loose = kits.filter((kit) => kit.project == null && kit.floor === 'assemble');

	const toRoll = [...projects.flatMap((p) => p.variants), ...loose];
	const rollups = new Map<string, Rollup | null>(
		await Promise.all(
			toRoll.map(async (kit) => {
				const r = await fetch(`/api/v1/items/${kit.sku}/rollup`);
				return [kit.sku, r.ok ? ((await r.json()) as Rollup) : null] as const;
			})
		)
	);

	return {
		projects: projects.map((p) => ({
			...p,
			cards: p.variants.map((kit) => ({ kit, rollup: rollups.get(kit.sku) ?? null }))
		})),
		loose: loose.map((kit) => ({ kit, rollup: rollups.get(kit.sku) ?? null }))
	};
};
