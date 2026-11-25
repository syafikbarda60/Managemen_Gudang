import { betterAuth } from 'better-auth';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';

export const databaseConfigured = Boolean(process.env.DATABASE_URL);

let services;

export function getServices() {
  if (services) return services;
  if (!databaseConfigured || !process.env.BETTER_AUTH_SECRET) {
    throw new Error('DATABASE_URL dan BETTER_AUTH_SECRET diperlukan.');
  }
  // Use the pooled Neon URL for concurrent Next.js requests.
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (databaseUrl.hostname.endsWith('.neon.tech')) databaseUrl.searchParams.set('sslmode', 'verify-full');
  const pool = new pg.Pool({ connectionString: databaseUrl.toString(), max: 5, connectionTimeoutMillis: 8000 });
  pool.on('error', () => console.error('Koneksi PostgreSQL terputus.'));
  if (process.env.VERCEL) attachDatabasePool(pool);
  const deploymentHosts = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL].filter(Boolean);
  const auth = betterAuth({
    database: pool,
    baseURL: process.env.BETTER_AUTH_URL || (deploymentHosts.length
      ? { allowedHosts: deploymentHosts, protocol: 'https' }
      : { allowedHosts: ['localhost:*', '127.0.0.1:*'], protocol: 'http' }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    rateLimit: { enabled: true, storage: 'database' },
  });
  services = { pool, auth };
  return services;
}
