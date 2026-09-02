<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { grams, mm, money, watts } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let errorMsg = $state('');
	let pending = $state(false);

	async function addLine(e: Event) {
		e.preventDefault();
		errorMsg = '';
		pending = true;
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const body = {
			childSku: String(fd.get('childSku') ?? '').trim(),
			qty: Number(fd.get('qty') || 1),
			role: String(fd.get('role') ?? ''),
			optional: fd.get('optional') === 'on',
			notes: String(fd.get('notes') ?? '') || null
		};
		const res = await fetch(`/api/v1/items/${data.item.sku}/bom`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		pending = false;
		if (!res.ok) {
			const j = await res.json().catch(() => ({ error: res.statusText }));
			errorMsg = j.error ?? 'add failed';
			return;
		}
		(e.currentTarget as HTMLFormElement).reset();
		await invalidateAll();
	}

	async function removeLine(id: string) {
		errorMsg = '';
		const res = await fetch(`/api/v1/items/${data.item.sku}/bom/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			const j = await res.json().catch(() => ({ error: res.statusText }));
			errorMsg = j.error ?? 'delete failed';
			return;
		}
		await invalidateAll();
	}

	async function bumpQty(id: string, qty: number) {
		if (qty < 1) return;
		const res = await fetch(`/api/v1/items/${data.item.sku}/bom/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ qty })
		});
		if (!res.ok) return;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{data.item.sku} — daBOM</title>
</svelte:head>

