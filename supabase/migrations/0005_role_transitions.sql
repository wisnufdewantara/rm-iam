-- ============================================================
--  RM-IAM — 0005_role_transitions
--
--  Dua hal: pengetatan siapa boleh memindahkan status, dan Realtime.
--
--  KENAPA PERLU DIKETATKAN
--  Policy RLS untuk UPDATE di orders sudah membatasi SIAPA yang boleh menulis,
--  tapi tidak bisa membatasi KE STATUS MANA dengan tepat: WITH CHECK hanya
--  melihat baris hasil, tidak tahu status sebelumnya. Akibatnya waiter secara
--  teknis masih bisa memajukan pesanan ke 'queued' — pekerjaan dapur.
--
--  Trigger transisi tahu OLD dan NEW sekaligus, jadi di sinilah aturan peran
--  ditegakkan. Hasilnya: aturan "hanya waiter yang boleh membatalkan" dan
--  "hanya dapur yang boleh mengantre/menyelesaikan" berlaku di DATABASE, bukan
--  hanya karena tombolnya disembunyikan di UI.
-- ============================================================

create or replace function enforce_order_transition() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r staff_role;
begin
  if new.status = old.status then
    return new;
  end if;

  -- null = bukan staf (pengunjung lewat RPC security definer, atau sistem)
  r := current_staff_role();

  -- ---- transisi yang sah ----
  if not (
    (old.status = 'pending_payment' and new.status in ('paid', 'cancelled')) or
    (old.status = 'paid'            and new.status in ('queued', 'cancelled')) or
    (old.status = 'queued'          and new.status in ('done', 'cancelled'))
  ) then
    raise exception 'Transisi status tidak sah: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- ---- siapa boleh melakukannya ----
  if new.status in ('queued', 'done') then
    if r is null or r not in ('kitchen', 'superuser') then
      raise exception 'Hanya dapur yang boleh mengubah pesanan ke %.', new.status
        using errcode = 'insufficient_privilege';
    end if;

  elsif new.status = 'cancelled' then
    -- Diminta eksplisit: pembatalan HANYA lewat waiter (PRD §2).
    if r is null or r not in ('waiter', 'superuser') then
      raise exception 'Pembatalan hanya bisa dilakukan oleh waiter.'
        using errcode = 'insufficient_privilege';
    end if;

  elsif new.status = 'paid' then
    -- Dibayar dilakukan pengunjung lewat mark_order_paid() (security definer,
    -- current_staff_role() null di sana). Staf non-superuser tidak berkepentingan.
    if r is not null and r <> 'superuser' then
      raise exception 'Staf tidak boleh menandai pesanan sebagai dibayar.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end $$;

-- ============================================================
--  Realtime untuk layar staf.
--  Halaman tunggu pengunjung TIDAK memakai ini — dia polling, karena diakses
--  anonim (PRD §5). Yang di sini sudah terautentikasi, jadi RLS-nya lugas.
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table order_items;
  exception when duplicate_object then null;
  end;
end $$;
