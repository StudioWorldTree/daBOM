import { Hono } from 'hono';
import { ready } from '../db';
import { createApi } from './app';
import { createRoot } from './root';

export { createApi } from './app';
export { createRoot } from './root';

let cached: Promise<Hono> | undefined;

export function getRootApp() {
	if (!cached) {
		cached = ready().then((db) => createRoot(createApi(db)));
	}
	return cached;
}