<div class="shell page">
	<p class="crumb"><a href="/items">Items</a> / {data.item.sku}</p>
	<div class="sku">{data.item.sku}</div>
	<h1>{data.item.name}</h1>
	<div class="tags">
		<span class="tag {data.item.status}">{data.item.status}</span>
		<span class="tag">{data.item.kind}</span>
		<span class="tag">{data.item.category}</span>
	</div>
	<p class="lede">{data.item.description}</p>
	{#if data.item.notes}
		<p class="notes">{data.item.notes}</p>
	{/if}

	<section class="stats">
		<div class="traveler">
			<h2>Roll-up</h2>
			<dl>
				<div>
					<dt>Required</dt>
					<dd>
						{money(data.rollup.requiredCents ?? data.rollup.knownRequiredCents)}
						{#if data.rollup.requiredCents == null}+ quote{/if}
					</dd>
				</div>
				<div>
					<dt>Optional</dt>
					<dd>{money(data.rollup.optionalCents ?? data.rollup.knownOptionalCents)}</dd>
				</div>
				<div>
					<dt>Mass</dt>
					<dd>{grams(data.rollup.massG ?? data.rollup.knownMassG)}</dd>
				</div>
				<div>
					<dt>Watts</dt>
					<dd>{watts(data.rollup.wattsTypical ?? data.rollup.knownWattsTypical)}</dd>
				</div>
				<div><dt>Parts</dt><dd>{data.rollup.partCount}</dd></div>
			</dl>
			{#if data.rollup.missingQuotes.length}
				<p class="miss">No street price: {data.rollup.missingQuotes.join(', ')}</p>
			{/if}
		</div>
		<div class="traveler">
			<h2>Envelope</h2>
			<dl>
				<div><dt>MPN</dt><dd>{data.item.mpn ?? '—'}</dd></div>
				<div><dt>Maker</dt><dd>{data.item.manufacturer ?? '—'}</dd></div>
				<div>
					<dt>Size</dt>
					<dd>
						{data.item.widthMm || data.item.heightMm || data.item.depthMm
							? `${mm(data.item.widthMm)} × ${mm(data.item.heightMm)} × ${mm(data.item.depthMm)}`
							: '—'}
					</dd>
				</div>
				<div><dt>Self mass</dt><dd>{grams(data.item.massG)}</dd></div>
				<div>
					<dt>Self watts</dt>
					<dd>{watts(data.item.wattsTypical)} / max {watts(data.item.wattsMax)}</dd>
				</div>
			</dl>
		</div>
	</section>

	<section>
		<div class="head">
			<h2>BOM · {data.bom.lineCount} line{data.bom.lineCount === 1 ? '' : 's'}</h2>
			<a
				class="btn ghost"
				href="/items/{data.item.sku}{data.explode ? '' : '?explode=true'}"
			>
				{data.explode ? 'One level' : 'Explode'}
			</a>
		</div>
		{#if data.bom.lines.length === 0}
			<p class="empty">Leaf. Empty BOM, as required.</p>
		{:else}
			<div class="table-wrap">
				<table class="bom">
					<thead>
						<tr>
							<th>Qty</th>
							<th>Child</th>
							<th>Role</th>
							<th>Ext</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.bom.lines as line (line.id)}
							<tr>
								<td>
									{#if data.explode}
										{line.qtyRollup ?? line.qty}
									{:else}
										<button class="qty" type="button" onclick={() => bumpQty(line.id, line.qty - 1)}>-</button>
										{line.qty}
										<button class="qty" type="button" onclick={() => bumpQty(line.id, line.qty + 1)}>+</button>
									{/if}
									<span class="unit">{line.unit}</span>
								</td>
								<td>
									<a href="/items/{line.childSku}">{line.child.name}</a>
									<div class="sku">{line.childSku}</div>
									{#if line.optional}<span class="tag">optional</span>{/if}
								</td>
								<td>{line.role || '—'}</td>
								<td>{money(line.extendedCents)}</td>
								<td>
									{#if !data.explode}
										<button class="btn ghost" type="button" onclick={() => removeLine(line.id)}>Drop</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if !data.explode}
			<form class="add traveler" onsubmit={addLine}>
				<h3>Add line</h3>
				<div class="grid">
					<label class="field">
						Child SKU
						<input name="childSku" list="sku-list" required placeholder="t4000-som" />
					</label>
					<label class="field">
						Qty
						<input name="qty" type="number" min="1" value="1" />
					</label>
					<label class="field">
						Role
						<input name="role" placeholder="carrier" />
					</label>
					<label class="field check">
						Optional
						<input name="optional" type="checkbox" />
					</label>
				</div>
				<label class="field">
					Notes
					<input name="notes" />
				</label>
				<button class="btn" type="submit" disabled={pending}>Add to BOM</button>
				{#if errorMsg}
					<p class="miss" role="alert">{errorMsg}</p>
				{/if}
			</form>
			<datalist id="sku-list">
				{#each data.catalog as it (it.sku)}
					<option value={it.sku}>{it.name}</option>
				{/each}
			</datalist>
		{/if}
	</section>

	<section>
		<h2>Where used</h2>
		{#if data.used.usedIn.length === 0}
			<p class="empty">Not on any parent BOM.</p>
		{:else}
			<ul>
				{#each data.used.usedIn as u (u.id)}
					<li>
						<a href="/items/{u.parentSku}">{u.parentName}</a>
						<span class="sku">{u.parentSku}</span>
						× {u.qty}
						{#if u.role} · {u.role}{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.item.quotes && data.item.quotes.length}
		<section>
			<h2>Quotes</h2>
			<ul>
				{#each data.item.quotes as q (q.id)}
					<li>
						<strong>{money(q.priceCents, q.currency)}</strong>
						· {q.vendorId}
						{#if q.isPreferred} · preferred{/if}
						{#if q.checkedAt} · {q.checkedAt}{/if}
						{#if q.notes}
							<div class="who">{q.notes}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.page {
		padding: 2rem 0 3rem;
	}

	.crumb {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-3);
		margin: 0 0 0.4rem;
	}

	h1 {
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		letter-spacing: -0.03em;
		margin: 0.15rem 0 0.5rem;
		max-width: 22ch;
		line-height: 1.1;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.8rem;
	}

	.lede,
	.notes {
		max-width: 42rem;
		color: var(--ink-2);
	}

	.stats {
		display: grid;
		gap: 1rem;
		margin: 1.5rem 0;
	}

	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.6rem;
	}

	h3 {
		font-size: 0.95rem;
		margin: 0 0 0.7rem;
	}

	dl {
		display: grid;
		gap: 0.45rem;
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

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 1.5rem 0 0.6rem;
	}

	.empty {
		color: var(--ink-3);
		font-style: italic;
	}

	.table-wrap {
		overflow-x: auto;
		background: var(--paper-2);
		border: 1px solid var(--rule);
	}

	.unit {
		color: var(--ink-3);
		font-size: 0.75rem;
	}

	.qty {
		width: 2rem;
		height: 2rem;
		min-height: 2rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
	}

	.add {
		margin-top: 1rem;
	}

	.grid {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}

	.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		padding-top: 1.4rem;
	}

	.check input {
		width: 1.2rem;
		min-height: 1.2rem;
	}

	.miss {
		color: var(--stamp);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	ul {
		padding-left: 1.1rem;
	}

	li {
		margin: 0.35rem 0;
	}

	.who {
		color: var(--ink-3);
		font-size: 0.85rem;
	}

	@media (min-width: 800px) {
		.stats {
			grid-template-columns: 1fr 1fr;
		}
		.grid {
			grid-template-columns: 2fr 0.7fr 1fr auto;
		}
	}
</style>
