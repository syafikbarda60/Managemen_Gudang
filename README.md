# Ruang Stok

Dashboard Next.js untuk penerimaan, pengambilan, dan penghitungan stok fisik. Antarmuka menggunakan shadcn/ui dan Lucide dengan tema putih krem.

## Neon dan pengembangan lokal

1. Jalankan `npm ci`. Gunakan Node.js 22.
2. Tautkan proyek Neon yang dituju dan jalankan `neon deploy` agar `DATABASE_URL` dan `DATABASE_URL_UNPOOLED` masuk ke `.env.local`.
3. Isi `BETTER_AUTH_SECRET` di `.env.local` dengan nilai acak minimal 32 karakter. Jalankan `node --env-file=.env.local scripts/migrate.mjs`.
4. Jalankan `npm run dev` dan buka http://localhost:3000. Jika database belum dikonfigurasi, halaman menyediakan mode demo yang tersimpan di browser.

## Akun petugas

Daftar melalui halaman login. Administrator gudang harus mengonfirmasi identitas petugas dan mencocokkan ID akun yang tampil setelah registrasi. Di Neon SQL Editor, jalankan perintah berikut dengan ID tersebut, kemudian pilih **Cek akses** di aplikasi.

```sql
insert into warehouse_members (user_id)
select id from "user" where id = 'ID_AKUN_PETUGAS'
on conflict do nothing;
```

Login memakai Better Auth dengan sesi dan akun di PostgreSQL. Alur verifikasi identitas menggunakan persetujuan admin gudang.

## Vercel

Tautkan repositori sebagai proyek Next.js. Tambahkan `DATABASE_URL` dan `BETTER_AUTH_SECRET` sebagai variabel server pada lingkungan target. Untuk domain kustom, set `BETTER_AUTH_URL` ke origin HTTPS yang dipakai pengguna. Terapkan migrasi ke database sebelum menerbitkan versi yang memakainya.

## Grafik dan pemeriksaan

Arus barang membandingkan jumlah masuk dan keluar per produk dalam 7 atau 14 hari. Grafik jenis barang menghitung transaksi agar satuan campuran tetap dapat dibandingkan. Stok fisik mengikuti hitungan terakhir dan menyimpan riwayat tiap penghitungan.

Jalankan `npm test` dan `npm run build`. Saat aplikasi berjalan dengan database yang telah dimigrasikan, jalankan `node --env-file=.env.local scripts/smoke.mjs http://127.0.0.1:3000` untuk menguji akun, hak akses, dan pencatatan inventaris. Skrip menggunakan akun dan barang sementara miliknya sendiri.
