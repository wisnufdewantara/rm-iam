-- ============================================================
--  RM-IAM — 0003_orders_lifecycle
--
--  Siklus hidup pesanan + jalur akses pengunjung.
--
--  KUNCI DESAIN: aplikasi TIDAK memakai secret key (PRD §7.1). Pengunjung
--  anonim tidak punya policy apa pun di `orders`, jadi semua yang mereka
--  butuhkan lewat fungsi `security definer` di bawah ini. Fungsi-fungsi ini
--  adalah satu-satunya pintu, dan tiap pintu memvalidasi sendiri.
--
--  Yang TIDAK boleh dipercaya dari klien: harga. Semua harga dan total
--  dihitung ulang di dalam create_order() dari tabel menu_items.
-- ============================================================

-- ============================================================
--  1. Transisi status: dikunci di DB, bukan hanya di UI
-- ============================================================
create or replace function enforce_order_transition() returns trigger
language plpgsql as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending_payment' and new.status in ('paid', 'cancelled')) or
    (old.status = 'paid'            and new.status in ('queued', 'cancelled')) or
    (old.status = 'queued'          and new.status in ('done', 'cancelled'))
  ) then
    raise exception 'Transisi status tidak sah: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

-- Stempel waktu + expires_at diisi otomatis, supaya tidak ada jalur kode
-- yang bisa lupa mengisinya.
create or replace function stamp_order_status() returns trigger
language plpgsql
set search_path = public
as $$
declare ttl int;
begin
  new.updated_at := now();

  if new.status is distinct from old.status then
    select order_ttl_hours into ttl from settings where id = 1;
    ttl := coalesce(ttl, 12);

    if new.status = 'paid'   and new.paid_at   is null then new.paid_at   := now(); end if;
    if new.status = 'queued' and new.queued_at is null then new.queued_at := now(); end if;

    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
      new.expires_at   := now() + (ttl || ' hours')::interval;
    end if;

    if new.status = 'cancelled' then
      new.expires_at := now() + (ttl || ' hours')::interval;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists orders_enforce_transition on orders;
create trigger orders_enforce_transition
  before update of status on orders
  for each row execute function enforce_order_transition();

drop trigger if exists orders_stamp_status on orders;
create trigger orders_stamp_status
  before update on orders
  for each row execute function stamp_order_status();

