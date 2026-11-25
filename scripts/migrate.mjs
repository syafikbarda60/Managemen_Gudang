import { readFile } from 'node:fs/promises';
import { getMigrations } from 'better-auth/db/migration';
import { getServices } from '../app/server.mjs';

process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const { auth, pool } = getServices();
try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  await pool.query(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  console.log('Skema akun dan inventaris siap.');
} finally {
  await pool.end();
}
