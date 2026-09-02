<script lang="ts">
	import { grams, money, watts } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>daBOM — crib</title>
</svelte:head>

<div class="shell page">
	<p class="kicker">Parts crib · local PGLite</p>
	<h1>Every item has a BOM.</h1>
	<p class="lede">
		Kits, assemblies, and leaves for the All Systems Go camera. The GitHub Pages notebook is not
		this. Drive it from
		<a href="/api/v1/docs">the REST API</a>
		— OpenAPI at
		<code>/api/v1/openapi.json</code>.
	</p>

	<div class="meta">
		<span class="tag">{data.itemCount} SKUs</span>
		<span class="tag">{data.cards.length} kits</span>
		<span class="tag">file: data/dabom</span>
	</div>

	<section class="grid">
		{#each data.cards as card (card.kit.sku)}
			<a class="traveler kit" href="/items/{card.kit.sku}">
				<div class="sku">{card.kit.sku}</div>
				<h2>{card.kit.name}</h2>
				<p>{card.kit.description}</p>
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
		{/each}
	</section>
</div>

<style>
	.page {
		padding: 2rem 0 3rem;
	}

	.kicker {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--stamp);
		margin: 0 0 0.4rem;
	}

	h1 {
		font-size: clamp(2rem, 5vw, 3.2rem);
		letter-spacing: -0.04em;
		margin: 0 0 0.75rem;
		max-width: 14ch;
		line-height: 1.05;
	}

	.lede {
		max-width: 42rem;
		color: var(--ink-2);
		margin: 0 0 1.25rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1.5rem;
	}

	.grid {
		display: grid;
		gap: 1rem;
	}

	.kit {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.kit h2 {
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
