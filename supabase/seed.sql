-- ============================================================
--  RM-IAM — data contoh untuk demo/dev.
--  BUKAN bagian dari migrasi. Jangan dijalankan di database yang
--  sudah punya data sungguhan.
--
--  Semua nilai di sini bisa diubah lewat dashboard superuser tanpa
--  deploy — itu memang intinya (PRD §14).
-- ============================================================

-- ---------- penanda meja ----------
-- 12 penanda dine-in + 3 penanda takeaway, meniru satu set standee.
insert into table_markers (number, label, kind) values
  ('1',  'Standee', 'dine_in'), ('2',  'Standee', 'dine_in'),
  ('3',  'Standee', 'dine_in'), ('4',  'Standee', 'dine_in'),
  ('5',  'Standee', 'dine_in'), ('6',  'Standee', 'dine_in'),
  ('7',  'Standee', 'dine_in'), ('8',  'Standee', 'dine_in'),
  ('9',  'Standee', 'dine_in'), ('10', 'Standee', 'dine_in'),
  ('11', 'Standee', 'dine_in'), ('12', 'Standee', 'dine_in'),
  ('TA-1', 'Bungkus', 'takeaway'),
  ('TA-2', 'Bungkus', 'takeaway'),
  ('TA-3', 'Bungkus', 'takeaway')
on conflict (number) do nothing;

-- ---------- kategori ----------
-- 'Paket Hemat' & 'Tambahan' SENGAJA dibiarkan kosong: membuktikan cincin
-- dial dan dashboard superuser benar-benar data-driven, bukan hardcoded.
insert into categories (slug, name, icon_name, position) values
  ('makanan',     'Makanan',     'ramen_dining', 1),
  ('minuman',     'Minuman',     'local_cafe',   2),
  ('cemilan',     'Cemilan',     'lunch_dining', 3),
  ('paket-hemat', 'Paket Hemat', 'redeem',       4),
  ('tambahan',    'Tambahan',    'add_circle',   5)
on conflict (slug) do nothing;

-- ---------- item menu ----------
insert into menu_items (category_id, name, description, price, icon_name, position)
select c.id, v.name, v.description, v.price, v.icon_name, v.position
  from (values
    ('makanan', 'Nasi Goreng', 'Nasi goreng spesial dengan telur dan acar', 15000, 'rice_bowl',    1),
    ('makanan', 'Mie Goreng',  'Mie goreng bumbu pedas manis',              15000, 'ramen_dining', 2),
    ('minuman', 'Es Teh',      'Es teh manis segar',                         5000, 'local_cafe',   1),
    ('minuman', 'Air Mineral', 'Air mineral dingin 600ml',                   5000, 'water_drop',   2),
    ('cemilan', 'Fried Fries', 'Kentang goreng renyah dengan saus',         12000, 'lunch_dining', 1)
  ) as v(cat_slug, name, description, price, icon_name, position)
  join categories c on c.slug = v.cat_slug
 where not exists (
   select 1 from menu_items m where m.name = v.name and m.category_id = c.id
 );

-- ---------- settings ----------
update settings set
  brand_name = 'RM-IAM',
  accent     = '#f97316',
  hint_text  = 'Ketuk kategori untuk melihat menu'
 where id = 1;
