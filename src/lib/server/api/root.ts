import { Hono } from 'hono';
import type { OpenAPIHono } from '@hono/zod-openapi';

/** Well-known catalog (RFC 9727) pointing at the versioned OpenAPI document. */
export const API_CATALOG = {
	linkset: [
		{
			anchor: '/api/v1',
			describedby: [
				{
					href: '/.well-known/openapi.json',
					type: 'application/vnd.oai.openapi+json;version=3.1'
				},
				{
					href: '/api/v1/openapi.json',
					type: 'application/vnd.oai.openapi+json;version=3.1'
				}
			]
		}
	]
};

/**
 * HTTP surface: versioned API under `/api/v1` plus well-known discovery.
 * The spec at `/.well-known/openapi.json` is the same document as `/api/v1/openapi.json`.
 */
export function createRoot(api: OpenAPIHono) {
	const root = new Hono();

	root.route('/api/v1', api);

	root.get('/.well-known/openapi.json', () => api.request('/openapi.json'));
	root.get('/.well-known/api-catalog', (c) =>
		c.json(API_CATALOG, 200, {
			'content-type': 'application/linkset+json'
		})
	);

	return root;
}
