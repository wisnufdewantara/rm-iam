-- ============================================================
--  RM-IAM — data contoh untuk demo/dev.
--
--  Menu ditranskrip dari papan menu "Nasi Goreng Malang" (foto referensi):
--  ±60 item di 7 kategori. Sengaja memakai menu sungguhan, bukan 5 item
--  mainan — karena beban nyatanya (18 nasi goreng dalam satu kategori) yang
--  memaksa dial dipaginasi dan label dipendekkan.
--
--  BUKAN bagian dari migrasi. Semua nilai di sini bisa diubah lewat dashboard
--  superuser tanpa deploy — itu memang intinya (PRD §14).
-- ============================================================

-- Pengaman: seed ini MENGGANTI seluruh menu. Kalau sudah ada pesanan, berarti
-- ini bukan database kosong lagi dan penggantian massal bisa merusak riwayat.
do $$
begin
  if exists (select 1 from orders) then
    raise exception
      'Batal: sudah ada pesanan di database. Seed ini mengganti seluruh menu. Hapus manual kalau memang diinginkan.';
  end if;
end $$;

delete from menu_items;
delete from categories;

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
-- note_presets per kategori: "pedas" untuk makanan, "tanpa es" untuk minuman.
insert into categories (slug, name, icon_name, position, note_presets) values
  ('nasi-goreng',    'Nasi Goreng',    'rice_bowl',     1,
    '["Pedas","Tidak pedas","Sedikit garam","Tanpa sambal","Tanpa bawang","Tanpa kecap"]'),
  ('mie',            'Mie',            'ramen_dining',  2,
    '["Pedas","Tidak pedas","Tanpa sayur","Tanpa bawang","Sedikit garam"]'),
  ('chinese-food',   'Chinese Food',   'set_meal',      3,
    '["Pedas","Tidak pedas","Tanpa bawang","Sedikit garam"]'),
  ('minuman-dingin', 'Minuman Dingin', 'local_bar',     4,
    '["Tanpa es","Sedikit es","Tanpa gula","Sedikit gula"]'),
  ('juice',          'Juice',          'blender',       5,
    '["Tanpa gula","Sedikit gula","Tanpa susu","Tanpa es"]'),
  ('minuman-panas',  'Minuman Panas',  'local_cafe',    6,
    '["Tanpa gula","Sedikit gula","Kental","Tidak terlalu panas"]'),
  ('tambahan',       'Tambahan',       'egg',           7, null);

