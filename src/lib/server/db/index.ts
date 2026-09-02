import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import * as schema from './schema';
import { seed } from './seed';
import type { DabomDb } from './seed';

export type { DabomDb };
export * from './schema';

const DATA_DIR = process.env.DABOM_PGDATA ?? path.resolve(process.cwd(), 'data/dabom');
const MIGRATIONS = path.resolve(process.cwd(), 'drizzle');

type Cache = {
	client?: PGlite;
	db?: DabomDb;
	ready?: Promise<DabomDb>;
};

const g = globalThis as typeof globalThis & { __dabom: Cache };
g.__dabom ??= {};

export function createDb(client: PGlite): DabomDb {
	return drizzle(client, { schema });
}

export async function openDb(opts: { dataDir?: string; migrateFolder?: string; seed?: boolean } = {}) {
	const client = new PGlite(opts.dataDir ?? DATA_DIR);
	const db = createDb(client);
	if (opts.migrateFolder !== '') {
		await migrate(db, { migrationsFolder: opts.migrateFolder ?? MIGRATIONS });
	}
	if (opts.seed !== false) {
		await seed(db, { force: process.env.DABOM_RESEED === '1' });
	}
	return { client, db };
}

export async function ready(): Promise<DabomDb> {
	const cache = g.__dabom;
	if (!cache.ready) {
		cache.ready = openDb().then(({ client, db }) => {
			cache.client = client;
			cache.db = db;
			return db;
		});
	}
	return cache.ready;
}

export async function getDb(): Promise<DabomDb> {
	return ready();
}
