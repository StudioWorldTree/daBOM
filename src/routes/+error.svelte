<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — daBOM</title>
</svelte:head>

<div class="shell page">
	<p class="sku">{page.status}</p>
	<h1>{page.error?.message ?? 'Lost in the crib'}</h1>
	<p><a href="/">Back to the crib</a></p>
</div>

<style>
	.page {
		padding: 3rem 0;
	}
	h1 {
		font-size: 2rem;
		letter-spacing: -0.03em;
	}
</style>
