import { Hono } from 'hono';
import { ready } from '../db';
import { createApi } from './app';

export { createApi } from './app';

let cached: Promise<Hono> | undefined;

export function getRootApp() {
	if (!cached) {
		cached = ready().then((db) => {
			const root = new Hono();
			root.route('/api/v1', createApi(db));
			return root;
		});
	}
	return cached;
}
