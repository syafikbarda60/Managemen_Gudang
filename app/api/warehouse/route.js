import { getServices, databaseConfigured } from '../../server.mjs';

const respond = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const integer = (value, minimum) => Number.isInteger(value) && value >= minimum && value <= 2147483647;
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

async function access(request, run) {
  if (!databaseConfigured) return respond({ message: 'Database belum terhubung.' }, 503);
  try {
    const { auth, pool } = getServices();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return respond({ message: 'Masuk dahulu.' }, 401);
    const member = await pool.query('SELECT 1 FROM warehouse_members WHERE user_id = $1', [session.user.id]);
    if (!member.rowCount) return respond({ message: 'Akun memerlukan persetujuan admin gudang.' }, 403);
    return await run(pool);
  } catch (error) {
    if (['22007', '22008', '23503', '23514'].includes(error.code)) return respond({ message: 'Periksa kembali data yang dimasukkan.' }, 400);
    console.error('Operasi gudang gagal', error.code ?? error.name);
    return respond({ message: 'Layanan gudang tidak dapat memproses permintaan.' }, 500);
  }
}

export function GET(request) {
  return access(request, async pool => {
    // shortcut: return the full history for this warehouse, paginate as transaction volume grows.
    const [products, withdrawals, receipts, counts] = await Promise.all([
      pool.query('SELECT * FROM products ORDER BY name, id'),
      pool.query('SELECT id, product_id, operator, taken_date::text, taken_time::text, quantity, note FROM withdrawals ORDER BY taken_date DESC, taken_time DESC, id'),
      pool.query('SELECT id, product_id, operator, received_date::text AS taken_date, received_time::text AS taken_time, quantity, note FROM receipts ORDER BY received_date DESC, received_time DESC, id'),
      pool.query('SELECT * FROM stock_counts ORDER BY counted_at, id'),
    ]);
    return respond({ products: products.rows, withdrawals: withdrawals.rows, receipts: receipts.rows, counts: counts.rows });
  });
}

export function POST(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const local = !process.env.VERCEL && /^(localhost|127\.0\.0\.1):\d+$/.test(host ?? '');
  const allowedOrigins = [
    ...(local ? ['http://' + host] : []),
    ...(process.env.BETTER_AUTH_URL ? [new URL(process.env.BETTER_AUTH_URL).origin] : []),
    ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL].filter(Boolean).map(host => 'https://' + host),
  ];
  if (!allowedOrigins.includes(origin) || !request.headers.get('content-type')?.startsWith('application/json')) {
    return respond({ message: 'Permintaan tidak valid.' }, 403);
  }
  return access(request, async pool => {
    const payload = await request.json().catch(() => null);
    const row = payload?.row;
    if (!row || typeof row !== 'object') return respond({ message: 'Data transaksi tidak valid.' }, 400);

    switch (payload.type) {
      case 'take':
      case 'receive': {
        if (!uuid(row.product_id) || !text(row.operator, 100) || !integer(row.quantity, 1) ||
            typeof row.taken_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.taken_date) ||
            typeof row.taken_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.taken_time) ||
            typeof row.note !== 'string' || row.note.length > 300) {
          return respond({ message: 'Periksa barang, penginput, waktu, dan jumlah.' }, 400);
        }
        const statement = payload.type === 'receive'
          ? 'INSERT INTO receipts (product_id, operator, received_date, received_time, quantity, note) VALUES ($1,$2,$3,$4,$5,$6)'
          : 'INSERT INTO withdrawals (product_id, operator, taken_date, taken_time, quantity, note) VALUES ($1,$2,$3,$4,$5,$6)';
        await pool.query(statement, [row.product_id, row.operator.trim(), row.taken_date, row.taken_time, row.quantity, row.note]);
        break;
      }
      case 'count': {
        if (!uuid(row.id) || !integer(row.stock, 0)) return respond({ message: 'Jumlah stok tidak valid.' }, 400);
        const result = await pool.query('UPDATE products SET stock = $1 WHERE id = $2', [row.stock, row.id]);
        if (!result.rowCount) return respond({ message: 'Barang tidak ditemukan.' }, 404);
        break;
      }
      case 'product': {
        if (!text(row.name, 120) || !text(row.category, 80) || !text(row.unit, 30) || !integer(row.minimum, 0)) {
          return respond({ message: 'Periksa nama, jenis, satuan, dan batas stok.' }, 400);
        }
        if (row.photo !== null) {
          if (!text(row.photo, 2048) || URL.parse(row.photo)?.protocol !== 'https:') {
            return respond({ message: 'Gunakan URL foto HTTPS.' }, 400);
          }
        }
        await pool.query('INSERT INTO products (name,category,unit,photo,minimum) VALUES ($1,$2,$3,$4,$5)',
          [row.name.trim(), row.category.trim(), row.unit.trim(), row.photo, row.minimum]);
        break;
      }
      default:
        return respond({ message: 'Jenis tindakan tidak valid.' }, 400);
    }
    return respond({ saved: true }, 201);
  });
}
