import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	ssr: {
		external: ['@electric-sql/pglite']
	},
	optimizeDeps: {
		exclude: ['@electric-sql/pglite']
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				// Repo skills are agent surfaces, not app code. Their tests live
				// beside them under `skills/`, never under `src/`.
				extends: './vite.config.ts',
				test: {
					name: 'skills',
					environment: 'node',
					include: ['skills/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
