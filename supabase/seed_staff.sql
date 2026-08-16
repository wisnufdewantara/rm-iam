-- ============================================================
--  RM-IAM — akun staf demo.
--
--  Jalankan SETELAH membuat ketiga user di
--  Supabase → Authentication → Users → Add user (centang Auto Confirm):
--      dapur@demo.local
--      waiter@demo.local
--      admin@demo.local
--
--  Skrip ini mencocokkan lewat EMAIL, jadi tidak perlu menyalin UUID
--  satu per satu — dan tidak ada password yang lewat sini sama sekali.
--
--  Aman dijalankan ulang.
-- ============================================================

insert into staff (id, name, role)
select u.id, v.name, v.role::staff_role
  from (values
    ('dapur@demo.local',  'Dapur Demo',  'kitchen'),
    ('waiter@demo.local', 'Waiter Demo', 'waiter'),
    ('admin@demo.local',  'Admin Demo',  'superuser')
  ) as v(email, name, role)
  join auth.users u on lower(u.email) = v.email
on conflict (id) do update set
  name      = excluded.name,
  role      = excluded.role,
  is_active = true;

-- Periksa hasilnya: harus 3 baris. Kalau kurang, berarti ada email yang
-- belum dibuat di Authentication → Users (atau ejaannya beda).
select s.role, s.name, u.email, s.is_active
  from staff s join auth.users u on u.id = s.id
 order by s.role;
