-- ============================================================
--  RM-IAM — 0004_sales_archive
--
--  Riwayat penjualan PERMANEN, hanya untuk staf.
--
--  Pesanan hidup dihapus 12 jam setelah selesai (0003), tapi riwayat
--  penjualan tidak boleh ikut hilang. Karena itu arsipnya tinggal di tabel
--  terpisah yang diisi trigger saat pesanan mencapai status akhir.
--
--  DUA HAL YANG JANGAN DIUBAH TANPA SADAR AKIBATNYA:
--
--  1. sales_records.order_id SENGAJA TANPA foreign key ke orders.
--     Memasang FK terasa "lebih benar", tapi on delete cascade akan menghapus
--     arsipnya bersama pesanannya — tepat kebalikan dari yang diinginkan.
--     Kolomnya hanya uuid unique biasa, dipakai sebagai kunci idempotensi.
--
--  2. Arsip TIDAK menyimpan customer_name.
--     Untuk rekap penjualan yang dibutuhkan hanya meja, waktu, item, dan uang.
--     Nama pengunjung tetap ikut terhapus dalam 12 jam. Jadi riwayat uang
--     permanen dan data pribadi tidak ditimbun.
-- ============================================================

create table if not exists sales_records (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique,   -- TANPA FK, lihat catatan di atas
  order_number  text not null,
  table_number  text not null,
  status        order_status not null,  -- 'done' | 'cancelled'
  subtotal      int  not null,
  total         int  not null,
  item_count    int  not null,
  cancel_reason text,
  cancelled_by  uuid,
  ordered_at    timestamptz not null,
  paid_at       timestamptz,
  queued_at     timestamptz,
  completed_at  timestamptz,
  served_at     timestamptz,
  events        jsonb not null default '[]',
  archived_at   timestamptz not null default now()
);
create index if not exists sales_records_completed_idx on sales_records (completed_at desc);
create index if not exists sales_records_table_idx     on sales_records (table_number);

create table if not exists sales_record_items (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references sales_records(id) on delete cascade,
  menu_item_id uuid,                    -- juga tanpa FK: menu boleh dihapus
  name         text not null,           -- snapshot
  price        int  not null,           -- snapshot
  qty          int  not null,
  status       order_item_status not null,
  line_total   int  not null            -- 0 untuk item yang dibatalkan
);
create index if not exists sales_record_items_rec_idx on sales_record_items (record_id);

-- ---------- pengarsip, idempoten ----------
create or replace function archive_order() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare rec_id uuid;
begin
  insert into sales_records (
    order_id, order_number, table_number, status, subtotal, total, item_count,
    cancel_reason, cancelled_by, ordered_at, paid_at, queued_at, completed_at,
    served_at, events)
  values (
    new.id, new.order_number, new.table_number, new.status, new.subtotal, new.total,
    (select coalesce(sum(qty), 0) from order_items
      where order_id = new.id and status = 'active'),
    new.cancel_reason, new.cancelled_by, new.created_at, new.paid_at, new.queued_at,
    new.completed_at, new.served_at,
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
       from order_events e where e.order_id = new.id))
  on conflict (order_id) do update set
    status        = excluded.status,
    subtotal      = excluded.subtotal,
    total         = excluded.total,
    item_count    = excluded.item_count,
    served_at     = excluded.served_at,
    cancel_reason = excluded.cancel_reason,
    events        = excluded.events
  returning id into rec_id;

  delete from sales_record_items where record_id = rec_id;
  insert into sales_record_items
    (record_id, menu_item_id, name, price, qty, status, line_total)
  select rec_id, oi.menu_item_id, oi.name, oi.price, oi.qty, oi.status,
         case when oi.status = 'active' then oi.price * oi.qty else 0 end
    from order_items oi where oi.order_id = new.id;

  return new;
end $$;

-- 'served_at' ikut dipantau: waiter menandai "sudah diantar" SETELAH status
-- done, jadi trigger yang hanya memantau kolom status akan melewatkannya.
drop trigger if exists orders_archive on orders;
create trigger orders_archive
  after update of status, served_at on orders
  for each row when (new.status in ('done', 'cancelled'))
  execute function archive_order();

-- ---------- rekap ----------
-- security_invoker WAJIB: tanpa itu view mengabaikan RLS tabel di bawahnya
-- dan angka penjualan bocor ke pengunjung.
create or replace view daily_sales with (security_invoker = on) as
select (coalesce(completed_at, archived_at) at time zone 'Asia/Jakarta')::date as day,
       count(*) filter (where status = 'done')                     as orders_done,
       count(*) filter (where status = 'cancelled')                as orders_cancelled,
       coalesce(sum(total)      filter (where status = 'done'), 0) as revenue,
       coalesce(sum(item_count) filter (where status = 'done'), 0) as items_sold
  from sales_records
 group by 1
 order by 1 desc;

create or replace view menu_sales with (security_invoker = on) as
select i.name,
       sum(i.qty)        as qty_sold,
       sum(i.line_total) as revenue
  from sales_record_items i
  join sales_records r on r.id = i.record_id
 where r.status = 'done' and i.status = 'active'
 group by i.name
 order by qty_sold desc;

-- ---------- RLS: append-only, tanpa pintu untuk pengunjung ----------
alter table sales_records      enable row level security;
alter table sales_record_items enable row level security;

drop policy if exists "staff read sales" on sales_records;
create policy "staff read sales" on sales_records
  for select using (current_staff_role() is not null);

drop policy if exists "staff read sales items" on sales_record_items;
create policy "staff read sales items" on sales_record_items
  for select using (current_staff_role() is not null);

-- Perhatikan yang TIDAK ditulis: tidak ada policy INSERT/UPDATE/DELETE untuk
-- siapa pun. Satu-satunya penulis adalah trigger archive_order() yang
-- security definer. Efeknya arsip praktis append-only bahkan untuk superuser
-- yang login — riwayat penjualan tidak bisa dirapikan diam-diam dari UI.
