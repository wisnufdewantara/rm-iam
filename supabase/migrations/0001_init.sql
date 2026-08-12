-- ============================================================
--  RM-IAM — 0001_init
--  Jalankan di Supabase → SQL Editor (atau `supabase db push`).
--  Aman dijalankan ulang: pakai IF NOT EXISTS / drop policy dulu.
--
--  JANGAN mengedit file ini setelah dijalankan di database mana pun.
--  Perubahan skema = file baru 0002_*.sql. (PRD §14.1)
-- ============================================================

-- ---------- extension ----------
create extension if not exists pg_cron;

-- ---------- enum ----------
do $$ begin
  create type order_status as enum
    ('pending_payment','paid','queued','done','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_item_status as enum ('active','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('waiter','kitchen','superuser');
exception when duplicate_object then null; end $$;

-- ============================================================
--  Staf
-- ============================================================
create table if not exists staff (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        staff_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
--  Penanda meja fisik (standee/asbak bernomor) — PRD §3.1.2
--
--  BUKAN "meja". Penanda DIPINJAMKAN ke pengunjung, dibawa ke meja mana
--  pun, lalu diambil cleaning service dan DIPAKAI ULANG. Jadi:
--    - satu nomor tidak menandai satu lokasi permanen
--      (jangan bangun fitur peta meja di atas tabel ini)
--    - jumlah penanda tidak harus sama dengan jumlah meja
--    - `number` bertipe TEXT: "12", "A1", "TA-3" semuanya sah
-- ============================================================
create table if not exists table_markers (
  id         uuid primary key default gen_random_uuid(),
  number     text not null unique,
  label      text,
  kind       text not null default 'dine_in'
             check (kind in ('dine_in','takeaway')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
--  Menu
-- ============================================================
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  icon_name   text not null default 'restaurant',   -- Material Symbol
  color       text,                                  -- override aksen lingkaran
  position    int  not null,                         -- urutan di cincin dial
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists categories_pos_idx on categories (position);

create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references categories(id) on delete restrict,
  name         text not null,
  description  text,
  price        int  not null check (price >= 0),     -- rupiah, integer
  image_url    text,
  icon_name    text,
  is_available boolean not null default true,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists menu_items_cat_idx on menu_items (category_id, position);

-- ============================================================
--  Pesanan
-- ============================================================
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text not null unique,                -- '260812-014'
  table_number  text not null,                       -- TEXT, lihat table_markers
  customer_name text not null,                       -- WAJIB: pembeda saat nomor
                                                     -- penanda bertabrakan (§3.1.2)
  status        order_status not null default 'pending_payment',
  subtotal      int not null default 0,
  total         int not null default 0,
  guest_token   uuid not null default gen_random_uuid(),
  note          text,
  cancel_reason text,
  cancelled_by  uuid references staff(id),
  paid_at       timestamptz,
  queued_at     timestamptz,
  completed_at  timestamptz,
  served_at     timestamptz,
  expires_at    timestamptz,                         -- diisi saat done/cancelled
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_status_idx  on orders (status, created_at desc);
create index if not exists orders_table_idx   on orders (table_number);
create index if not exists orders_expires_idx on orders (expires_at)
  where expires_at is not null;

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  menu_item_id  uuid references menu_items(id) on delete set null,
  name          text not null,      -- snapshot nama saat dipesan
  price         int  not null,      -- snapshot harga saat dipesan
  qty           int  not null check (qty > 0),
  note          text,
  status        order_item_status not null default 'active',
  cancelled_by  uuid references staff(id),
  created_at    timestamptz not null default now()
);
create index if not exists order_items_order_idx on order_items (order_id);

-- ---------- pembayaran (mock, siap Xendit) ----------
create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  provider     text not null default 'mock',     -- nanti: 'xendit'
  method       text,
  amount       int  not null,
  status       text not null default 'pending',  -- pending|paid|failed|expired
  external_id  text,
  raw          jsonb not null default '{}',
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists payments_order_idx on payments (order_id);

-- ---------- audit trail ----------
create table if not exists order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  actor_role  text not null,     -- guest|waiter|kitchen|superuser|system
  actor_id    uuid references staff(id),
  from_status order_status,
  to_status   order_status,
  action      text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, created_at);

-- ============================================================
--  Konfigurasi — satu baris.
--  Semua yang bisa berbeda antar rumah makan ada di sini, bukan di kode.
--  Baca SELALU lewat lib/settings.ts, jangan `where id = 1` bertebaran.
-- ============================================================
create table if not exists settings (
  id            int primary key default 1 check (id = 1),
  brand_name    text not null default 'RM-IAM',
  accent        text not null default '#f97316',
  theme         text not null default 'light',
  hint_text     text not null default 'Ketuk kategori untuk melihat menu',
  cancel_notice text not null default
    'Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri. Silakan panggil waiter kami.',
  dial_radius_rem numeric not null default 12,
  kiosk_idle_secs int not null default 60,
  order_ttl_hours int not null default 12,

  -- cara pengunjung mengidentifikasi mejanya (§3.1.2). v1 pakai 'marker'.
  identity_mode text not null default 'marker'
    check (identity_mode in ('marker','marker_free','table_qr','queue')),
  table_number_label text not null default 'Nomor Meja',
  ask_customer_name  boolean not null default true,

  -- pengaman salah meja & pesanan ganda (§3.1.1) — PERINGATAN, bukan penolakan
  duplicate_window_secs     int not null default 60,
  same_table_warn_threshold int not null default 3,

  -- pengaman penyalahgunaan; angkanya jauh di atas perilaku manusia wajar
  guest_order_rate_limit_secs int not null default 15,
  guest_paid_orders_per_hour  int not null default 10,

  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
--  Nomor pesanan: YYMMDD-NNN, urut per hari, reset otomatis.
--  Pendek, bisa diucapkan lewat pengeras suara, dan bukan sekuens
--  global yang membocorkan volume penjualan.
-- ============================================================
create table if not exists order_counters (
  day date primary key,
  n   int  not null default 0
);

create or replace function next_order_number() returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- CATATAN: zona waktu masih hardcode. Utang teknis yang sadar (PRD §14).
  d date := (now() at time zone 'Asia/Jakarta')::date;
  c int;
begin
  insert into order_counters (day, n) values (d, 1)
    on conflict (day) do update set n = order_counters.n + 1
    returning n into c;
  return to_char(d, 'YYMMDD') || '-' || lpad(c::text, 3, '0');
end $$;

-- ============================================================
--  Row Level Security
--  Prinsip: pengunjung anon TIDAK bisa membaca pesanan orang lain dan
--  TIDAK bisa mengubah status apa pun. Menu & settings boleh dibaca publik.
-- ============================================================
create or replace function current_staff_role() returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from staff where id = auth.uid() and is_active
$$;

alter table staff          enable row level security;
alter table table_markers  enable row level security;
alter table categories     enable row level security;
alter table menu_items     enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table payments       enable row level security;
alter table order_events   enable row level security;
alter table settings       enable row level security;
alter table order_counters enable row level security;

-- ---------- publik: menu, penanda aktif, settings ----------
drop policy if exists "public read active categories" on categories;
create policy "public read active categories" on categories
  for select using (is_active);

drop policy if exists "public read available menu" on menu_items;
create policy "public read available menu" on menu_items
  for select using (is_available);

drop policy if exists "public read active markers" on table_markers;
create policy "public read active markers" on table_markers
  for select using (is_active);

drop policy if exists "public read settings" on settings;
create policy "public read settings" on settings
  for select using (true);

-- ---------- staf: kelola menu ----------
drop policy if exists "superuser writes categories" on categories;
create policy "superuser writes categories" on categories
  for all using (current_staff_role() = 'superuser')
  with check (current_staff_role() = 'superuser');

drop policy if exists "superuser writes menu" on menu_items;
create policy "superuser writes menu" on menu_items
  for all using (current_staff_role() = 'superuser')
  with check (current_staff_role() = 'superuser');

drop policy if exists "superuser writes markers" on table_markers;
create policy "superuser writes markers" on table_markers
  for all using (current_staff_role() = 'superuser')
  with check (current_staff_role() = 'superuser');

drop policy if exists "superuser writes settings" on settings;
create policy "superuser writes settings" on settings
  for update using (current_staff_role() = 'superuser')
  with check (current_staff_role() = 'superuser');

-- ---------- staf: baca profil sendiri ----------
drop policy if exists "staff read self" on staff;
create policy "staff read self" on staff
  for select using (id = auth.uid() or current_staff_role() = 'superuser');

drop policy if exists "superuser manages staff" on staff;
create policy "superuser manages staff" on staff
  for all using (current_staff_role() = 'superuser')
  with check (current_staff_role() = 'superuser');

-- ---------- pesanan: hanya staf yang punya akses langsung ----------
--  Pengunjung TIDAK diberi policy apa pun di orders/order_items/payments.
--  Semua akses pengunjung lewat fungsi `security definer` (menyusul di 0003).
drop policy if exists "staff read orders" on orders;
create policy "staff read orders" on orders
  for select using (current_staff_role() is not null);

drop policy if exists "kitchen advances orders" on orders;
create policy "kitchen advances orders" on orders
  for update using (current_staff_role() in ('kitchen','superuser'))
  with check (status in ('queued','done'));

drop policy if exists "waiter updates orders" on orders;
create policy "waiter updates orders" on orders
  for update using (current_staff_role() in ('waiter','superuser'));

drop policy if exists "staff read order items" on order_items;
create policy "staff read order items" on order_items
  for select using (current_staff_role() is not null);

drop policy if exists "waiter cancels items" on order_items;
create policy "waiter cancels items" on order_items
  for update using (current_staff_role() in ('waiter','superuser'));

drop policy if exists "staff read payments" on payments;
create policy "staff read payments" on payments
  for select using (current_staff_role() is not null);

drop policy if exists "staff read events" on order_events;
create policy "staff read events" on order_events
  for select using (current_staff_role() is not null);

drop policy if exists "staff writes events" on order_events;
create policy "staff writes events" on order_events
  for insert with check (current_staff_role() is not null);

-- order_counters: tidak ada policy sama sekali.
-- Hanya next_order_number() (security definer) yang menyentuhnya.
