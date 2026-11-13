import { eq, inArray } from 'drizzle-orm';
import { HttpError, isLeaf, type Db } from './bom';
import { bomLines, items, projects, type Item, type Project, type Quote } from './db';

type Member = Item & { quotes: Quote[] };

const byName = (a: { name: string }, b: { name: string }) =>
	a.name.localeCompare(b.name, undefined, { numeric: true });

/**
 * A project's variants are its built kits that no other member consumes —
 * the configurations you ship. `edgebox-8gb` is a variant; `edgebox-core`
 * (consumed by every variant) and a bought bundle are shared members.
 */
export function splitMembers(members: Member[], consumed: Set<string>) {
	const variants: Member[] = [];
	const shared: Member[] = [];
	for (const m of members) {
		const variant = m.kind === 'kit' && !isLeaf(m) && !consumed.has(m.sku);
		(variant ? variants : shared).push(m);
	}
	return { variants: variants.sort(byName), shared: shared.sort(byName) };
}

export async function projectView(db: Db, project: Project) {
	const members = await db.query.items.findMany({
		where: eq(items.project, project.slug),
		with: { quotes: true }
	});
	const skus = members.map((m) => m.sku);
	const lines = skus.length
		? await db
				.select({ childSku: bomLines.childSku })
				.from(bomLines)
				.where(inArray(bomLines.parentSku, skus))
		: [];
	const consumed = new Set(lines.map((l) => l.childSku));
	return { ...project, ...splitMembers(members, consumed) };
}

export async function getProjectOrThrow(db: Db, slug: string) {
	const row = await db.query.projects.findFirst({ where: eq(projects.slug, slug) });
	if (!row) throw new HttpError(404, `Project ${slug} not found`);
	return row;
}

/** An item may only name a project that exists. */
export async function assertProject(db: Db, slug: string | null | undefined) {
	if (slug == null) return;
	const row = await db.query.projects.findFirst({ where: eq(projects.slug, slug) });
	if (!row) throw new HttpError(422, `Project ${slug} does not exist; POST /projects first`);
}
