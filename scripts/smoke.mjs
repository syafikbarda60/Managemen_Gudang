import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getServices } from '../app/server.mjs';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3000').origin;
const { pool } = getServices();
const marker = 'uji-' + randomUUID();
const email = marker + '@example.com';
const password = randomUUID();
const cookies = new Map();

async function request(path, body, expected, origin = base) {
  const response = await fetch(base + '/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      Cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; '),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: JSON.stringify(body),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const divider = pair.indexOf('=');
    cookies.set(pair.slice(0, divider), pair.slice(divider + 1));
  }
  assert.equal(response.status, expected, path + ' → HTTP ' + response.status);
  return response.json();
}

try {
  await pool.query('SELECT 1');
  console.log('PostgreSQL: SELECT 1 berhasil.');
  assert.equal((await fetch(base)).status, 200);
  await request('warehouse', undefined, 401);
  const registered = await request('auth/sign-up/email', { email, password, name: 'Uji Ruang Stok' }, 200);
  assert.equal(registered.user.email, email);
  await request('warehouse', undefined, 200);
  await request('auth/sign-out', {}, 200);
  await request('auth/sign-in/email', { email, password }, 200);
  console.log('Akun: registrasi dengan akses langsung dan login lulus.');
  const product = { name: marker, unit: 'kg', category: marker, minimum: 5, photo: null };
  await request('warehouse', { type: 'product', row: product }, 403, 'https://example.org');
  await request('warehouse', { type: 'product', row: product }, 201);
  const catalog = await request('warehouse', undefined, 200);
  const added = catalog.products.find(row => row.name === marker);
  assert.ok(added?.id);
  const taken_date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const row = { product_id: added.id, operator: marker, quantity: 12, taken_date, taken_time: '09:00', note: 'Uji sementara' };
  await request('warehouse', { type: 'receive', row }, 201);
  await request('warehouse', { type: 'take', row: { ...row, quantity: 3 } }, 201);
  await request('warehouse', { type: 'count', row: { id: added.id, stock: 8 } }, 201);
  const data = await request('warehouse', undefined, 200);
  assert.equal(data.receipts.find(row => row.product_id === added.id)?.quantity, 12);
  assert.equal(data.withdrawals.find(row => row.product_id === added.id)?.quantity, 3);
  assert.equal(data.products.find(row => row.id === added.id)?.stock, 8);
  assert.equal(data.counts.find(row => row.product_id === added.id)?.quantity, 8);
  console.log('Gudang: katalog, penerimaan 12 kg, pengambilan 3 kg, dan riwayat stok 8 kg lulus.');
  await request('auth/sign-out', {}, 200);
  await request('warehouse', undefined, 401);
  console.log('Logout: data gudang kembali terkunci.');
} finally {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of ['stock_counts', 'receipts', 'withdrawals']) {
      await client.query('DELETE FROM ' + table + ' WHERE product_id IN (SELECT id FROM products WHERE name = $1 AND category = $1)', [marker]);
    }
    await client.query('DELETE FROM products WHERE name = $1 AND category = $1', [marker]);
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
    await client.query('COMMIT');
    console.log('Data uji sementara dibersihkan.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
