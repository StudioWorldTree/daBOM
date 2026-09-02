<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
	let open = $state(false);

	const links = [
		{ href: '/', label: 'Crib' },
		{ href: '/items', label: 'Items' },
		{ href: '/api/v1/docs', label: 'OpenAPI', external: true }
	];

	function active(href: string) {
		const here = page.url.pathname.replace(/\/$/, '') || '/';
		if (href === '/') return here === '/';
		return here === href || here.startsWith(href + '/');
	}

	function toggleTheme() {
		const root = document.documentElement;
		const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
		root.dataset.theme = next;
		localStorage.setItem('dabom-theme', next);
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="site">
	<div class="shell bar">
		<a class="mark" href="/">
			<span class="tally" aria-hidden="true"></span>
			<span class="name">daBOM</span>
			<span class="sub">All Systems Go</span>
		</a>
		<nav class="desk" aria-label="Primary">
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-current={!link.external && active(link.href) ? 'page' : undefined}
					>{link.label}</a
				>
			{/each}
		</nav>
		<div class="tools">
			<button type="button" class="btn ghost" onclick={toggleTheme}>Light / dark</button>
			<button
				type="button"
				class="btn ghost menu"
				aria-expanded={open}
				aria-controls="mobile-nav"
				onclick={() => (open = !open)}
			>
				{open ? 'Close' : 'Menu'}
			</button>
		</div>
	</div>
	{#if open}
		<nav id="mobile-nav" class="mobile" aria-label="Primary">
			{#each links as link (link.href)}
				<a href={link.href} onclick={() => (open = false)}>{link.label}</a>
			{/each}
		</nav>
	{/if}
</header>

<main>
	{@render children()}
</main>

<footer class="site-foot">
	<div class="shell">
		API is the source of truth ·
		<code>/api/v1/openapi.json</code>
		· PGLite file on disk · sister of AICamera docs
	</div>
</footer>

<style>
	.site {
		position: sticky;
		top: 0;
		z-index: 40;
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-height: 3.5rem;
	}

	.mark {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--ink);
	}

	.tally {
		width: 0.55rem;
		height: 0.55rem;
		background: var(--stamp);
		align-self: center;
	}

	.name {
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.sub {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.desk {
		display: none;
		gap: 1.2rem;
		margin-left: 0.5rem;
	}

	.desk a,
	.mobile a {
		text-decoration: none;
		color: var(--ink-2);
		font-size: 0.95rem;
	}

	.desk a[aria-current='page'] {
		color: var(--ink);
		box-shadow: inset 0 -2px 0 var(--stamp);
	}

	.tools {
		margin-left: auto;
		display: flex;
		gap: 0.4rem;
	}

	.mobile {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 1.25rem 1rem;
		border-top: 1px solid var(--rule);
	}

	.mobile a {
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--rule);
		min-height: 44px;
	}

	.site-foot {
		border-top: 1px solid var(--rule);
		padding: 1.25rem 0 2rem;
		color: var(--ink-3);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}

	@media (min-width: 768px) {
		.desk {
			display: flex;
		}
		.menu,
		.mobile {
			display: none;
		}
	}
</style>
