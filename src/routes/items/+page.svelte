<script lang="ts">
	import { goto } from '$app/navigation';
	import { money } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function preferredCents(item: (typeof data.items)[number]) {
		const q = item.quotes?.find((x) => x.isPreferred && x.priceCents != null) ?? item.quotes?.find((x) => x.priceCents != null);
		return q?.priceCents ?? null;
	}

	function onSubmit(e: Event) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const params = new URLSearchParams();
		for (const key of ['q', 'kind', 'status']) {
			const v = String(fd.get(key) ?? '');
			if (v) params.set(key, v);
		}
		goto(`/items?${params}`);
	}
</script>

<svelte:head>
	<title>Items — daBOM</title>
</svelte:head>

<div class="shell page">
	<h1>Catalog</h1>
	<p class="lede">{data.total} items. Leaves have empty BOMs. Assemblies and kits do not.</p>

	<form class="filters" onsubmit={onSubmit}>
		<label class="field">
			Search
			<input name="q" value={data.q} placeholder="sku, name, mpn" />
		</label>
		<label class="field">
			Kind
			<select name="kind">
				<option value="">any</option>
				{#each ['part', 'assembly', 'kit'] as k}
					<option value={k} selected={data.kind === k}>{k}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			Status
			<select name="status">
				<option value="">any</option>
				{#each ['preferred', 'candidate', 'placeholder', 'do-not-buy'] as s}
					<option value={s} selected={data.status === s}>{s}</option>
				{/each}
			</select>
		</label>
		<button class="btn" type="submit">Filter</button>
	</form>

	<div class="list">
		{#each data.items as item (item.sku)}
			<a class="traveler row" href="/items/{item.sku}">
				<div>
					<div class="sku">{item.sku}</div>
					<strong>{item.name}</strong>
					<div class="who">{item.manufacturer ?? ''} {item.mpn ?? ''}</div>
				</div>
				<div class="end">
					<span class="tag {item.status}">{item.status}</span>
					<span class="tag">{item.kind}</span>
					<span class="price">{money(preferredCents(item))}</span>
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	.page {
		padding: 2rem 0 3rem;
	}

	h1 {
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		letter-spacing: -0.03em;
		margin: 0 0 0.4rem;
	}

	.lede {
		color: var(--ink-2);
		margin: 0 0 1.2rem;
	}

	.filters {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 1.25rem;
	}

	.list {
		display: grid;
		gap: 0.65rem;
	}

	.row {
		text-decoration: none;
		color: inherit;
		display: grid;
		gap: 0.6rem;
	}

	.who {
		color: var(--ink-3);
		font-size: 0.85rem;
	}

	.end {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.price {
		margin-left: auto;
		font-family: var(--font-mono);
		font-weight: 600;
	}

	@media (min-width: 720px) {
		.filters {
			grid-template-columns: 2fr 1fr 1fr auto;
			align-items: end;
		}
		.row {
			grid-template-columns: 1fr auto;
			align-items: center;
		}
	}
</style>
