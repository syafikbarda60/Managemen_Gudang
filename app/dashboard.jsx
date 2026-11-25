'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpRight, Boxes, CalendarDays, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Package, Plus, Search, TriangleAlert, Warehouse, X } from 'lucide-react';
import { categoryActivity, stockStatus, usageTrend } from './inventory.mjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(result?.message ?? 'Layanan belum tersedia.'), { status: response.status });
  return result;
}
const number = new Intl.NumberFormat('id-ID');
const dateLabel = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const wibDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' });
const today = () => wibDate.format(new Date());
const hour = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const shift = (day, offset) => {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const categories = ['Makanan pokok', 'Susu enteral', 'Kemasan', 'Bumbu'];
const demoProducts = [
  { id: 'beras', name: 'Beras Putih', category: categories[0], unit: 'kg', stock: 125, minimum: 30, photo: '/produk/beras.webp' },
  { id: 'susu', name: 'Susu Enteral Vanila', category: categories[1], unit: 'kaleng', stock: 8, minimum: 10, photo: '/produk/susu.webp' },
  { id: 'gelas', name: 'Gelas Kertas 250 ml', category: categories[2], unit: 'pcs', stock: 240, minimum: 50, photo: '/produk/gelas.webp' },
  { id: 'garam', name: 'Garam Halus', category: categories[3], unit: 'bungkus', stock: 0, minimum: 5, photo: '/produk/garam.webp' },
];
const navigation = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'receipts', label: 'Barang Masuk', icon: ArrowDownToLine },
  { id: 'withdrawals', label: 'Pengambilan Barang', icon: ClipboardList },
  { id: 'stock', label: 'Stok Gudang', icon: Boxes },
];

function demoData(day) {
  const values = [8, 14, 11, 21, 16, 32, 25, 5, 8, 6, 8, 10, 9, 7];
  return {
    products: demoProducts,
    withdrawals: values.map((quantity, index) => ({
      id: String(index), product_id: 'beras', taken_date: shift(day, (index < 7 ? -6 : -13) + index % 7),
      taken_time: '08:30', quantity, operator: 'Dewi Lestari', note: 'Dapur utama',
    })).concat(demoProducts.slice(1).map((product, index) => ({
      id: 'sample-' + index, product_id: product.id, taken_date: shift(day, -index),
      taken_time: '09:15', quantity: [4, 25, 3][index], operator: 'Rani Putri', note: '',
    }))),
    counts: [165, 150, 125].map((quantity, index) => ({
      id: index, product_id: 'beras', quantity, counted_at: shift(day, index * 3 - 6) + 'T01:00:00Z',
    })),
    receipts: [36, 25, 42, 20, 34].map((quantity, index) => ({
      id: 'receipt-' + index, product_id: demoProducts[index < 3 ? 0 : index - 2].id,
      taken_date: shift(day, [0, -2, -5, -1, -3][index]), taken_time: '10:15',
      quantity, operator: 'Rani Putri', note: 'Gudang umum',
    })),
  };
}

function Photo({ product }) {
  const [failed, setFailed] = useState(false);
  return <div className="photo">{product.photo && !failed
    ? <img src={product.photo} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
    : <Package size={19} />}</div>;
}

