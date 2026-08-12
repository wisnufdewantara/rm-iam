# RM-IAM

Aplikasi pemesanan mandiri (self-order) rumah makan dengan UI **dial bulat-bulat**.
Bisa dipakai dari smartphone pengunjung maupun anjungan pemesanan mandiri (kiosk).

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
2. `supabase/seed.sql` — kategori & menu contoh (opsional, tapi perlu untuk demo)

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
  untuk demo/porto: matinya diam-diam. Mitigasinya GitHub Action harian yang
  menyentuh satu query (Fase 6).
- **Pembayaran masih mockup** — belum ada Xendit, tidak ada transaksi nyata.
- Next 16 punya beberapa perubahan yang mudah terlewat: Turbopack sudah default,
  `middleware.ts` → `proxy.ts`, `next lint` dihapus, dan `eslint-config-next`
  sudah flat-config native (jangan dibungkus `FlatCompat`).

## Status pengerjaan

- [x] **Fase 0** — scaffold, skema + seed, dial statis membaca kategori dari DB
- [x] **Fase 1** — layar masuk (nomor meja + nama), popover item, keranjang persist
- [ ] **Fase 2** — buat order, bayar mockup, halaman tunggu + TTL 12 jam
- [ ] **Fase 3** — dapur (KDS) + Supabase Auth + RLS per peran
- [ ] **Fase 4** — waiter: batalkan item/pesanan, tandai diantar
- [ ] **Fase 5** — superuser: CRUD menu, konfigurasi dial, laporan
- [ ] **Fase 6** — kiosk, dark mode, anti-pause, demo script
