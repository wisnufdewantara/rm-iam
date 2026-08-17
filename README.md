# RM-IAM

Aplikasi pemesanan mandiri (self-order) rumah makan dengan UI **dial bulat-bulat**.
Bisa dipakai dari smartphone pengunjung maupun anjungan pemesanan mandiri (kiosk).

**Demo langsung: https://rm-iam.vercel.app** — cara mencobanya di
[bagian "Coba dalam 3 menit"](#coba-dalam-3-menit) di bawah.

Spesifikasi lengkap: **[docs/PRD.md](docs/PRD.md)** — itu sumber kebenaran untuk
alur, model data, RLS, dan keputusan desain beserta alasannya.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + Auth + Realtime) · CSS biasa · Zod
- **Biaya:** semuanya tier gratis — Vercel Hobby + Supabase Free, tanpa layanan berbayar

## Menyiapkan dari nol

```bash
npm install
cp .env.example .env.local     # lalu isi 2 variabelnya
```

Isi `.env.local` dari Supabase → **Settings → API Keys**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Secret key **tidak dibutuhkan** dan sengaja tidak dipakai — lihat PRD §7.1.

Lalu di Supabase → **SQL Editor**, jalankan berurutan:

1. `supabase/migrations/0001_init.sql` — skema, RLS, fungsi nomor pesanan
2. `supabase/migrations/0002_note_presets.sql` — catatan cepat + slot cincin
3. `supabase/migrations/0003_orders_lifecycle.sql` — RPC pesanan, trigger, `pg_cron`
4. `supabase/migrations/0004_sales_archive.sql` — arsip penjualan permanen
5. `supabase/migrations/0005_role_transitions.sql` — aturan peran + Realtime
6. `supabase/seed.sql` — menu contoh (66 item) — perlu untuk demo
7. Buat 3 user di **Authentication → Users** (centang *Auto Confirm*):
   `dapur@demo.local`, `waiter@demo.local`, `admin@demo.local`
8. `supabase/seed_staff.sql` — daftarkan ketiganya sebagai staf (cocok lewat
   email, jadi tidak perlu menyalin UUID)

```bash
npm run dev        # http://localhost:3000
```

Halaman depan akan memberi tahu sendiri kalau env belum diisi atau skema belum
dijalankan — tidak akan menampilkan halaman error yang membingungkan.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (Turbopack, default di Next 16) |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint (`next lint` sudah dihapus di Next 16) |
| `npx tsc --noEmit` | Typecheck |

Jangan menjalankan `npm run build` sambil `npm run dev` masih hidup — keduanya
memakai folder `.next/` yang sama dan hasilnya bisa saling mengacaukan.

## Migrasi database

SQL disimpan sebagai file bernomor di `supabase/migrations/`. Aturannya:

- Perubahan skema = **file baru** (`0002_*.sql`), jangan mengedit file yang sudah
  dijalankan di database mana pun.
- `supabase/seed.sql` hanya data contoh — dipisah dari migrasi, dan jangan
  dijalankan di database yang sudah punya data sungguhan.

Alasannya di PRD §14.1. Singkatnya: kalau project Supabase kena auto-pause atau
kamu ingin mulai dari nol, skemanya masih utuh di repo.

## Catatan penting

- **Supabase Free di-pause setelah ~7 hari tanpa aktivitas.** Ini risiko terbesar
  untuk demo/porto: matinya diam-diam, dan yang menemukan pertama bisa jadi orang
  yang sedang menilai. Mitigasinya ada di
  [`.github/workflows/keep-supabase-awake.yml`](.github/workflows/keep-supabase-awake.yml)
  — satu query per hari. Isi dua nilai di **Settings → Secrets and variables →
  Actions**, pakai tombol **New repository secret** *atau* **New repository
  variable** (workflow-nya membaca dua-duanya):
  `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` — publishable key, bukan secret key.
  Harus di tingkat **repository**; kalau ditaruh di dalam sebuah *Environment*,
  nilainya tidak terbaca kecuali job-nya menyatakan `environment:`.
  Setelah diisi, tes lewat tab **Actions → Keep Supabase awake → Run workflow**,
  atau dari terminal: `gh workflow run keep-supabase-awake.yml --ref master`.

  **Ada jalur kedua yang berdiri sendiri:** `vercel.json` menjadwalkan
  `/api/cron/keep-awake` sekali sehari (Vercel Hobby mengizinkan 1 cron/hari).
  Dua jalur karena GitHub Actions bisa mati di luar kendali proyek — akun
  terkunci soal tagihan, kuota habis, atau Actions dimatikan di level
  organisasi. Kalau satu-satunya penjaga ikut mati, demonya mati diam-diam.
  Opsional: isi env `CRON_SECRET` di Vercel supaya endpoint itu hanya bisa
  dipanggil oleh cron-nya sendiri.
- **Pembayaran masih mockup** — belum ada Xendit, tidak ada transaksi nyata.
- Next 16 punya beberapa perubahan yang mudah terlewat: Turbopack sudah default,
  `middleware.ts` → `proxy.ts`, `next lint` dihapus, dan `eslint-config-next`
  sudah flat-config native (jangan dibungkus `FlatCompat`).