export default function Dashboard({ database: db }) {
  const [day, setDay] = useState('');
  const [session, setSession] = useState(null);
  const [access, setAccess] = useState(null);
  const [demo, setDemo] = useState(false);
  const [register, setRegister] = useState(false);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState({ products: [], withdrawals: [] });
  const [view, setView] = useState('overview');
  const [selected, setSelected] = useState('');
  const [chartCategory, setChartCategory] = useState('');
  const [period, setPeriod] = useState(7);
  const [chartMode, setChartMode] = useState('usage');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setData(await api('warehouse'));
  }

  useEffect(() => {
    const current = today();
    setDay(current);
    const timer = setInterval(() => setDay(today()), 60_000);
    if (!db) {
      try {
        const saved = localStorage.getItem('ruang-stok-demo');
        const initial = demoData(current);
        setData(saved ? { ...initial, ...JSON.parse(saved) } : initial);
      } catch {
        setData(demoData(current));
      }
      setReady(true);
      return () => clearInterval(timer);
    }
    let active = true;
    api('auth/get-session').then(result => { if (active) setSession(result); })
      .catch(failure => { if (active) setError(failure.message); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; clearInterval(timer); };
  }, [db]);

  const userId = session?.user.id;
  const approved = Boolean(userId && access?.id === userId && access.approved);
  const restoringSession = db && (!ready || (userId && access?.id !== userId));
  async function checkAccess() {
    try {
      await refresh();
      setAccess({ id: userId, approved: true });
    } catch (failure) {
      setAccess({ id: userId, approved: false });
      if (failure.status !== 403) throw failure;
    }
  }

  useEffect(() => { if (userId) checkAccess().catch(failure => setError(failure.message)); }, [userId]);

  const { products, withdrawals, counts = [], receipts = [] } = data;
  const incomingView = view === 'receipts';
  const productsById = new Map(products.map(product => [product.id, product]));
  const chartProducts = products.filter(item => !chartCategory || item.category === chartCategory);
  const product = chartProducts.find(item => item.id === selected) ?? chartProducts[0];
  const trend = product && day ? usageTrend(withdrawals, product.id, day, period) : null;
  const incoming = product && day ? usageTrend(receipts, product.id, day, period) : null;
  const categoryRows = day ? categoryActivity(products, receipts, withdrawals, shift(day, 1 - period), day) : [];
  const categoryMax = Math.max(1, ...categoryRows.flatMap(row => [row.incoming, row.outgoing]));
  const countsForProduct = counts.filter(item => item.product_id === product?.id).slice(-7);
  const points = chartMode === 'usage' ? trend?.points ?? [] : countsForProduct.map(item => ({
    id: item.id, date: wibDate.format(new Date(item.counted_at)), quantity: item.quantity,
  }));
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...points.map(point => point.quantity), ...(chartMode === 'usage' ? incoming?.points.map(point => point.quantity) ?? [] : [])) / 4) * 4);
  const critical = products.filter(item => ['Habis', 'Stok menipis'].includes(stockStatus(item)));
  const dailyCount = withdrawals.filter(item => item.taken_date === day).length;
  const distinctCategories = [...new Set(products.map(item => item.category))].sort();
  const matches = item => item && (!filter || item.category === filter) && item.name.toLowerCase().includes(search.trim().toLowerCase());
  const filtered = products.filter(matches);
  const history = (incomingView ? receipts : withdrawals).filter(item => matches(productsById.get(item.product_id)))
    .sort((a, b) => (b.taken_date + b.taken_time).localeCompare(a.taken_date + a.taken_time));

  function navigate(nextView) {
    setView(nextView);
    setFilter('');
    setSearch('');
  }

  function open(type, item) {
    setError('');
    setNotice('');
    setForm({ type, item });
  }

  async function authenticate(event) {
    event.preventDefault();
    if (!db) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const credentials = { email: fields.get('email').trim(), password: fields.get('password') };
      const result = register
        ? await api('auth/sign-up/email', { ...credentials, name: fields.get('name').trim() })
        : await api('auth/sign-in/email', credentials);
      if (result?.user) setSession({ user: result.user });
      if (register) {
        setRegister(false);
        setNotice('Akun berhasil dibuat. Minta admin gudang mengaktifkan aksesmu.');
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError('');
    setNotice('');
    if (db) {
      try { await api('auth/sign-out', {}); }
      catch (failure) { setError(failure.message); return; }
      setSession(null);
      setAccess(null);
      setData({ products: [], withdrawals: [] });
    }
    setDemo(false);
    setRegister(false);
    navigate('overview');
  }

  async function save(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = name => String(fields.get(name) ?? '').trim();
    setBusy(true);
    setError('');
    try {
      let query;
      let next = data;
      if (form.type === 'take' || form.type === 'receive') {
        const row = { operator: value('operator'), product_id: value('product_id'), taken_date: value('taken_date'), taken_time: value('taken_time'), quantity: Number(value('quantity')), note: value('note') };
        if (!row.operator || !productsById.has(row.product_id) || row.taken_date > today()) throw new Error('Periksa nama, barang, dan tanggal transaksi.');
        if (db) query = row;
        else if (form.type === 'receive') next = { ...data, receipts: [...receipts, { ...row, id: crypto.randomUUID() }] };
        else next = { ...data, withdrawals: [...withdrawals, { ...row, id: crypto.randomUUID() }] };
      } else if (form.type === 'count') {
        const stock = Number(value('stock'));
        if (db) query = { id: form.item.id, stock };
        else {
          const counted_at = new Date().toISOString();
          next = {
            ...data,
            products: products.map(item => item.id === form.item.id ? { ...item, stock, counted_at } : item),
            counts: [...counts, { id: crypto.randomUUID(), product_id: form.item.id, quantity: stock, counted_at }],
          };
        }
      } else {
        const row = { name: value('name'), category: value('category'), unit: value('unit'), photo: value('photo') || null, minimum: Number(value('minimum')) };
        if (!row.name || !row.category || !row.unit) throw new Error('Lengkapi nama, jenis, dan satuan barang.');
        if (row.photo && new URL(row.photo).protocol !== 'https:') throw new Error('Gunakan URL foto HTTPS.');
        if (db) query = row;
        else next = { ...data, products: [...products, { ...row, id: crypto.randomUUID(), stock: null }] };
      }
      if (db) {
        await api('warehouse', { type: form.type, row: query });
        try { await refresh(); }
        catch { setError('Data tersimpan. Muat ulang halaman untuk melihat perubahan.'); }
      } else {
        localStorage.setItem('ruang-stok-demo', JSON.stringify(next));
        setData(next);
      }
      setNotice({ take: 'Pengambilan berhasil dicatat.', receive: 'Barang masuk berhasil dicatat.', count: 'Hitungan stok berhasil disimpan.', product: 'Barang berhasil ditambahkan.' }[form.type]);
      setForm(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (restoringSession) return <main className="login">
    <Card className="panel login-card gap-0">
      <div className="brand"><div className="brand-icon"><Warehouse size={23} /></div><strong>Ruang Stok</strong></div>
      <p className="session-loading" role="status">Memeriksa sesi…</p>
    </Card>
  </main>;

  if (db ? !approved : !demo) return <main className="login">
    <Card className="panel login-card gap-0">
      <div className="brand"><div className="brand-icon"><Warehouse size={23} /></div><div><strong>Ruang Stok</strong><small>Inventaris gudang</small></div></div>
      <h1>{session ? 'Akses gudang' : register ? 'Daftar akun' : 'Masuk ke Ruang Stok'}</h1>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {session ? <>
        <p>Akun {session.user.email} memerlukan persetujuan admin gudang.</p>
        <p className="account-id">ID akun <code>{session.user.id}</code></p>
        <div className="form-actions">
          <button className="secondary" onClick={signOut}>Keluar</button>
          <button className="primary" onClick={async () => {
            setBusy(true);
            setError('');
            try { await checkAccess(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
          }} disabled={busy}>Cek akses</button>
        </div>
      </> : <>
        <form key={String(register)} onSubmit={authenticate}>
          {register && <label>Nama lengkap <Input required name="name" maxLength={100} autoComplete="name" /></label>}
          <label>Email <Input required type="email" name="email" autoComplete="username" /></label>
          <label>Kata sandi <Input required type="password" name="password" minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} /></label>
          {register && <p className="auth-help">Gunakan minimal 8 karakter. Akses gudang aktif setelah disetujui admin.</p>}
          <Button size="lg" className="primary" disabled={busy || !ready || !db}>{busy ? 'Memproses…' : register ? 'Daftar' : 'Masuk'}</Button>
        </form>
        <button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setNotice(''); }}>{register ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</button>
        {!db && <div className="demo-access"><p>Neon belum terhubung. Coba fitur gudang dengan data demo di browser ini.</p><button className="secondary" disabled={!ready} onClick={() => setDemo(true)}>Buka dashboard demo</button></div>}
      </>}
    </Card>
  </main>;

  const overview = view === 'overview';
  const stock = view === 'stock';
  const heading = overview ? 'Ringkasan Gudang' : stock ? 'Stok Gudang' : incomingView ? 'Barang Masuk' : 'Pengambilan Barang';
  const action = stock ? () => open('product') : incomingView ? () => open('receive') : () => open('take');

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Warehouse size={22} /></div><div><strong>Ruang Stok</strong><small>Inventaris gudang</small></div></div>
      <nav aria-label="Menu utama">
        <span className="nav-label">WORKSPACE</span>
        {navigation.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined}><Icon size={19} />{label}</button>)}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">PG</div><div><strong>Petugas Gudang</strong><small>{db ? session?.user.email : 'Mode demo lokal'}</small></div>
        <button className="icon-button" aria-label="Keluar" onClick={signOut}><LogOut size={17} /></button>
      </div>
    </aside>
    <main className="workspace">
      <header className="topbar"><span><Warehouse size={16} /> Gudang <span className="slash">/</span> <strong>{navigation.find(item => item.id === view).label}</strong></span>
        <span className="date-chip"><CalendarDays size={16} />{day && new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day))}</span>
      </header>
      <div className="content">
        <section className="page-heading">
          <div><h1>{heading}</h1><p>{overview ? 'Pantau arus barang dan kondisi stok gudang.' : stock ? 'Perbarui stok sesuai hasil penghitungan fisik barang.' : incomingView ? 'Catat penerimaan barang dan telusuri riwayatnya.' : 'Catat barang yang diambil dan telusuri riwayatnya.'}</p></div>
          <div className="heading-actions">{overview && <Button variant="secondary" size="lg" className="secondary" onClick={() => open('receive')}><Plus size={17} /> Barang Masuk</Button>}
            <Button className="primary" size="lg" onClick={action}><Plus size={19} />{stock ? 'Tambah Barang' : incomingView ? 'Catat Barang Masuk' : 'Catat Pengambilan'}</Button></div>
        </section>
        {notice && <p className="notice" role="status">{notice}</p>}
        {error && !form && <p className="error" role="alert">{error}</p>}
        {overview && <>
          <div className="metrics">
            {[
              [Package, 'Total barang', products.length, 'Produk dalam katalog', 'green', 'stock'],
              [ArrowDownToLine, 'Barang masuk hari ini', receipts.filter(item => item.taken_date === day).length, 'Transaksi penerimaan', 'blue', 'receipts'],
              [ClipboardList, 'Barang keluar hari ini', dailyCount, 'Transaksi pengambilan', 'green', 'withdrawals'],
              [TriangleAlert, 'Perlu perhatian', critical.length, 'Barang menipis atau habis', 'orange', 'stock'],
            ].map(([Icon, label, value, detail, color, target]) => <button key={label} className="panel metric" onClick={() => navigate(target)}><div className="metric-top"><div className={'tile ' + color}><Icon size={21} /></div><ArrowUpRight size={17} /></div><div className="metric-label">{label}</div><strong>{number.format(value)}</strong><small>{detail}</small></button>)}
          </div>
          <div className="monitor">
            <Card as="section" className="panel chart-panel gap-0">
              <div className="panel-head"><div><h2>{chartMode === 'usage' ? 'Arus Barang' : 'Riwayat Stok Fisik'}</h2><p>{chartMode === 'usage' ? 'Jumlah barang masuk dan keluar per hari.' : 'Hasil hitungan manual terbaru.'}</p></div>
                <div className="select-wrap"><select aria-label="Jenis grafik" value={chartMode} onChange={event => setChartMode(event.target.value)}><option value="usage">Arus barang</option><option value="counts">Stok fisik</option></select><ChevronDown size={15} /></div>
              </div>
              {trend ? <>
                <div className="chart-summary">
                  <div className="select-wrap"><select aria-label="Filter jenis barang pada grafik" value={chartCategory} onChange={event => { setChartCategory(event.target.value); setSelected(''); }}><option value="">Semua jenis</option>{distinctCategories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></div>
                  <div className="select-wrap"><select aria-label="Barang pada grafik" value={product.id} onChange={event => setSelected(event.target.value)}>{chartProducts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></div>
                  {chartMode === 'usage' && <div className="select-wrap"><select aria-label="Periode grafik" value={period} onChange={event => setPeriod(Number(event.target.value))}><option value={7}>7 hari</option><option value={14}>14 hari</option></select><ChevronDown size={15} /></div>}
                </div>
                {chartMode === 'usage' && <div className="chart-key"><span className="key-in">Masuk <strong>{number.format(incoming.current)} {product.unit}</strong></span><span className="key-out">Keluar <strong>{number.format(trend.current)} {product.unit}</strong></span></div>}
                {points.length ? <div className="chart"><div className="axis" aria-hidden="true">{[4, 3, 2, 1, 0].map(step => <span key={step}>{number.format(maximum * step / 4)}</span>)}</div>
                  <div className="plot" aria-label={'Grafik ' + product.name}>
                    {points.map((point, index) => <div className="bar-column" key={point.id ?? point.date}>
                      <div className="bar-space">
                        {chartMode === 'usage' && <ChartBar point={incoming.points[index]} maximum={maximum} unit={product.unit} direction="Masuk" />}
                        <ChartBar point={point} maximum={maximum} unit={product.unit} direction={chartMode === 'usage' ? 'Keluar' : 'Stok fisik'} />
                      </div>
                      <span className="bar-label">{points.length <= 7 ? dateLabel.format(new Date(point.date)) : new Date(point.date).getUTCDate()}</span>
                    </div>)}
                  </div>
                </div> : <p className="empty">Belum ada hitungan stok untuk barang ini.</p>}
              </> : <p className="empty">Tambahkan barang untuk melihat grafik pemakaian.</p>}
            </Card>
            <Card as="section" className="panel attention gap-0">
              <div className="panel-head"><div><h2>Prioritas Gudang</h2><p>Pantau kebutuhan bon lebih awal.</p></div><div className="tile orange"><Activity size={19} /></div></div>
              {trend?.rising && <div className="trend-alert"><ArrowUpRight size={19} /><div><strong>Pemakaian meningkat</strong><p>{product.name} terambil {number.format(trend.current)} {product.unit} dalam {period} hari, sebelumnya {number.format(trend.previous)} {product.unit}. Cek kebutuhan bon.</p></div></div>}
              {critical.slice(0, 4).map(item => <button key={item.id} className="attention-item" onClick={() => open('count', item)}><Photo product={item} /><span><strong>{item.name}</strong><small>{stockStatus(item)}</small></span><b>{item.stock} {item.unit}</b></button>)}
              {!critical.length && !trend?.rising && <p className="empty">Belum ada peringatan pada barang yang dipantau.</p>}
              <button className="text-button" onClick={() => navigate('stock')}>Lihat stok gudang <ArrowUpRight size={15} /></button>
            </Card>
          </div>
          {categoryRows.length > 0 && <Card as="section" className="panel chart-panel category-panel gap-0">
            <div className="panel-head"><div><h2>Aktivitas per Jenis Barang</h2><p>Jumlah transaksi dalam {period} hari terakhir. Pilih jenis untuk memfilter arus barang.</p></div>
              {chartCategory && <button className="secondary" onClick={() => { setChartCategory(''); setSelected(''); }}>Semua jenis</button>}
            </div>
            <div className="chart-key"><span className="key-in">Masuk</span><span className="key-out">Keluar</span></div>
            {categoryRows.map(row => <button key={row.category} className="category-row" aria-pressed={chartCategory === row.category} onClick={() => { setChartCategory(chartCategory === row.category ? '' : row.category); setSelected(''); }}>
              <span><strong>{row.category}</strong><small>{number.format(row.products)} produk</small></span>
              <span className="category-bars">
                <span aria-label={row.incoming + ' transaksi masuk'}><i className="category-in" style={{ width: (row.incoming / categoryMax * 100) + '%' }} />{number.format(row.incoming)}</span>
                <span aria-label={row.outgoing + ' transaksi keluar'}><i className="category-out" style={{ width: (row.outgoing / categoryMax * 100) + '%' }} />{number.format(row.outgoing)}</span>
              </span>
            </button>)}
          </Card>}
        </>}
        <Card as="section" className="panel table-panel gap-0">
          <div className="panel-head"><div><h2>{stock ? 'Katalog & Stok Barang' : overview ? 'Pengambilan Terbaru' : incomingView ? 'Riwayat Barang Masuk' : 'Riwayat Pengambilan'}</h2><p>{stock ? 'Stok ditampilkan berdasarkan hitungan manual terakhir.' : 'Waktu transaksi ditampilkan dalam WIB.'}</p></div>
            {overview && <button className="secondary" onClick={() => navigate('withdrawals')}>Lihat riwayat</button>}
          </div>
          {!overview && <div className="filters"><label className="search"><Search size={17} /><Input aria-label="Cari nama barang" placeholder="Cari nama barang…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <div className="select-wrap"><select aria-label="Filter jenis produk" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Semua jenis</option>{distinctCategories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></div>
          </div>}
          <div className="table-scroll"><table>
            <thead><tr><th>Barang</th><th>Jenis produk</th>{stock ? <><th>Stok fisik</th><th>Status</th><th>Terakhir dihitung</th><th>Aksi</th></> : <><th>Penginput</th><th>Tanggal & jam</th><th>Jumlah</th><th>Catatan</th></>}</tr></thead>
            <tbody>{stock ? filtered.map(item => <tr key={item.id}>
              <td><div className="product"><Photo product={item} /><strong>{item.name}</strong></div></td><td>{item.category}</td><td>{item.stock === null ? '—' : number.format(item.stock) + ' ' + item.unit}</td>
              <td><span className={'status ' + (critical.includes(item) ? 'low' : item.stock === null ? 'unknown' : '')}>{stockStatus(item)}</span></td>
              <td>{item.counted_at ? new Date(item.counted_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}</td>
              <td><button className="secondary compact" onClick={() => open('count', item)}>Isi stok</button></td>
            </tr>) : (overview ? history.slice(0, 5) : history).map(item => {
              const entry = productsById.get(item.product_id);
              return <tr key={item.id}><td><div className="product"><Photo product={entry} /><strong>{entry.name}</strong></div></td><td>{entry.category}</td><td>{item.operator}</td><td>{dateLabel.format(new Date(item.taken_date))} {item.taken_date.slice(0, 4)} · {item.taken_time.slice(0, 5)}</td><td><strong>{number.format(item.quantity)} {entry.unit}</strong></td><td>{item.note || '—'}</td></tr>;
            })}</tbody>
          </table></div>
          {(stock ? !filtered.length : !history.length) && <p className="empty">{stock ? 'Belum ada barang yang sesuai.' : incomingView ? 'Belum ada catatan barang masuk.' : 'Belum ada catatan pengambilan.'}</p>}
        </Card>
      </div>
    </main>
    {form && <EntryForm form={form} products={products} day={day} busy={busy} error={error} close={() => { setForm(null); setError(''); }} save={save} />}
  </div>;
}

function ChartBar({ point, maximum, unit, direction }) {
  const label = direction + ': ' + number.format(point.quantity) + ' ' + unit;
  return <div tabIndex={0} className={'bar ' + (direction === 'Masuk' ? 'bar-in' : '')} style={{ height: (point.quantity / maximum * 100) + '%' }} role="img" aria-label={dateLabel.format(new Date(point.date)) + ' · ' + label}><span className="tooltip">{label}</span></div>;
}

function EntryForm({ form, products, day, busy, error, close, save }) {
  const [picked, setPicked] = useState(products[0]?.id ?? '');
  const product = products.find(item => item.id === picked);
  const title = { take: 'Catat Pengambilan', receive: 'Catat Barang Masuk', product: 'Tambah Barang', count: 'Isi Stok Fisik' }[form.type];
  const movement = form.type === 'take' || form.type === 'receive';
  const movementLabel = form.type === 'receive' ? 'penerimaan' : 'pengambilan';
  return <dialog className="panel modal" aria-labelledby="form-title" ref={element => {
    if (element && !element.open) element.showModal();
  }} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <div className="panel-head"><h2 id="form-title">{title}</h2><button type="button" className="icon-button" disabled={busy} aria-label="Tutup" onClick={close}><X size={21} /></button></div>
    <form onSubmit={save}>
      {movement && <>
        {!products.length && <p>Tambahkan barang dari menu Stok Gudang terlebih dahulu.</p>}
        <label>Nama penginput <Input required maxLength={100} name="operator" /></label>
        <div className="form-row"><label>Tanggal {movementLabel} <input required type="date" name="taken_date" max={day} defaultValue={day} /></label><label>Jam {movementLabel} (WIB) <input required type="time" name="taken_time" defaultValue={hour()} /></label></div>
        <label>Barang <select required name="product_id" value={picked} onChange={event => setPicked(event.target.value)}>{products.map(item => <option key={item.id} value={item.id}>{item.category} · {item.name}</option>)}</select></label>
        {product && <div className="product"><Photo key={product.id} product={product} /><strong>{product.name}</strong></div>}
        <label>Jumlah {form.type === 'receive' ? 'diterima' : 'diambil'} {product && '(' + product.unit + ')'} <Input required type="number" min="1" max="2147483647" name="quantity" /></label>
        <label>Catatan <textarea name="note" maxLength={300} rows={2} /></label>
      </>}
      {form.type === 'product' && <>
        <label>Nama barang <input name="name" required maxLength={120} /></label>
        <div className="form-row"><label>Jenis produk <input name="category" list="categories" required maxLength={80} /></label><label>Satuan barang <input name="unit" placeholder="pcs, bungkus, kg" required maxLength={30} /></label></div>
        <datalist id="categories">{[...new Set([...categories, ...products.map(item => item.category)])].map(item => <option key={item} value={item} />)}</datalist>
        <label>URL foto barang <input type="url" name="photo" maxLength={2048} placeholder="https://…" /></label>
        <label>Batas stok menipis <input type="number" name="minimum" min="0" max="2147483647" required defaultValue="0" /></label>
      </>}
      {form.type === 'count' && <>
        <p>{form.item.name} · {form.item.category}</p>
        <label>Jumlah hasil hitung ({form.item.unit}) <input required type="number" min="0" max="2147483647" name="stock" defaultValue={form.item.stock ?? ''} /></label>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions"><Button type="button" variant="secondary" className="secondary" disabled={busy} onClick={close}>Batal</Button><Button className="primary" disabled={busy || (movement && !products.length)}>{busy ? 'Menyimpan…' : 'Simpan'}</Button></div>
    </form>
  </dialog>;
}