-- ============================================================
--  2. Hitung ulang total dari order_items
--     Dipanggil setelah item berubah (mis. waiter membatalkan satu item),
--     supaya total tidak pernah dihitung di sisi aplikasi.
-- ============================================================
create or replace function recalc_order_total(p_order_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare s int;
begin
  select coalesce(sum(price * qty), 0) into s
    from order_items
   where order_id = p_order_id and status = 'active';

  update orders set subtotal = s, total = s, updated_at = now()
   where id = p_order_id;
end $$;

create or replace function order_items_recalc() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalc_order_total(coalesce(new.order_id, old.order_id));
  return null;
end $$;

drop trigger if exists order_items_after_change on order_items;
create trigger order_items_after_change
  after insert or update or delete on order_items
  for each row execute function order_items_recalc();

-- ============================================================
--  3. create_order — satu-satunya cara pengunjung membuat pesanan
--
--     p_items: [{"menu_item_id":"uuid","qty":2,"note":"Pedas"}, ...]
--     Satu elemen = satu VARIAN (item + catatan). Lihat PRD §4.1.1.
--
--     p_confirm: peringatan lunak (duplikat / meja padat) TIDAK memblokir.
--     Kalau terdeteksi dan p_confirm = false, fungsi memulangkan
--     {needs_confirm:true, reason:...} tanpa membuat apa pun. Klien
--     menampilkan peringatan, pengunjung menekan "Ya, lanjut", panggil lagi
--     dengan p_confirm = true. Peringatan, bukan penolakan (PRD §3.1.1).
-- ============================================================
create or replace function create_order(
  p_table_number  text,
  p_customer_name text,
  p_guest_token   uuid,
  p_items         jsonb,
  p_confirm       boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg              settings%rowtype;
  v_order_id       uuid;
  v_order_number   text;
  v_total          int := 0;
  v_last_at        timestamptz;
  v_paid_last_hour int;
  v_sig            text;
  v_dup_number     text;
  v_same_table     int;
  it               jsonb;
  v_item           menu_items%rowtype;
  v_qty            int;
  v_note           text;
begin
  select * into cfg from settings where id = 1;

  -- ---- validasi bentuk ----
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Terlalu banyak baris pesanan.' using errcode = 'check_violation';
  end if;

  p_table_number  := btrim(coalesce(p_table_number, ''));
  p_customer_name := btrim(coalesce(p_customer_name, ''));

  if p_table_number = '' then
    raise exception 'Nomor meja belum diisi.' using errcode = 'check_violation';
  end if;
  if cfg.ask_customer_name and p_customer_name = '' then
    raise exception 'Nama belum diisi.' using errcode = 'check_violation';
  end if;

  -- ---- nomor meja harus terdaftar (mode 'marker') ----
  if cfg.identity_mode = 'marker' then
    if not exists (
      select 1 from table_markers
       where number = p_table_number and is_active
    ) then
      raise exception 'Penanda nomor % tidak terdaftar.', p_table_number
        using errcode = 'check_violation';
    end if;
  end if;

  -- ---- pengaman penyalahgunaan: PENOLAKAN, bukan peringatan ----
  -- Di demo ini pembayaran mockup, jadi tidak ada friksi alami yang mencegah
  -- seseorang membanjiri layar dapur. Angkanya jauh di atas perilaku wajar.
  select max(created_at) into v_last_at
    from orders where guest_token = p_guest_token;

  if v_last_at is not null
     and now() - v_last_at < (cfg.guest_order_rate_limit_secs || ' seconds')::interval then
    raise exception 'Terlalu cepat. Tunggu % detik sebelum memesan lagi.',
      cfg.guest_order_rate_limit_secs using errcode = 'check_violation';
  end if;

  select count(*) into v_paid_last_hour
    from orders
   where guest_token = p_guest_token
     and status <> 'pending_payment'
     and created_at > now() - interval '1 hour';

  if v_paid_last_hour >= cfg.guest_paid_orders_per_hour then
    raise exception 'Batas pesanan per jam tercapai.' using errcode = 'check_violation';
  end if;

  -- ---- peringatan lunak: duplikat & meja padat ----
  if not p_confirm then
    -- tanda tangan keranjang, supaya "keranjang identik" bisa dibandingkan
    select string_agg(
             (e->>'menu_item_id') || 'x' || (e->>'qty') || '|' ||
             coalesce(btrim(e->>'note'), ''), ',' order by e->>'menu_item_id', e->>'note')
      into v_sig
      from jsonb_array_elements(p_items) e;

    select o.order_number into v_dup_number
      from orders o
     where o.guest_token = p_guest_token
       and o.table_number = p_table_number
       and o.created_at > now() - (cfg.duplicate_window_secs || ' seconds')::interval
       and (
         select string_agg(
                  oi.menu_item_id::text || 'x' || oi.qty || '|' || coalesce(oi.note, ''),
                  ',' order by oi.menu_item_id::text, oi.note)
           from order_items oi
          where oi.order_id = o.id and oi.status = 'active'
       ) = v_sig
     order by o.created_at desc
     limit 1;

    if v_dup_number is not null then
      return jsonb_build_object(
        'needs_confirm', true,
        'reason', 'duplicate',
        'order_number', v_dup_number
      );
    end if;

    select count(*) into v_same_table
      from orders
     where table_number = p_table_number
       and status in ('paid', 'queued');

    if v_same_table >= cfg.same_table_warn_threshold then
      return jsonb_build_object(
        'needs_confirm', true,
        'reason', 'busy_table',
        'active_count', v_same_table
      );
    end if;
  end if;

  -- ---- buat pesanan ----
  v_order_number := next_order_number();

  insert into orders (order_number, table_number, customer_name, guest_token, status)
  values (v_order_number, p_table_number, p_customer_name, p_guest_token, 'pending_payment')
  returning id into v_order_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_item
      from menu_items
     where id = (it->>'menu_item_id')::uuid and is_available;

    if not found then
      raise exception 'Menu tidak tersedia lagi. Silakan periksa pesanan Anda.'
        using errcode = 'check_violation';
    end if;

    v_qty := greatest(1, least(99, coalesce((it->>'qty')::int, 1)));
    v_note := nullif(btrim(coalesce(it->>'note', '')), '');

    -- HARGA DIAMBIL DARI DB, bukan dari klien.
    insert into order_items (order_id, menu_item_id, name, price, qty, note)
    values (v_order_id, v_item.id, v_item.name, v_item.price, v_qty, v_note);

    v_total := v_total + v_item.price * v_qty;
  end loop;

  -- trigger order_items_after_change sudah menghitung total; ini penegasan
  perform recalc_order_total(v_order_id);

  insert into order_events (order_id, actor_role, action, to_status, detail)
  values (v_order_id, 'guest', 'create', 'pending_payment',
          jsonb_build_object('table', p_table_number, 'lines', jsonb_array_length(p_items)));

  return jsonb_build_object(
    'needs_confirm', false,
    'order_number', v_order_number,
    'total', v_total
  );
end $$;

-- ============================================================
--  4. mark_order_paid — pembayaran MOCKUP
--     Diganti webhook Xendit nanti; state machine tidak berubah.
-- ============================================================
create or replace function mark_order_paid(
  p_order_number text,
  p_guest_token  uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare o orders%rowtype;
begin
  select * into o from orders where order_number = p_order_number;
  if not found then
    raise exception 'Pesanan tidak ditemukan.' using errcode = 'no_data_found';
  end if;
  if o.guest_token <> p_guest_token then
    raise exception 'Pesanan ini bukan milik Anda.' using errcode = 'insufficient_privilege';
  end if;

  -- Idempoten: tombol ditekan dua kali tidak membuat pembayaran ganda.
  if o.status <> 'pending_payment' then
    return jsonb_build_object('order_number', o.order_number, 'status', o.status);
  end if;

  insert into payments (order_id, provider, method, amount, status, paid_at)
  values (o.id, 'mock', 'mock', o.total, 'paid', now());

  update orders set status = 'paid' where id = o.id;

  insert into order_events (order_id, actor_role, action, from_status, to_status)
  values (o.id, 'system', 'pay', 'pending_payment', 'paid');

  return jsonb_build_object('order_number', o.order_number, 'status', 'paid');
end $$;

-- ============================================================
--  5. get_order_status — dipakai halaman tunggu (polling)
--
--     Tampilan PUBLIK (tanpa token cocok): status, meja, jumlah item, posisi
--     antrean, nama disingkat. Disengaja — orang lain di meja atau staf boleh
--     melihat status dari layar mana pun, dan tidak ada data sensitif di sini.
--     Tampilan PENUH (token cocok): rincian item & harga.
-- ============================================================
create or replace function get_order_status(
  p_order_number text,
  p_guest_token  uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o      orders%rowtype;
  v_mine boolean;
  v_pos  int;
  v_items jsonb;
begin
  select * into o from orders where order_number = p_order_number;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  -- expires_at ditegakkan DI SINI, tidak mengandalkan cron sudah jalan.
  -- Cron itu kebersihan penyimpanan, bukan penegak aturan (PRD §6.3).
  if o.expires_at is not null and o.expires_at < now() then
    return jsonb_build_object('found', false, 'expired', true);
  end if;

  v_mine := (p_guest_token is not null and o.guest_token = p_guest_token);

  select count(*) into v_pos
    from orders x
   where x.status in ('paid', 'queued')
     and x.created_at < o.created_at;

  if v_mine then
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', oi.name, 'price', oi.price, 'qty', oi.qty,
             'note', oi.note, 'status', oi.status
           ) order by oi.name, oi.note), '[]'::jsonb)
      into v_items
      from order_items oi where oi.order_id = o.id;
  end if;

  return jsonb_build_object(
    'found', true,
    'order_number', o.order_number,
    'table_number', o.table_number,
    'status', o.status,
    'customer_short',
      case when o.customer_name = '' then ''
           else split_part(o.customer_name, ' ', 1) ||
                case when position(' ' in o.customer_name) > 0
                     then ' ' || left(split_part(o.customer_name, ' ', 2), 1) || '.'
                     else '' end
      end,
    'item_count', (select coalesce(sum(qty), 0) from order_items
                    where order_id = o.id and status = 'active'),
    'total', o.total,
    'queue_position', v_pos,
    'cancel_reason', o.cancel_reason,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'queued_at', o.queued_at,
    'completed_at', o.completed_at,
    'expires_at', o.expires_at,
    'mine', v_mine,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end $$;

-- ============================================================
--  6. list_my_orders — "Pesanan saya", hanya milik token itu
-- ============================================================
create or replace function list_my_orders(p_guest_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'order_number', o.order_number,
           'table_number', o.table_number,
           'status', o.status,
           'total', o.total,
           'created_at', o.created_at
         ) order by o.created_at desc), '[]'::jsonb)
    into v
    from orders o
   where o.guest_token = p_guest_token
     and (o.expires_at is null or o.expires_at > now());
  return v;