## Coba dalam 3 menit

Akun demo (semua password sama, lihat catatan di bawah):

| Email | Peran | Bisa apa |
|---|---|---|
| `dapur@demo.local` | kitchen | Antrekan & selesaikan pesanan |
| `waiter@demo.local` | waiter | Batalkan item/pesanan, tandai diantar |
| `admin@demo.local` | superuser | Semua + kelola menu & konfigurasi |

Buka dua tab bersebelahan — bagian menariknya justru di antara keduanya.

1. **Tab 1 (tamu)** — buka `/`. Masukkan nomor meja **12** dan nama Anda.
   Nomor itu meniru penanda fisik yang dipegang tamu, jadi layar konfirmasinya
   menampilkan angkanya besar-besar untuk dibandingkan.
2. Ketuk **Nasi Goreng** — lingkarannya terbang ke tengah dan cincinnya berganti
   jadi menu. Ada **18** nasi goreng, jadi satu slot dipakai lingkaran navigasi
   berwarna beda; ketuk untuk halaman berikutnya.
3. Ketuk **Ayam** → chip **Pedas** → *Tambah*. **Jangan tutup dialognya**: ketuk
   **Tidak pedas** → *Tambah* lagi. Perhatikan keduanya jadi **dua baris
   terpisah**, bukan satu baris qty 2 — dapur menerima varian terstruktur, bukan
   kalimat yang harus ditafsirkan.
4. Scroll lewat separator → **Lanjut Pembayaran** → **Bayar Sekarang**. Anda
   masuk halaman tunggu. Biarkan tab ini terbuka.
5. **Tab 2 (staf)** — buka `/masuk`, login sebagai `dapur@demo.local`. Pesanan
   tadi ada di kolom **Masuk**. Klik **Antrekan**, lalu lihat **Tab 1**: dalam
   ≤4 detik langkahnya pindah ke *Diantre* **tanpa refresh**. Klik **Selesai** →
   Tab 1 jadi centang hijau.
6. Keluar, login sebagai `waiter@demo.local` → **/waiter**. Batalkan satu item:
   totalnya dihitung ulang di semua layar, termasuk halaman tunggu tamu.
   Coba **Batalkan pesanan** — tombolnya terkunci sampai alasan diisi, dan
   alasan itu sampai ke tamu.
7. Login sebagai `admin@demo.local` → **/admin/menu**. Ubah harga apa pun →
   refresh Tab 1: harga barunya sudah berubah, **tanpa deploy**. Lalu buka
   **/laporan** — pesanan yang selesai dan dibatalkan sudah terekam.

Yang layak diperiksa lebih dalam:

- **Mode kiosk:** buka `/?mode=kiosk` — target sentuh lebih besar, papan angka
  di layar, dan reset otomatis kalau ditinggalkan.
- **Aturan peran ada di database, bukan di UI.** Menyembunyikan tombol bukan
  penjaganya: memanggil REST API Supabase langsung sebagai dapur untuk
  membatalkan pesanan tetap ditolak `42501`, dan sebagai waiter untuk
  mengantrekan juga ditolak. Alasannya di [PRD §7](docs/PRD.md).
- **Aplikasi tidak pernah memegang secret key.** Semua akses tamu lewat fungsi
  Postgres `security definer`; kebocoran env var tidak berarti kebocoran
  database.

> Password akun demo ada di catatan terpisah, bukan di repo. Kalau Anda
> menjalankan sendiri, buat akunnya di Supabase → Authentication → Users lalu
> jalankan `supabase/seed_staff.sql`.

## Kredit

- Created by **Wisnu Dewantara** — wisnupriester@gmail.com
- Assisted by **Kucing Oren** — iamgorange@gmail.com
- Powered with **Claude Opus 5**

© 2026 Wisnu Dewantara. Belum ada berkas LICENSE, jadi secara bawaan **seluruh
hak dipertahankan** — orang lain tidak otomatis boleh memakai atau menjual ulang
kode ini. Itu posisi yang tepat untuk sesuatu yang berencana dijual; tambahkan
LICENSE hanya kalau memang ingin memberi izin tertentu.

## Status pengerjaan

- [x] **Fase 0** — scaffold, skema + seed, dial statis membaca kategori dari DB
- [x] **Fase 1** — layar masuk (nomor meja + nama), popover item, keranjang persist
- [x] **Perbaikan** — varian per catatan (1 pedas + 1 tidak pedas), cincin 12 slot + lingkaran navigasi, menu asli 66 item
- [x] **Fase 2** — buat order, bayar mockup, halaman tunggu + TTL 12 jam
- [x] **Fase 3** — dapur (KDS) + Supabase Auth + RLS per peran
- [x] **Fase 4** — waiter: batalkan item/pesanan, tandai diantar
- [x] **Fase 5** — superuser: CRUD menu, konfigurasi dial, laporan
- [x] **Fase 6** — kiosk, dark mode, anti-pause Supabase, demo script