-- ---------- item menu ----------
insert into menu_items (category_id, name, description, price, icon_name, position)
select c.id, v.name, v.description, v.price, v.icon_name, v.position
  from (values
    -- ===== Nasi Goreng (18) =====
    ('nasi-goreng', 'Nasi Goreng Ayam',            'Nasi goreng dengan ayam',              13000, 'rice_bowl',  1),
    ('nasi-goreng', 'Nasi Goreng Merah',           'Nasi goreng saus merah',               13000, 'rice_bowl',  2),
    ('nasi-goreng', 'Nasi Goreng Malang',          'Nasi goreng khas Malang',              13000, 'rice_bowl',  3),
    ('nasi-goreng', 'Nasi Goreng Soss',            'Nasi goreng saus spesial',             14000, 'rice_bowl',  4),
    ('nasi-goreng', 'Nasi Goreng Pedas',           'Nasi goreng level pedas',              14000, 'local_fire_department', 5),
    ('nasi-goreng', 'Nasi Goreng Malang Pedas',    'Nasi goreng Malang versi pedas',       14000, 'local_fire_department', 6),
    ('nasi-goreng', 'Nasi Goreng Mawut',           'Nasi goreng campur mie',               15000, 'ramen_dining', 7),
    ('nasi-goreng', 'Nasi Goreng Ikan Asin',       'Nasi goreng dengan ikan asin',         16000, 'set_meal',   8),
    ('nasi-goreng', 'Nasi Goreng Hong Kong',       'Nasi goreng gaya Hong Kong',           17000, 'rice_bowl',  9),
    ('nasi-goreng', 'Nasi Goreng Barbeque',        'Nasi goreng saus barbeque',            17000, 'outdoor_grill', 10),
    ('nasi-goreng', 'Nasi Goreng Jawa',            'Nasi goreng bumbu Jawa',               17000, 'rice_bowl',  11),
    ('nasi-goreng', 'Nasi Goreng Pete',            'Nasi goreng dengan pete',              17000, 'nutrition',  12),
    ('nasi-goreng', 'Nasi Goreng Pete Ikan Asin',  'Nasi goreng pete dan ikan asin',       19000, 'set_meal',   13),
    ('nasi-goreng', 'Nasi Goreng Jawa Spesial',    'Nasi goreng Jawa porsi spesial',       20000, 'rice_bowl',  14),
    ('nasi-goreng', 'Nasi Goreng Spesial',         'Nasi goreng dengan topping lengkap',   20000, 'rice_bowl',  15),
    ('nasi-goreng', 'Nasi Goreng Seafood',         'Nasi goreng dengan seafood',           20000, 'set_meal',   16),
    ('nasi-goreng', 'Nasi Goreng Udang',           'Nasi goreng dengan udang',             20000, 'set_meal',   17),
    ('nasi-goreng', 'Nasi Goreng Pattayya',        'Nasi goreng dibungkus telur dadar',    20000, 'egg',        18),

    -- ===== Mie (10) =====
    ('mie', 'Mie Goreng',              'Mie goreng bumbu spesial',        14000, 'ramen_dining', 1),
    ('mie', 'Bihun Goreng',            'Bihun goreng bumbu spesial',      14000, 'ramen_dining', 2),
    ('mie', 'Kwe Tiauw Goreng',        'Kwetiau goreng',                  15000, 'ramen_dining', 3),
    ('mie', 'Mie Goreng Spesial',      'Mie goreng topping lengkap',      17000, 'ramen_dining', 4),
    ('mie', 'Bihun Goreng Spesial',    'Bihun goreng topping lengkap',    17000, 'ramen_dining', 5),
    ('mie', 'Mie Cap Cay',             'Mie dengan cap cay',              18000, 'ramen_dining', 6),
    ('mie', 'Mie Kuah',                'Mie dengan kuah kaldu',           18000, 'soup_kitchen', 7),
    ('mie', 'Kwe Tiauw Spesial',       'Kwetiau topping lengkap',         18000, 'ramen_dining', 8),
    ('mie', 'Kwe Tiauw Siram',         'Kwetiau dengan kuah siram',       18000, 'soup_kitchen', 9),
    ('mie', 'Ifu Mie / Ta Mie',        'Ifumie atau tamie',               20000, 'ramen_dining', 10),

    -- ===== Chinese Food (11) =====
    ('chinese-food', 'Cap Cay',                  'Aneka sayur tumis',            18000, 'set_meal',  1),
    ('chinese-food', 'Cap Cay + Nasi',           'Cap cay dengan nasi putih',    19000, 'set_meal',  2),
    ('chinese-food', 'Fuyung Hai',               'Telur dadar saus asam manis',  20000, 'egg',       3),
    ('chinese-food', 'Ayam Lada Hitam',          'Ayam saus lada hitam',         22000, 'set_meal',  4),
    ('chinese-food', 'Ayam Cah Jamur',           'Ayam tumis jamur',             22000, 'set_meal',  5),
    ('chinese-food', 'Ayam Lada Hitam + Nasi',   'Ayam lada hitam dengan nasi',  23000, 'set_meal',  6),
    ('chinese-food', 'Ayam Cah Jamur + Nasi',    'Ayam cah jamur dengan nasi',   23000, 'set_meal',  7),
    ('chinese-food', 'Ayam Goreng Saus Mentega', 'Ayam goreng saus mentega',     25000, 'set_meal',  8),
    ('chinese-food', 'Koloke',                   'Ayam asam manis koloke',       25000, 'set_meal',  9),
    ('chinese-food', 'Cumi Goreng Tepung',       'Cumi goreng tepung renyah',    25000, 'set_meal', 10),
    ('chinese-food', 'Udang Goreng Tepung',      'Udang goreng tepung renyah',   28000, 'set_meal', 11),

    -- ===== Minuman Dingin (13) =====
    ('minuman-dingin', 'Air Mineral',      'Air mineral dingin',        3000, 'water_drop',  1),
    ('minuman-dingin', 'Fruit Tea',        'Teh rasa buah',             4000, 'local_bar',   2),
    ('minuman-dingin', 'Teh Botol',        'Teh botol manis',           4000, 'local_bar',   3),
    ('minuman-dingin', 'Tebs',             'Soda teh berkarbonasi',     4000, 'local_bar',   4),
    ('minuman-dingin', 'Es Teh',           'Es teh manis',              4000, 'local_bar',   5),
    ('minuman-dingin', 'Coca Cola',        'Minuman berkarbonasi',      5000, 'local_bar',   6),
    ('minuman-dingin', 'Fanta',            'Minuman berkarbonasi',      5000, 'local_bar',   7),
    ('minuman-dingin', 'Es Lemon Tea',     'Es teh lemon',              5000, 'local_bar',   8),
    ('minuman-dingin', 'Es Jeruk',         'Es jeruk peras',            5000, 'local_bar',   9),
    ('minuman-dingin', 'Es Capp Cin',      'Es cappuccino cincau',      5000, 'local_cafe', 10),
    ('minuman-dingin', 'Es Cincao',        'Es cincau',                 5000, 'local_bar',  11),
    ('minuman-dingin', 'Es Milo',          'Es milo',                   6000, 'local_cafe', 12),
    ('minuman-dingin', 'Es Soda Gembira',  'Soda susu sirup',          10000, 'local_bar',  13),

    -- ===== Juice (7) =====
    ('juice', 'Juice Jambu',      'Jus jambu segar',           8000, 'blender', 1),
    ('juice', 'Juice Jeruk',      'Jus jeruk segar',           8000, 'blender', 2),
    ('juice', 'Juice Strawberry', 'Jus stroberi segar',        8000, 'blender', 3),
    ('juice', 'Juice Apel',       'Jus apel segar',            8000, 'blender', 4),
    ('juice', 'Juice Mangga',     'Jus mangga segar',          8000, 'blender', 5),
    ('juice', 'Juice Alpukat',    'Jus alpukat segar',         8000, 'blender', 6),
    ('juice', 'Juice Kombinasi',  'Kombinasi beberapa buah',   8000, 'blender', 7),

    -- ===== Minuman Panas (4) =====
    ('minuman-panas', 'Teh Hangat',    'Teh hangat manis',   3000, 'emoji_food_beverage', 1),
    ('minuman-panas', 'Jeruk Hangat',  'Jeruk peras hangat', 4000, 'emoji_food_beverage', 2),
    ('minuman-panas', 'Kopi',          'Kopi hitam',         5000, 'local_cafe',          3),
    ('minuman-panas', 'Milo',          'Milo hangat',        5000, 'local_cafe',          4),

    -- ===== Tambahan (3) =====
    ('tambahan', 'Telur Dadar / Ceplok', 'Telur dadar atau mata sapi', 3000, 'egg',        1),
    ('tambahan', 'Nasi Putih',           'Sepiring nasi putih',        3000, 'rice_bowl',  2),
    ('tambahan', 'Es Batu',              'Tambahan es batu',           1000, 'water_drop', 3)
  ) as v(cat_slug, name, description, price, icon_name, position)
  join categories c on c.slug = v.cat_slug;

-- ---------- settings ----------
update settings set
  brand_name = 'Nasi Goreng Malang',
  accent     = '#f97316',
  hint_text  = 'Ketuk kategori untuk melihat menu'
 where id = 1;