end $$;

-- ============================================================
--  7. Hak akses fungsi
--     Fungsi security definer di atas adalah SATU-SATUNYA pintu pengunjung.
--     Tabelnya sendiri tetap tertutup oleh RLS.
-- ============================================================
grant execute on function create_order(text, text, uuid, jsonb, boolean) to anon, authenticated;
grant execute on function mark_order_paid(text, uuid)                    to anon, authenticated;
grant execute on function get_order_status(text, uuid)                   to anon, authenticated;
grant execute on function list_my_orders(uuid)                           to anon, authenticated;

revoke execute on function recalc_order_total(uuid) from anon, authenticated;
revoke execute on function next_order_number()      from anon, authenticated;

-- ============================================================
--  8. Kebersihan penyimpanan (pg_cron)
--     TTL sudah ditegakkan get_order_status(); ini hanya membuang barisnya.
-- ============================================================
select cron.unschedule('rmiam-purge-expired')   where exists (
  select 1 from cron.job where jobname = 'rmiam-purge-expired');
select cron.unschedule('rmiam-purge-abandoned') where exists (
  select 1 from cron.job where jobname = 'rmiam-purge-abandoned');

select cron.schedule('rmiam-purge-expired', '7 * * * *', $cron$
  delete from orders where expires_at is not null and expires_at < now();
$cron$);

select cron.schedule('rmiam-purge-abandoned', '17 * * * *', $cron$
  delete from orders
   where status = 'pending_payment' and created_at < now() - interval '2 hours';
$cron$);
