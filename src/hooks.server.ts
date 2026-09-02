import { getRootApp } from '$lib/server/api';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/favicon.ico') {
		return new Response(null, { status: 302, headers: { location: '/favicon.svg' } });
	}
	if (event.url.pathname.startsWith('/api')) {
		const app = await getRootApp();
		return app.fetch(event.request);
	}
	return resolve(event);
};
