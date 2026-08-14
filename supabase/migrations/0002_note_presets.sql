-- ============================================================
--  RM-IAM — 0002_note_presets
--
--  Dua penambahan, keduanya lahir dari menu sungguhan yang besar:
--
--  1. Catatan cepat (note presets). Pengunjung sering butuh "pedas" /
--     "tidak pedas" / "tanpa es". Mengetik itu di HP lambat, dan di kiosk
--     lebih lambat lagi. Presetnya ditaruh PER KATEGORI karena granularitas
--     itu yang pas: "pedas" masuk akal untuk Nasi Goreng, tidak untuk Juice.
--     Per item akan berarti mengisi 60+ baris; per kategori cuma 7.
--
--  2. dial_max_ring. Menu nyata punya 18 nasi goreng, dan 18 lingkaran di
--     satu cincin saling tumpang-tindih (keliling cincin lebih kecil dari
--     total diameter lingkarannya).
--
--     Cincin sekarang punya 12 slot — mengikuti angka pada jam. Kalau item
--     lebih dari 12, slot terakhir dipakai lingkaran NAVIGASI (warna beda)
--     yang memindahkan ke halaman berikutnya. Batas atasnya 12 karena itu
--     batas kepadatan yang masih nyaman disentuh, bukan angka sembarangan.
--
--  Keduanya konfigurasi, bukan konstanta di kode (PRD §14).
-- ============================================================

alter table settings
  add column if not exists note_presets jsonb not null default
    '["Pedas","Tidak pedas","Sedikit garam","Tanpa sambal","Tanpa bawang"]'::jsonb,
  add column if not exists dial_max_ring int not null default 12
    check (dial_max_ring between 6 and 12);

-- null = pakai settings.note_presets
alter table categories
  add column if not exists note_presets jsonb;
