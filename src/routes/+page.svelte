<script lang="ts">
	import { grams, money, watts } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Projects — daBOM</title>
</svelte:head>

{#snippet kitCard(card: (typeof data.loose)[number])}
	<article class="traveler kit">
		<a class="kit-link" href="/items/{card.kit.sku}">
			<div class="sku">{card.kit.sku}</div>
			<h3>{card.kit.name}</h3>
			{#if card.kit.description}<p>{card.kit.description}</p>{/if}
			<dl>
				<div>
					<dt>Required</dt>
					<dd>
						{money(card.rollup?.requiredCents ?? card.rollup?.knownRequiredCents)}
						{#if card.rollup?.requiredCents == null && card.rollup?.knownRequiredCents}
							<span class="partial">+ quote</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt>Optional</dt>
					<dd>{money(card.rollup?.optionalCents)}</dd>
				</div>
				<div>
					<dt>Mass</dt>
					<dd>{grams(card.rollup?.massG ?? card.rollup?.knownMassG)}</dd>
				</div>
				<div>
					<dt>Watts</dt>
					<dd>{watts(card.rollup?.wattsTypical ?? card.rollup?.knownWattsTypical)}</dd>
				</div>
			</dl>
			{#if card.rollup?.missingQuotes.length}
				<p class="miss">Missing quotes: {card.rollup.missingQuotes.join(', ')}</p>
			{/if}
		</a>
		<a class="btn ghost csv" href="/api/v1/items/{card.kit.sku}/bom.csv">CSV</a>
	</article>
{/snippet}

<div class="shell page">
	<h1>Projects</h1>

	{#each data.projects as project (project.slug)}
		<section class="project" aria-labelledby="p-{project.slug}">
			<header class="project-head">
				<h2 id="p-{project.slug}">{project.name}</h2>
				<span class="tag">{project.variants.length} variants</span>
			</header>
			{#if project.description}<p class="desc">{project.description}</p>{/if}
			{#if project.cards.length}
				<div class="grid">
					{#each project.cards as card (card.kit.sku)}
						{@render kitCard(card)}
					{/each}
				</div>
			{:else}
				<p class="desc">No variants yet. Give a kit <code>project: "{project.slug}"</code>.</p>
			{/if}
			{#if project.shared.length}
				<p class="shared">
					Shared:
					{#each project.shared as item, i (item.sku)}<a href="/items/{item.sku}">{item.sku}</a>{i <
						project.shared.length - 1
							? ', '
							: ''}{/each}
				</p>
			{/if}
		</section>
	{/each}

	{#if data.loose.length}
		<section class="project" aria-labelledby="p-unassigned">
			<header class="project-head">
				<h2 id="p-unassigned">Unassigned kits</h2>
			</header>
			<div class="grid">
				{#each data.loose as card (card.kit.sku)}
					{@render kitCard(card)}
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		padding: 2rem 0 3rem;
	}

	h1 {
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		letter-spacing: -0.03em;
		margin: 0 0 1.5rem;
		line-height: 1.1;
	}

	.project {
		margin-bottom: 2.25rem;
	}

	.project-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.4rem;
		margin-bottom: 0.75rem;
	}

	.project-head h2 {
		font-size: 1.25rem;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.desc {
		color: var(--ink-2);
		margin: 0 0 1rem;
		font-size: 0.92rem;
	}

	.shared {
		margin: 0.9rem 0 0;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-3);
	}

	.grid {
		display: grid;
		gap: 1rem;
	}

	.kit-link {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.csv {
		display: inline-flex;
		align-items: center;
		margin-top: 0.9rem;
		text-decoration: none;
	}

	.kit h3 {
		font-size: 1.2rem;
		letter-spacing: -0.02em;
		margin: 0.2rem 0 0.4rem;
	}

	.kit p {
		color: var(--ink-2);
		margin: 0 0 0.8rem;
		font-size: 0.92rem;
	}

	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem 1rem;
		margin: 0;
	}

	dt {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	dd {
		margin: 0;
		font-weight: 600;
	}

	.miss {
		margin-top: 0.8rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--stamp);
	}

	.partial {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 400;
		color: var(--ink-3);
		margin-left: 0.25rem;
	}

	@media (min-width: 900px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
