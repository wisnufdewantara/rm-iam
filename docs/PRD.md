# PRD — RM-IAM

**Restaurant Ordering & Kitchen Display, konsep dial bulat-bulat**

| | |
|---|---|
| Versi | 0.1 (draft) |
| Tanggal | 12 Agustus 2026 |
| Penulis | Wisnu Dewantara |
| Status | Draft untuk implementasi |
| Konteks | Demo tes kerja. Deploy di Vercel Hobby + Supabase Free. |
| Referensi desain | https://porto-wfd.vercel.app/ (lokal: `~/projects/wisnu-cms`, lihat `styles/dial.css`) |

---

## 1. Ringkasan

RM-IAM adalah aplikasi pemesanan mandiri (self-order) untuk rumah makan / kedai kekinian bergaya Mi Gacoan. Satu basis kode dipakai untuk dua kanal:

1. **Smartphone pengunjung** — buka URL, masukkan nomor dari **penanda meja** yang sedang dipegang (standee/asbak bernomor), pesan sendiri.
2. **Anjungan pemesanan mandiri (kiosk)** — tablet/layar sentuh di dekat kasir, UI yang sama dengan target sentuh lebih besar.

Pembeda produknya adalah **UI dial**: satu lingkaran besar di tengah dan lingkaran-lingkaran kecil mengelilinginya. Tengah = nomor meja. Sekelilingnya = kategori menu. Pilih kategori → lingkaran itu terbang ke tengah dan cincinnya berganti jadi item menu kategori tersebut. Tiap lingkaran punya badge angka jumlah pesanan.

Untuk demo ini pembayaran **mockup** (belum Xendit), tapi struktur data dan alurnya disiapkan supaya integrasi asli tinggal ditempel.

### Kenapa proyek ini ada

**Portfolio dan tes kerja.** Itu tujuannya, dan itu yang menentukan anggaran: **semuanya pakai tier gratis, tanpa kecuali.** Vercel Hobby, Supabase Free, tanpa dependensi berbayar. Portfolio/demo memang penggunaan yang diizinkan di Hobby, jadi tidak ada yang perlu diakali.

PRD ini dioptimalkan untuk *dinilai*: alur end-to-end yang benar-benar jalan, state machine pesanan yang bersih, RLS yang tidak bocor, audit trail, dan satu halaman demo-script supaya reviewer bisa mencoba dalam 3 menit tanpa bertanya.

**Arah jangka panjangnya memang untuk dijual**, tapi itu hanya mempengaruhi **satu hal**: apa yang berbeda antar rumah makan dibuat jadi data, bukan kode — menu, kategori, isi cincin dial, warna aksen, teks, nomor meja, dan cara pengunjung mengidentifikasi mejanya. Daftar periksanya di §14. Ini gratis dikerjakan (cuma soal menaruh nilai di tabel alih-alih di file) dan **justru memperkuat porto**, karena yang terlihat adalah aplikasi yang bisa dikonfigurasi, bukan menu yang dipaku di kode.

Yang **tidak** dikerjakan sekarang: apa pun yang butuh infrastruktur berbayar, multi-tenant, atau perkakas operasional untuk melayani pelanggan sungguhan. Itu urusan nanti kalau memang ada yang beli.

### Yang bukan tujuan (out of scope v1)

- Integrasi payment gateway sungguhan (Xendit) — hanya *seam*-nya yang disiapkan.
- Cetak struk / printer thermal, KDS multi-station, inventory/stok, loyalty/poin.
- Laporan penjualan tingkat lanjut (grafik, ekspor CSV, filter rentang tanggal, laba kotor). Yang **masuk** v1: arsip riwayat penjualan permanen + rekap harian & per-item sederhana, hanya untuk staf (§6.4, §8).
- Multi-outlet / multi-tenant **secara implementasi** — v1 satu outlet. Tapi skemanya harus *kompatibel*: jalur upgrade-nya sudah dipetakan di §13, dan tidak boleh ada asumsi single-outlet yang tertanam di logika (§14).
- Mode identitas selain penanda meja (QR per meja, nomor antrean tanpa meja) — *seam*-nya disiapkan sebagai `settings.identity_mode`, implementasinya belakangan (§3.1.2).
- Aplikasi native, PWA offline-first.
- Fitur superuser di luar CRUD menu + konfigurasi dial (halaman "edit halaman" dibatasi ke konfigurasi dial + teks statis, bukan page builder penuh).

---

## 2. Pengguna & peran

Empat peran. Fokus pengerjaan v1: **user, waiter, kitchen**. Superuser dibuat secukupnya untuk mengisi menu dan mengatur dial (kalau menu tidak bisa diisi, demo tidak bisa jalan).

| Peran | Login? | Bisa apa |
|---|---|---|
| **User** (pengunjung) | Tidak. Identitas = nomor meja + nama. | Lihat menu, susun pesanan, checkout, bayar (mock), lihat halaman tunggu |
| **Waiter** | Ya | Lihat semua pesanan aktif (dikelompokkan per meja), **batalkan item atau seluruh pesanan** (satu-satunya peran yang boleh), tandai sudah diantar, lihat riwayat penjualan |
| **Kitchen** | Ya | Lihat semua pesanan, klik **Antrekan**, klik **Selesai**, lihat riwayat penjualan. Tidak boleh membatalkan. |
| **Superuser** | Ya | Semua akses + CRUD kategori & menu, konfigurasi dial, kelola meja, kelola akun staf, monitor pesanan, riwayat penjualan |

**Riwayat penjualan tidak pernah terlihat oleh pengunjung.** Ini dijaga di level database (tidak ada policy RLS untuk `anon`), bukan cuma dengan menyembunyikan tautannya — detail di §6.4 dan §7.

### Aturan pembatalan (penting, diminta eksplisit)

Pengunjung **tidak bisa** membatalkan sendiri setelah bayar. Di UI user harus ada pengingat permanen:

> **Pesanan sudah dibayar tidak bisa diubah atau dibatalkan sendiri.** Butuh perubahan? Panggil waiter kami.

Tempat munculnya pengingat:
- Di section checkout, di atas tombol *Lanjut Pembayaran* (sebagai peringatan sebelum commit).
- Di halaman pembayaran, dekat tombol bayar.
- Di halaman tunggu, sebagai baris info tetap di bawah animasi.

Sebelum bayar, user bebas mengedit/menghapus item — keranjang masih di sisi klien.

---

## 3. Alur utama

### 3.1 Alur user (happy path)

```
Buka /  (smartphone atau kiosk)
  │
  ├─ Layar masuk: input NOMOR MEJA + NAMA  →  Konfirmasi
  │     nomor DIBACA dari penanda fisik yang dipegang pengunjung (§3.1.2)
  │     kiosk: numpad besar; smartphone: numpad numerik (inputMode="numeric")
  ▼
Dial  ── tengah = nomor meja, cincin = kategori
  │      pilih kategori → kategori pindah ke tengah, cincin = item menu
  │      tap item → popover: harga, deskripsi, stepper qty, catatan
  │      badge angka muncul di lingkaran item & lingkaran kategori
  │
  │  ── scroll ke bawah, dipisah SEPARATOR ──
  ▼
Section Checkout (di halaman yang sama)
  │      daftar pesanan, edit qty, hapus item, subtotal
  │      pengingat "tidak bisa dibatalkan sendiri setelah bayar"
  │      [ Lanjut Pembayaran ]  → order dibuat, status pending_payment
  ▼
/bayar/[nomor-pesanan]   (MOCKUP)
  │      ringkasan tak-bisa-diedit, tombol [ Kembali & Edit ] masih aktif
  │      [ Bayar Sekarang ] → spinner 2s → status paid
  ▼
/pesanan/[nomor-pesanan]   halaman tunggu, dinamis per nomor pesanan
         animasi menunggu (dial berputar), langkah: Dibayar → Diantre → Selesai
         auto-refresh; saat Selesai → tampilan "Pesanan siap!"
         halaman hidup 12 jam setelah selesai, lalu hilang (410)
```

### 3.1.1 Nambah pesanan di meja yang sama

Satu meja boleh punya **banyak pesanan aktif sekaligus** — realistis: satu orang pesan dulu, temannya nyusul, atau nambah es teh di tengah makan.

Aturannya:

- Setiap tambahan = **order baru dengan nomor sendiri**, bukan menempel ke order lama. Order yang sudah dibayar itu terkunci (§2), jadi menambah item ke dalamnya akan melanggar aturan pembatalan dan merusak jejak audit.
- Di halaman tunggu ada tombol **[ Pesan Lagi ]** → balik ke `/` dengan nomor meja & nama sudah terisi, keranjang kosong. Tidak perlu isi ulang.
- `/pesanan-saya` menampilkan semua pesanan dari `guest_token` yang sama, terbaru di atas, masing-masing dengan statusnya.
- **Pengunjung hanya melihat pesanannya sendiri**, bukan semua pesanan di mejanya — orang asing bisa saja mengetik nomor meja 12 juga. Pengelompokan per meja adalah fitur staf.
- **Tidak ada batas keras jumlah pesanan per meja.** Keluarga berisi 6 orang yang pesan bergiliran itu perilaku normal, bukan penyalahgunaan — batas keras akan memblokir pelanggan yang benar demi mencegah kesalahan yang jarang.

Konsekuensi untuk staf: layar dapur dan waiter **mengelompokkan per meja**, supaya makanan satu meja bisa keluar bersamaan dan tidak ada pesanan yang tertinggal.

#### Pengaman salah nomor meja & pesanan ganda

Batas keras ditolak, tapi bukan berarti tanpa pengaman. Masalahnya perlu dipisah dulu, karena obatnya beda:

**(a) Salah ketik nomor meja** — makanan sampai ke meja yang salah. Ini yang paling merugikan, **tapi risikonya lebih kecil daripada yang terlihat** karena pengunjung sedang **menyalin angka dari benda di depannya** (§3.1.2), bukan mengingat-ingat. Salah salin itu jauh lebih jarang daripada salah ingat.

1. **Konfirmasi menampilkan nomor besar** sebelum lanjut — nomor meja dicetak sebesar mungkin di layar konfirmasi supaya pengunjung bisa membandingkannya langsung dengan penandanya. Ini pertahanan pertama yang paling murah dan paling cocok untuk model penanda fisik.
2. **Validasi ke `table_markers` yang aktif.** Menangkap nomor yang tidak ada (99, 0, salah ketik jadi 112) — dan validasinya bermakna justru karena himpunan nomornya terbatas pada penanda yang benar-benar dimiliki rumah makan. Tidak menangkap "salah tapi valid" (maksud 12 ketik 13).
3. **Pertahanan terakhir itu manusia:** waiter mengantar ke meja yang memegang penanda 13, lalu tahu meja itu tidak memesan apa pun. Karena itu `/waiter` dikelompokkan per meja — anomali jadi kelihatan. Ini yang benar-benar menyelamatkan di lapangan, bukan validasi di form.
4. **QR per meja sengaja TIDAK dipakai** — alasannya di §3.1.2. Bukan ditunda karena kehabisan waktu, tapi karena bertabrakan dengan model penanda yang berpindah.

**(b) Pesanan ganda tidak disengaja** — double-tap, tombol ditekan dua kali, pengunjung ragu lalu ulang. Ini yang paling sering kejadian.

5. **Kunci tombol + idempotency key** per submit (sudah ada di kriteria uji 3). Ini menutup penyebab tersering.
6. **Deteksi duplikat lunak:** kalau `guest_token` yang sama mengirim keranjang **identik** (item + qty sama) dalam `duplicate_window_secs` (default 60 detik), tampilkan konfirmasi sekali — *"Pesanan yang sama baru saja dibuat 20 detik lalu. Buat pesanan lagi?"* — dengan pilihan **Lihat pesanan sebelumnya** / **Ya, buat lagi**. Memberi tahu, tidak memblokir.
7. **Peringatan lunak meja padat:** kalau meja itu sudah punya ≥ `same_table_warn_threshold` (default 3) pesanan aktif, tampilkan info sekali — *"Meja 12 sudah punya 3 pesanan aktif. Yakin nomor mejanya benar?"*. Ini menangkap kasus (a) **dan** (b) sekaligus, tanpa pernah menolak pelanggan yang sah. Menurutku ini titik idealnya.

**(c) Spam / bot** — masalah yang berbeda, dan justru **lebih relevan di demo ini daripada di produksi**. Di produksi, pembayaran sungguhan adalah pembatas laju alami: tidak ada yang tidak sengaja membayar 40 kali. Tapi di v1 pembayarannya mockup, jadi satu orang bisa membanjiri layar dapur dengan 50 pesanan "lunas" secara gratis — dan demo yang bisa dirusak reviewer dalam 10 detik itu masalah nyata.

8. **Rate limit per `guest_token` + IP:** minimal `guest_order_rate_limit_secs` (default 15 detik) antar pembuatan order, dan maksimal 10 order `paid` per token per jam. Ini pengaman penyalahgunaan, **bukan** aturan UX — angkanya jauh di atas perilaku manusia yang wajar, jadi pelanggan sungguhan tidak akan pernah menyentuhnya.
9. Layar dapur mem-cap **tampilan**, bukan datanya: urut tertua dulu, dan tampilkan penanda kalau ada > 20 pesanan aktif. Membanjiri DB tidak boleh berarti membuat KDS tidak terpakai.

Semua ambangnya ada di `settings` supaya bisa disetel tanpa deploy, dan semuanya berupa **peringatan atau jeda, bukan penolakan** — kecuali nomor 8 yang memang menjaga dari penyalahgunaan.

### 3.1.2 Model identitas meja: penanda fisik yang berpindah

Ini keputusan produk, bukan detail UI, dan menentukan bentuk data.

Di lapangan, nomor meja **tidak menempel pada meja**. Yang terjadi:

```
Pengunjung datang  →  resepsionis/kasir menyerahkan PENANDA bernomor
                      (standee, asbak, plakat kayu — angka tercetak di situ)
       │
       ▼
Pengunjung membawa penanda ke meja mana pun yang kosong
       │
       ▼
Pesan lewat HP: menyalin angka DARI PENANDA yang ada di depannya
       │
       ▼
Selesai makan → cleaning service membersihkan meja,
                MENGAMBIL penandanya, mengembalikan ke resepsionis
       │
       ▼
Penanda yang sama diserahkan ke pengunjung berikutnya (dipakai ulang)
```

Konsekuensinya, dan ini yang harus dipegang selama implementasi:

**1. Nomor meja itu token yang dipinjamkan, bukan alamat tetap.** Karena itu tabelnya bernama **`table_markers`**, bukan `dining_tables`. Nama yang jujur mencegah asumsi salah nanti — misalnya orang menganggap satu nomor = satu lokasi fisik permanen, lalu membuat fitur "peta meja" yang tidak pernah bisa akurat. Jumlah penanda juga tidak harus sama dengan jumlah meja: rumah makan bisa punya 40 penanda untuk 30 meja, atau penanda khusus bertanda `TA-1..TA-10` untuk bungkus.

**2. QR yang ditempel di meja justru bertabrakan dengan model ini.** Kalau meja fisik punya QR `?meja=7` sementara pengunjung di meja itu memegang penanda 21, ada dua sumber kebenaran yang saling bertentangan — dan yang benar adalah penandanya, karena itu yang dilihat waiter saat mengantar. Jadi QR per meja **bukan ditunda karena kehabisan waktu, tapi salah untuk model operasional ini.** (Yang masuk akal kelak: QR **di penandanya**, ikut berpindah bersama nomornya. Itu ide bagus untuk nanti dan tidak mengubah apa pun di skema — cuma menambah cara mengisi field yang sudah ada.)

**3. Mode identitas harus jadi konfigurasi, karena ini yang paling berbeda antar-pelanggan.** Ini inti "konsep dinamis": rumah makan lain bisa punya model operasional yang lain sama sekali. Disimpan di `settings.identity_mode`:

| Mode | Perilaku layar masuk | Untuk siapa |
|---|---|---|
| `marker` **(default v1)** | Pengunjung mengetik nomor dari penanda yang dipegang, divalidasi ke `table_markers` | Model standee/asbak — pelanggan pertama |
| `marker_free` | Sama, tapi tanpa validasi daftar (nomor bebas) | Rumah makan yang penandanya belum terdata |
| `table_qr` | Nomor terisi dari `?meja=` dan tidak bisa diubah | Meja permanen bernomor tetap |
| `queue` | Tidak ada nomor meja; sistem memberi nomor antrean, makanan diambil sendiri | Kedai kekinian, takeaway, food court |

v1 **mengimplementasikan `marker`** dan menyiapkan percabangannya. Yang penting: layar masuk sudah jadi satu komponen yang membaca mode, sehingga menambah `queue` nanti = menambah satu cabang, bukan membongkar alur. Semua kode setelah layar masuk hanya tahu ada `table_number` bertipe `text` — jadi `"12"`, `"TA-3"`, dan `"A-104"` semuanya sah tanpa perubahan apa pun.

**4. Penanda dipakai ulang → dua pesanan berbeda bisa memakai nomor yang sama.** Ini risiko baru yang khas model ini, dan bukan hipotetis: pengunjung A pakai penanda 12, pulang, penanda dikembalikan dan diserahkan ke pengunjung B — sementara satu pesanan A masih `queued` (misal A pergi duluan, atau pesanannya terlambat). Sekarang ada dua pesanan aktif di nomor 12 milik dua orang berbeda.

Penanganannya:

- **Nama pemesan jadi pembeda utama, bukan pelengkap.** Kartu di dapur dan waiter menampilkan **nama sejajar dengan nomor meja**, tidak lebih kecil. Ini yang menutup pertanyaan terbuka Lampiran B no. 8: dengan penanda yang dipakai ulang, kolom nama **tidak bisa dihapus** — dia satu-satunya pembeda saat nomornya bertabrakan.
- Peringatan "meja ini sudah punya N pesanan aktif" (§3.1.1 poin 7) sekarang punya alasan yang lebih kuat: bisa berarti salah ketik, **atau** penanda baru dipakai ulang terlalu cepat.
- Jendela tabraknya sempit karena pesanan `done` cepat keluar dari tampilan aktif.
- **Jalan keluar sungguhan ada di v2:** siklus hidup penanda (`available` / `in_use`), di mana resepsionis menandai penanda saat diserahkan dan cleaning service saat dikembalikan. Sistem lalu bisa berkata "penanda 12 sedang tidak dipegang siapa pun" atau menutup sesi lama otomatis saat penanda diserahkan ulang. Ini fitur yang **bisa dijual** — tapi menuntut kedisiplinan staf, jadi jangan dipaksakan di v1 sebelum ada pelanggan yang memintanya. Skema v1 sudah kompatibel: cukup tambah kolom status di `table_markers` + tabel `marker_sessions`.

### 3.2 Alur kitchen

```
/dapur  →  3 kolom: MASUK (paid) | DIANTRE (queued) | SELESAI (done, hari ini)
   kartu pesanan: nomor pesanan, meja, nama, daftar item + qty, umur pesanan (mm:ss)
   [ Antrekan ]  paid  → queued
   [ Selesai  ]  queued → done   (set completed_at, expires_at = +12 jam)
   Item yang dibatalkan waiter tampil dicoret, tidak dihitung.
   Tidak ada tombol batal di sini.

   Kartu diberi penanda "Meja 12 · +2 pesanan lain aktif" bila meja yang sama
   punya pesanan aktif lain, sehingga dapur bisa menyiapkannya bersamaan.
   Toggle [ Kelompokkan per meja ] mengubah tampilan jadi satu kartu per meja
   berisi beberapa pesanan; tombol Antrekan/Selesai tetap per pesanan
   (tidak pernah mengubah dua pesanan sekaligus dengan satu klik).
```

### 3.3 Alur waiter

```
/waiter  →  daftar semua pesanan aktif (paid, queued, done belum diantar), urut terbaru
   filter: semua / per status / per meja, cari nomor pesanan
   aksi:  [ Batalkan item ]      → order_items.status = cancelled, total dihitung ulang
          [ Batalkan pesanan ]   → orders.status = cancelled (wajib isi alasan)
          [ Sudah diantar ]      → served_at diisi (pesanan keluar dari daftar aktif)
   Semua aksi tercatat di order_events (siapa, kapan, dari status apa ke apa).

   Tampilan default DIKELOMPOKKAN PER MEJA:
     ▸ Meja 12  ·  3 pesanan aktif  ·  Rp 71.000
         260812-014  Wisnu D.   diantre   2 item
         260812-019  Rina       dibayar   1 item
         260812-021  Wisnu D.   selesai   3 item   [ Sudah diantar ]
   Bisa di-switch ke daftar rata (urut terbaru) untuk jam sibuk.
```

### 3.4 State machine pesanan

```
                 ┌──────────────────┐
                 │ pending_payment  │──(cron: >2 jam)──▶ dihapus
                 └────────┬─────────┘
                     bayar (mock)
                          ▼
                     ┌────────┐
                     │  paid  │──────────┐
                     └───┬────┘          │
                  kitchen: Antrekan      │
                          ▼              │  waiter: Batalkan
                    ┌──────────┐         │  (dengan alasan)
                    │  queued  │─────────┤
                    └───┬──────┘         │
                  kitchen: Selesai       │
                          ▼              ▼
                     ┌────────┐   ┌─────────────┐
                     │  done  │   │  cancelled  │
                     └───┬────┘   └──────┬──────┘
                         │               │
                  expires_at = +12 jam   +12 jam
                         └──────┬────────┘
                                ▼
                       cron per jam: DELETE
```

Transisi yang sah — apa pun di luar ini ditolak di level DB (trigger) *dan* di server action:

| Dari | Ke | Oleh |
|---|---|---|
| pending_payment | paid | sistem (mock payment) |
| pending_payment | cancelled | waiter, superuser |
| paid | queued | kitchen, superuser |
| paid | cancelled | waiter, superuser |
| queued | done | kitchen, superuser |
| queued | cancelled | waiter, superuser |
| done | — | terminal (hanya `served_at` yang masih bisa diisi waiter) |
| cancelled | — | terminal |

---

## 4. Konsep desain: dial bulat-bulat

### 4.1 Model interaksi

Cincin dial itu **navigasi berjenjang**, bukan sekadar hiasan:

| Level | Lingkaran tengah | Lingkaran di cincin |
|---|---|---|
| 0 (root) | Nomor meja (angka besar + nama pemesan kecil) | Kategori menu |
| 1 | Kategori aktif (ikon + nama + badge total qty kategori) | Item menu dalam kategori itu |

- Tap lingkaran kategori → lingkaran itu **animasi terbang ke tengah**, yang tadinya di tengah keluar dari layar/mengecil, cincin diisi item menu.
- Tap lingkaran tengah (saat level 1) → balik ke level 0.
- Tap lingkaran item → popover kecil menempel di lingkaran itu: nama, harga, deskripsi, stepper `− qty +`, kolom catatan opsional, tombol *Tambah*.
- Badge angka (pojok kanan atas lingkaran): jumlah qty item tersebut, atau di lingkaran kategori = jumlah qty semua item kategori itu. Badge 0 disembunyikan.

**Kenapa cincin bertingkat, bukan daftar menu di dalam lingkaran tengah?** Teks di dalam area yang di-clip `border-radius: 50%` terpotong di kiri-kanan dan boros ruang — jelek terutama di layar HP. Cincin bertingkat mempertahankan bahasa visual "bulat-bulat" untuk *seluruh* alur, memberi target sentuh besar yang pas untuk kiosk, dan popover-lah yang membawa detail teks. Lingkaran tengah tetap jadi konteks aktif + tombol "kembali".

### 4.2 Kunci implementasi (jangan sampai salah arah)

Port `styles/dial.css` dari wisnu-cms, dengan dua perubahan:

1. **Jangan unmount lingkaran saat pindah level.** Semua lingkaran hidup di satu grid cell (`grid-area: 1/1`) dan diposisikan lewat `transform: rotate(--r) translate(--radius) rotate(calc(-1 * var(--r)))`. Animasi "terbang ke tengah" didapat gratis dengan cara: lingkaran aktif di-set `--radius: 0` + `width/height` naik ke `--center`, dan lingkaran lain diberi `--i` baru. Transisi CSS pada `transform`/`width` yang mengerjakan sisanya. Kalau elemennya di-remount, animasinya hilang dan harus pakai FLIP manual — hindari.
2. **`--total` harus reaktif** ke jumlah anak cincin di level aktif (jumlah kategori vs jumlah item), diset sebagai inline CSS var di elemen `.dial`.

Sisanya diwarisi: animasi `spread` bertahap per indeks, `bob` mengapung (di-pause saat terpilih), `photoIn` untuk tengah, tooltip `.tip`, parallax 3D mouse (nonaktif di kiosk/touch), dan blok `prefers-reduced-motion` yang mematikan semua animasi.

### 4.3 Tata letak halaman user

```
┌────────────────────────────────────────┐
│  [tema]                    Meja 12 ▸   │   header ringan
│                                        │
│              ● ● ●                     │
│           ●    ⓵②   ●                  │   DIAL
│           ●  (tengah)  ●               │   badge angka di lingkaran
│              ● ● ●                     │
│                                        │
│      Ketuk kategori untuk melihat menu │   baris hint
├─────────────── separator ──────────────┤   ← garis pemisah, diminta eksplisit
│  Pesanan Anda                    3 item│
│  2× Nasi Goreng          Rp 30.000  ⋯  │   list bisa edit qty / hapus
│  1× Es Teh               Rp  5.000  ⋯  │
│  ──────────────────────────────────    │
│  Total                   Rp 35.000     │
│                                        │
│  ⚠ Sudah dibayar = tidak bisa dibatalkan│
│     sendiri. Panggil waiter bila perlu. │
│  [        Lanjut Pembayaran        ]   │
└────────────────────────────────────────┘
```

Section checkout **selalu ada di bawah dial**, dipisah separator, tidak modal. Di HP terlihat dengan scroll; muncul sticky mini-bar ("3 item · Rp 35.000 · Lanjut") saat keranjang tidak kosong dan section checkout di luar viewport.

### 4.4 Halaman tunggu

- Route: `/pesanan/[nomor-pesanan]`, dinamis, dibuat setelah pembayaran terkonfirmasi.
- Animasi menunggu: dial mini yang berputar lambat, titik-titik mengorbit. Saat `done`, animasi berhenti, lingkaran tengah jadi tanda centang, warna aksen berubah.
- Stepper status: **Dibayar → Diantre → Selesai** (cancelled = jalur merah terpisah dengan alasan).
- Perkiraan tunggu kasar: tampilkan posisi antrean ("2 pesanan di depan Anda"), bukan menit — jangan janji waktu yang tidak bisa ditepati.
- Nomor pesanan besar dan bisa dibaca dari jauh (dipanggil staf).
- Tombol **[ Pesan Lagi ]** (§3.1.1) dan tautan **Pesanan saya** kalau `guest_token` punya lebih dari satu pesanan.
- Setelah `expires_at` lewat: halaman balas **410 Gone** dengan pesan "Pesanan sudah kedaluwarsa" — tidak 404, supaya jelas bedanya antara *pernah ada tapi kedaluwarsa* dan *tidak pernah ada*.

### 4.5 Mode kiosk (anjungan)

Query `?mode=kiosk` (atau env di device) mengubah:
- Ukuran font/target sentuh naik ~30%, `--radius`/`--avatar` lebih besar.
- Numpad angka on-screen untuk nomor meja (jangan andalkan keyboard OS).
- Parallax mouse mati, `bob` tetap.
- Idle 60 detik tanpa interaksi → reset ke layar masuk, keranjang dibuang (konfirmasi 10 detik dulu: "Masih di sana?").
- Setelah bayar, tampilkan nomor pesanan besar 15 detik lalu auto-reset (pengunjung membawa nomornya, bukan halaman tunggu di kiosk).

### 4.6 Token desain

Ikut wisnu-cms tapi ganti aksen ke arah kuliner (jangan biru korporat). Usul: aksen `#f97316` (oranye), deep `#7c2d12`, mid `#ea580c`. Tetap sediakan light/dark, dan `accent` disimpan di tabel `settings` supaya superuser bisa ubah.

---

## 5. Stack — rekomendasi & alasan

Rekomendasi: **Next.js 16 (App Router) + React 19 + TypeScript + Supabase (Postgres, Auth, Realtime) + CSS biasa + Zod**, deploy Vercel.

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16 App Router**, React 19, TS strict | Sama dengan wisnu-cms → CSS dial bisa diport tanpa gesekan. Server Actions memangkas kebutuhan lapisan API. Vercel = nol konfigurasi. |
| Styling | **CSS biasa** (`styles/*.css` + CSS var), tanpa Tailwind | Dial itu matematika transform + `@property --bob` + keyframes bertingkat. Sudah ditulis dan terbukti. Tailwind hanya menambah lapisan tanpa membantu bagian tersulitnya. |
| Database | **Supabase Postgres** | Free tier cukup, dan yang penting: RLS + trigger + `pg_cron` semuanya jalan di free plan. |
| Auth staf | **Supabase Auth** (email+password) + tabel `staff` untuk peran | Peran dipakai langsung di policy RLS lewat `auth.uid()` — keamanan ada di DB, bukan cuma di `if` di UI. Ini yang dinilai reviewer. (Alternatif: cookie HMAC ala wisnu-cms `lib/auth.ts` — lebih ringan tapi RLS jadi tumpul karena semua harus lewat secret key.) |
| Auth pengunjung | Tanpa akun. Cookie `httpOnly` berisi `guest_token` UUID | Nol friksi. Tidak menghabiskan kuota MAU. Tidak menyimpan data pribadi selain nama panggilan. |
| Kunci API | **Skema baru** (`sb_publishable_` / `sb_secret_`), dan dirancang supaya **secret key tidak pernah dipakai** — semua akses istimewa lewat RPC `security definer` (§7.1) | Kebocoran env var tidak jadi kebocoran seluruh DB, dan RLS yang ditulis benar-benar berlaku |
| Realtime | **Supabase Realtime** untuk `/dapur` & `/waiter`; **polling 4s** untuk halaman tunggu user | Dashboard staf sudah terautentikasi → policy RLS untuk Realtime mudah dan benar. Halaman tunggu diakses anon; polling lewat Route Handler jauh lebih sederhana daripada memaksa RLS anon aman untuk websocket, dan kebal reconnect di jaringan HP. |
| Validasi | **Zod** di batas server action | Semua input pengunjung tidak dipercaya. Murah, dan enak dibaca reviewer. |
| Cron / TTL | **`pg_cron` di Supabase**, tiap jam | Vercel Hobby cuma boleh 1 cron/hari — tidak cukup untuk TTL 12 jam yang rapi. `pg_cron` tersedia di free plan. Ditambah `expires_at` sebagai penjaga: halaman tetap 410 walau cron telat. |
| Migrasi skema | File `supabase/migrations/*.sql` bernomor, dijalankan lewat SQL Editor (CLI opsional) | Gratis dan tanpa dependensi. Kalau project Supabase kena auto-pause atau ingin mulai dari nol, skemanya masih ada di repo (§14.1). |
| State klien | `useState` + `localStorage` untuk keranjang. Tanpa Redux/Zustand | Keranjang itu satu array. Tidak perlu library. |
| Animasi | CSS transitions/keyframes. Tanpa Framer Motion | Sudah dibahas — semua animasi dial adalah transisi `transform`/CSS var. |

Dependensi runtime yang dipasang: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`. Selesai. **Semuanya gratis dan open source, tanpa satu pun layanan berbayar** — Vercel Hobby, Supabase Free, font & ikon dari Google Fonts (Inter + Material Symbols, sama seperti wisnu-cms).

Supaya tetap nyaman di dalam kuota gratis: gambar menu **opsional** — default-nya pakai ikon Material Symbols saja (nol egress, dan lebih cocok dengan bahasa visual bulat-bulat). Kalau mau pakai foto, taruh di Supabase Storage dengan ukuran wajar, jangan gambar 3 MB per item.

### Yang dipertimbangkan tapi tidak dipilih

- **Laravel 11 + Filament.** Panel admin/kitchen jadi hampir gratis dan tim SmartID paling nyaman di sana. Tapi target deploy adalah Vercel + Supabase free, dan Vercel bukan rumah yang wajar untuk PHP. Kalau nanti pindah ke VPS/Forge, Laravel layak ditimbang ulang — dan bagian tersulit proyek ini (dial) tetap dikerjakan di sisi front-end yang sama.
- **Tailwind + shadcn/ui.** Bagus untuk dashboard staf, tapi menambah build step dan tidak menolong dial. Kalau halaman staf ternyata makan waktu, boleh dipertimbangkan **hanya** untuk `/waiter`, `/dapur`, `/admin`.
- **Prisma / Drizzle.** RLS jadi lebih ribet, connection pooling di serverless jadi PR sendiri. `supabase-js` sudah pas untuk skala ini.
- **NextAuth.** Duplikasi Supabase Auth dan memutus jalur `auth.uid()` ke RLS.

### Batasan free tier yang harus disadari sejak awal

| Batasan | Dampak | Mitigasi |
|---|---|---|
| **Proyek Supabase free di-pause setelah ~7 hari tanpa aktivitas** | **Risiko nomor satu untuk porto** — demo mati tepat saat reviewer membuka, dan kamu tidak tahu | GitHub Action harian yang menyentuh 1 query (gratis, tak terpengaruh batas cron Vercel Hobby) + skema tersimpan di `supabase/migrations/` supaya bisa dibangun ulang cepat kalau terlambat. Tulis di README. |
| Vercel Hobby: non-commercial | **Tidak jadi masalah** — portfolio & demo tes kerja justru penggunaan yang diizinkan. Yang dilarang itu bisnis yang menghasilkan uang. | Cukup jangan pasang branding klien atau pembayaran sungguhan. Selama masih porto, Hobby sah. |
| DB 500 MB, egress 5 GB/bln | Aman — data pesanan kecil dan dihapus tiap 12 jam | Default pakai ikon Material Symbols, bukan foto. Kalau pakai foto, batasi ukurannya. |
| Realtime 200 koneksi bareng | Aman (staf saja) | — |
| Durasi fungsi serverless | Semua handler harus cepat | Tanpa job berat; TTL dikerjakan `pg_cron` di DB. |
| Cold start | Halaman tunggu bisa terasa lambat di hit pertama | Polling, bukan long-poll; render status awal di server. |

---

## 6. Model data

### 6.1 Skema inti

Uang disimpan sebagai **integer rupiah** (`int`), bukan desimal/cent — Rupiah tidak punya pecahan yang dipakai, dan integer menghindari galat float.

```sql
-- ============ enum ============
create type order_status as enum
  ('pending_payment','paid','queued','done','cancelled');
create type order_item_status as enum ('active','cancelled');
create type staff_role as enum ('waiter','kitchen','superuser');

-- ============ staf & meja ============
create table staff (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        staff_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Penanda meja fisik (standee/asbak bernomor) yang DIPINJAMKAN ke pengunjung
-- lalu dikembalikan cleaning service dan dipakai ulang — lihat §3.1.2.
-- Bukan "meja": jumlah penanda tidak harus sama dengan jumlah meja, dan satu
-- nomor tidak menandai satu lokasi permanen. Jangan bangun fitur peta meja di atas ini.
create table table_markers (
  id         uuid primary key default gen_random_uuid(),
  number     text not null unique,   -- text: "12", "A1", "TA-3" semuanya sah
  label      text,                   -- mis. "Standee kayu", "Lantai 2"
  kind       text not null default 'dine_in',  -- 'dine_in' | 'takeaway'
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ menu ============
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  icon_name   text not null default 'restaurant',  -- Material Symbol
  color       text,                                -- override aksen lingkaran
  position    int  not null,                       -- urutan di cincin dial
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references categories(id) on delete restrict,
  name         text not null,
  description  text,
  price        int  not null check (price >= 0),   -- rupiah
  image_url    text,
  icon_name    text,                               -- dipakai kalau tak ada gambar
  is_available boolean not null default true,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index menu_items_cat_idx on menu_items (category_id, position);

-- ============ pesanan ============
create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text not null unique,              -- '260812-014'
  table_number  text not null,
  customer_name text not null,
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
  expires_at    timestamptz,                       -- diisi saat done/cancelled
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index orders_status_idx  on orders (status, created_at desc);
create index orders_expires_idx on orders (expires_at) where expires_at is not null;

create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  menu_item_id  uuid references menu_items(id) on delete set null,
  name          text not null,       -- snapshot: nama saat dipesan
  price         int  not null,       -- snapshot: harga saat dipesan
  qty           int  not null check (qty > 0),
  note          text,
  status        order_item_status not null default 'active',
  cancelled_by  uuid references staff(id),
  created_at    timestamptz not null default now()
);
create index order_items_order_idx on order_items (order_id);

-- ============ pembayaran (mock, siap Xendit) ============
create table payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  provider     text not null default 'mock',   -- nanti: 'xendit'
  method       text,                            -- 'qris' | 'va' | 'cash'
  amount       int  not null,
  status       text not null default 'pending',-- pending|paid|failed|expired
  external_id  text,                            -- id invoice Xendit nanti
  raw          jsonb not null default '{}',     -- payload webhook mentah
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ============ audit trail ============
create table order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  actor_role  text not null,                    -- 'guest'|'waiter'|'kitchen'|'superuser'|'system'
  actor_id    uuid references staff(id),
  from_status order_status,
  to_status   order_status,
  action      text not null,                    -- 'create'|'pay'|'queue'|'complete'|'cancel_item'|...
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on order_events (order_id, created_at);

-- ============ konfigurasi (satu baris) ============
create table settings (
  id           int primary key default 1 check (id = 1),
  brand_name   text not null default 'RM-IAM',
  accent       text not null default '#f97316',
  theme        text not null default 'light',
  hint_text    text not null default 'Ketuk kategori untuk melihat menu',
  cancel_notice text not null default
    'Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri. Silakan panggil waiter kami.',
  dial_radius_rem  numeric not null default 12,
  kiosk_idle_secs  int not null default 60,
  order_ttl_hours  int not null default 12,
  -- cara pengunjung mengidentifikasi mejanya (§3.1.2) — beda per pelanggan,
  -- karena itu data, bukan kode. v1 mengimplementasikan 'marker'.
  identity_mode    text not null default 'marker'
    check (identity_mode in ('marker','marker_free','table_qr','queue')),
  table_number_label text not null default 'Nomor Meja',  -- 'Nomor Antrean' untuk mode queue
  ask_customer_name  boolean not null default true,        -- lihat §3.1.2 poin 4: jangan dimatikan di mode marker
  -- pengaman salah meja & pesanan ganda (§3.1.1) — semuanya PERINGATAN, bukan penolakan
  duplicate_window_secs        int not null default 60,  -- keranjang identik dari token sama
  same_table_warn_threshold    int not null default 3,   -- "meja ini sudah punya N pesanan aktif"
  -- pengaman penyalahgunaan (bukan aturan UX) — angkanya jauh di atas perilaku wajar
  guest_order_rate_limit_secs  int not null default 15,
  guest_paid_orders_per_hour   int not null default 10,
  updated_at   timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;
```

### 6.2 Nomor pesanan

Format `YYMMDD-NNN`, urut per hari, reset otomatis:

```sql
create table order_counters (day date primary key, n int not null default 0);

create or replace function next_order_number() returns text
language plpgsql as $$
declare d date := (now() at time zone 'Asia/Jakarta')::date; c int;
begin
  insert into order_counters (day, n) values (d, 1)
    on conflict (day) do update set n = order_counters.n + 1
    returning n into c;
  return to_char(d, 'YYMMDD') || '-' || lpad(c::text, 3, '0');
end $$;
```

Alasan: pendek, bisa diucapkan lewat pengeras suara, urut untuk dapur, dan **bukan** sekuens global yang membocorkan volume penjualan.

### 6.3 TTL 12 jam

```sql
-- diisi trigger saat status jadi done/cancelled:
--   expires_at := now() + (select order_ttl_hours from settings) * interval '1 hour'

select cron.schedule('rmiam-purge-expired', '7 * * * *', $$
  delete from orders where expires_at is not null and expires_at < now();
$$);

select cron.schedule('rmiam-purge-abandoned', '17 * * * *', $$
  delete from orders
   where status = 'pending_payment' and created_at < now() - interval '2 hours';
$$);
```

`order_items`, `payments`, `order_events` ikut terhapus lewat `on delete cascade`.

**Penting:** halaman tunggu **tidak** boleh mengandalkan cron sudah jalan. Server harus memeriksa `expires_at < now()` saat render dan balas 410. Cron itu kebersihan penyimpanan, bukan penegak aturan.

### 6.4 Arsip riwayat penjualan (tahan purge 12 jam)

Pesanan hidup dihapus 12 jam setelah selesai, tapi **riwayat penjualan harus permanen dan hanya boleh dilihat staf**. Karena itu arsip tinggal di tabel terpisah yang diisi trigger saat pesanan mencapai status akhir.

Dua keputusan desain yang menentukan dan jangan diubah tanpa sadar akibatnya:

1. **`sales_records.order_id` sengaja TANPA foreign key ke `orders`.** Kalau dipasang FK, `on delete cascade` (atau bahkan `restrict` yang bikin cron gagal) akan menghapus arsipnya bersama pesanannya — tepat kebalikan dari yang diminta. Kolomnya cuma `uuid unique` biasa, dipakai sebagai kunci idempotensi.
2. **Arsip tidak menyimpan `customer_name`.** Untuk rekap penjualan yang dibutuhkan hanya nomor meja, waktu, item, dan uang. Nama pengunjung tetap ikut terhapus dalam 12 jam. Jadi "riwayat penjualan permanen" dan "data pribadi tidak ditimbun" bisa jalan bareng — dan ini poin bagus untuk dipresentasikan. Kalau nanti butuh nama (misal untuk komplain), tambahkan kolomnya secara sadar, jangan diam-diam.

```sql
-- ============ arsip penjualan (permanen, staf saja) ============
create table sales_records (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique,   -- TANPA FK: arsip harus selamat saat orders dihapus
  order_number  text not null,
  table_number  text not null,
  status        order_status not null,  -- 'done' | 'cancelled'
  subtotal      int  not null,
  total         int  not null,
  item_count    int  not null,          -- total qty item aktif
  cancel_reason text,
  cancelled_by  uuid,
  ordered_at    timestamptz not null,   -- = orders.created_at
  paid_at       timestamptz,
  queued_at     timestamptz,
  completed_at  timestamptz,
  served_at     timestamptz,
  events        jsonb not null default '[]',  -- snapshot order_events (jejak audit ikut selamat)
  archived_at   timestamptz not null default now()
);
create index sales_records_completed_idx on sales_records (completed_at desc);
create index sales_records_table_idx     on sales_records (table_number);

create table sales_record_items (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references sales_records(id) on delete cascade,
  menu_item_id uuid,                    -- juga tanpa FK: menu boleh dihapus, riwayat tetap
  name         text not null,           -- snapshot
  price        int  not null,           -- snapshot
  qty          int  not null,
  status       order_item_status not null,
  line_total   int  not null            -- 0 untuk item yang dibatalkan
);
create index sales_record_items_rec_idx on sales_record_items (record_id);
```

Trigger pengarsip — idempoten (`on conflict`), jadi aman kalau terpanggil dua kali:

```sql
create or replace function archive_order() returns trigger
language plpgsql security definer set search_path = public as $$
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

-- 'served_at' ikut dipantau: waiter menandai "sudah diantar" SETELAH status done,
-- jadi trigger yang hanya memantau kolom status akan melewatkannya.
create trigger orders_archive
  after update of status, served_at on orders
  for each row when (new.status in ('done','cancelled'))
  execute function archive_order();
```

Rekap dibaca lewat view. `security_invoker = on` wajib — tanpa itu view mengabaikan RLS tabel di bawahnya dan jadi lubang kebocoran.

```sql
create view daily_sales with (security_invoker = on) as
select (coalesce(completed_at, archived_at) at time zone 'Asia/Jakarta')::date as day,
       count(*) filter (where status = 'done')                    as orders_done,
       count(*) filter (where status = 'cancelled')               as orders_cancelled,
       coalesce(sum(total)      filter (where status = 'done'), 0) as revenue,
       coalesce(sum(item_count) filter (where status = 'done'), 0) as items_sold
  from sales_records
 group by 1
 order by 1 desc;

create view menu_sales with (security_invoker = on) as
select i.name,
       sum(i.qty)        as qty_sold,
       sum(i.line_total) as revenue
  from sales_record_items i
  join sales_records r on r.id = i.record_id
 where r.status = 'done' and i.status = 'active'
 group by i.name
 order by qty_sold desc;
```

Ukuran data: satu pesanan di arsip ± 1–2 KB termasuk snapshot `events`. Pada 300 pesanan/hari itu ~0,5 MB/hari, ~180 MB/tahun — masih di bawah 500 MB free tier, tapi **bukan tak terbatas**. Kalau proyeksinya lebih ramai, pangkas kolom `events` (mis. hanya simpan yang statusnya berubah) atau agregasi arsip lebih tua dari 1 tahun ke tabel harian. Catat sekarang supaya tidak jadi kejutan.

---

## 7. Keamanan & RLS

Prinsip: **pengunjung anon tidak boleh bisa membaca daftar pesanan orang lain, dan tidak boleh mengubah status apa pun.**

| Tabel | anon (pengunjung) | waiter | kitchen | superuser |
|---|---|---|---|---|
| `categories`, `menu_items` | SELECT (yang aktif saja) | SELECT | SELECT | ALL |
| `table_markers` | SELECT (aktif) | SELECT | — | ALL |
| `orders` | tanpa akses langsung — semua lewat RPC/server action | SELECT + UPDATE (status→cancelled, served_at) | SELECT + UPDATE (status→queued/done) | ALL |
| `order_items` | tanpa akses langsung | SELECT + UPDATE status | SELECT | ALL |
| `payments` | tanpa akses langsung | SELECT | — | ALL |
| `order_events` | — | SELECT + INSERT | SELECT + INSERT | ALL |
| `sales_records`, `sales_record_items` | **tanpa akses apa pun** | SELECT | SELECT | SELECT |
| `daily_sales`, `menu_sales` (view) | **tanpa akses apa pun** | SELECT | SELECT | SELECT |
| `settings` | SELECT | SELECT | SELECT | ALL |
| `staff` | — | SELECT diri sendiri | SELECT diri sendiri | ALL |

Helper untuk policy:

```sql
create or replace function current_staff_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from staff where id = auth.uid() and is_active
$$;
```

Contoh policy:

```sql
alter table orders enable row level security;

create policy "staff read orders" on orders for select
  using (current_staff_role() is not null);

create policy "kitchen advances orders" on orders for update
  using (current_staff_role() in ('kitchen','superuser'))
  with check (status in ('queued','done'));

create policy "waiter cancels orders" on orders for update
  using (current_staff_role() in ('waiter','superuser'));
```

### Arsip penjualan: append-only, tanpa pintu untuk pengunjung

```sql
alter table sales_records      enable row level security;
alter table sales_record_items enable row level security;

create policy "staff read sales" on sales_records for select
  using (current_staff_role() is not null);
create policy "staff read sales items" on sales_record_items for select
  using (current_staff_role() is not null);
```

Perhatikan yang **tidak** ditulis: tidak ada policy INSERT/UPDATE/DELETE untuk siapa pun. Satu-satunya yang menulis ke arsip adalah trigger `archive_order()` yang `security definer`. Efeknya arsip praktis **append-only bahkan untuk superuser yang login** — riwayat penjualan tidak bisa dirapikan diam-diam dari UI. Itu memang yang diinginkan dari sebuah catatan penjualan.

Karena `anon` tidak punya policy sama sekali, pengunjung tidak punya jalan ke arsip — sesuai permintaan "hanya bisa dilihat selain customer". Halaman laporan **memakai publishable key + sesi staf, bukan secret key** (§7.1), supaya RLS di atas yang benar-benar menjaga; kalau pakai secret key, policy-nya cuma jadi hiasan.

Semua staf (waiter, kitchen, superuser) boleh membaca laporan — itu arti langsung dari "selain customer". Kalau nanti angka pendapatan mau dibatasi ke superuser saja, cukup ubah `current_staff_role() is not null` jadi `= 'superuser'` pada dua view rekap dan sisakan `sales_records` untuk semua staf.

Transisi status juga dikunci trigger `BEFORE UPDATE` di `orders` yang menolak kombinasi `OLD.status → NEW.status` di luar tabel §3.4, jadi bug di UI tidak bisa merusak data.

### Akses pengunjung ke pesanannya

- Saat order dibuat, server menaruh cookie `httpOnly` `rmiam_guest=<guest_token>` dan menyimpan daftar nomor pesanan di `localStorage` (untuk "Pesanan saya").
- Halaman tunggu di-render **server-side** lewat fungsi Postgres `security definer` (bukan secret key — lihat §7.1):
  - **Tampilan publik** (tanpa cookie yang cocok): nomor pesanan, nomor meja, status, jumlah item, posisi antrean. Nama disingkat (`Wisnu D.`). Ini disengaja — orang lain di meja atau staf boleh melihat status dari layar mana pun.
  - **Tampilan penuh** (cookie `guest_token` cocok): rincian item, harga, catatan, tombol "Pesanan saya".
- Nomor pesanan bisa diterka (`260812-014`), karena itu **tidak ada** data sensitif dan **tidak ada** aksi mutasi di tampilan publik. Kalau kelak butuh privasi lebih ketat, tinggal ganti route ke `/pesanan/[guest_token]` dan tampilkan `order_number` di dalam halaman.

### 7.1 Kunci API: pakai skema baru, dan usahakan tanpa secret key

Project ini memakai **skema API key baru** Supabase (`sb_publishable_…` / `sb_secret_…`), bukan `anon`/`service_role` JWT lama. Padanannya:

| Lama | Baru | Sifat |
|---|---|---|
| `anon` (JWT) | **publishable key** | Aman di browser **selama RLS aktif**. Menghormati RLS. |
| `service_role` (JWT) | **secret key** | **Menembus RLS sepenuhnya.** Server-only, dan idealnya tidak dipakai sama sekali (lihat bawah). |

**Targetnya: aplikasi ini tidak pernah memegang secret key.** Semua yang butuh "lebih dari yang boleh dilakukan pengunjung" dikerjakan lewat fungsi Postgres `security definer` yang dipanggil dengan publishable key:

| Kebutuhan | Cara |
|---|---|
| Buat order + item + hitung total | RPC `create_order(payload jsonb)` — `security definer`, memvalidasi sendiri (penanda aktif, harga diambil dari `menu_items`, **bukan** dari klien) |
| Baca status pesanan untuk halaman tunggu | RPC `get_order_status(order_number, guest_token)` — hanya memulangkan field yang boleh, dan tetap memeriksa `expires_at` |
| Tandai lunas (mock payment) | RPC `mark_order_paid(order_number, guest_token)` |
| Dashboard staf & `/laporan` | Publishable key **+ sesi staf** — RLS yang menjaga, seperti §7 |

Kenapa repot begitu padahal secret key lebih cepat: dengan pola ini, **kebocoran env var tidak otomatis berarti kebocoran seluruh database**, dan RLS yang sudah ditulis di §7 benar-benar berlaku, bukan cuma hiasan. Untuk porto, "aplikasinya tidak pernah butuh kunci yang menembus RLS" jauh lebih enak dipresentasikan daripada "semua lewat service key, keamanannya di kode aplikasi".

Harga yang dibayar: harga item dan total **wajib** dihitung di dalam RPC dari `menu_items`, tidak boleh percaya angka dari klien. Itu memang keharusan sejak awal, jadi bukan pekerjaan tambahan.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# SUPABASE_SECRET_KEY=  ← sengaja TIDAK dipakai. Kalau suatu saat terpaksa,
#                          server-only, dan JANGAN pernah diberi awalan NEXT_PUBLIC_.
```

**Aturan operasional yang aku pegang:** aku tidak pernah menyentuh, meminta, menulis, atau menyimpan nilai secret-mu. Isi `.env.local` dan environment variable Vercel sendiri; aku hanya menyebut nama variabelnya. Kalau secret key pernah tertempel di chat, log, screenshot, atau ter-commit — **rotate**, jangan cuma dihapus dari tempat itu. Publishable key tidak perlu dirotasi karena memang dirancang untuk publik.

Pastikan juga `.env.local` masuk `.gitignore` sejak commit pertama.

---

## 8. Peta route

| Route | Peran | Isi |
|---|---|---|
| `/` | user | Layar masuk (meja + nama) → dial + separator + section checkout |
| `/bayar/[orderNumber]` | user | Mockup pembayaran. Tombol *Kembali & Edit* aktif selama masih `pending_payment` |
| `/pesanan/[orderNumber]` | user | Halaman tunggu dinamis. 410 setelah `expires_at` |
| `/pesanan-saya` | user | Daftar nomor pesanan dari `localStorage` |
| `/masuk` | staf | Login Supabase Auth, redirect sesuai peran |
| `/waiter` | waiter | Daftar pesanan aktif, batalkan item/pesanan, tandai diantar |
| `/dapur` | kitchen | KDS 3 kolom, tombol Antrekan / Selesai |
| `/admin` | superuser | Ringkasan + navigasi |
| `/admin/menu` | superuser | CRUD kategori & item, urutan, ketersediaan |
| `/admin/dial` | superuser | Konfigurasi dial: kategori mana yang tampil, urutan, ikon, warna, radius, teks hint & pengingat pembatalan |
| `/admin/penanda` | superuser | CRUD penanda meja (`table_markers`): nomor, label, jenis dine-in/takeaway, aktif/tidak. Aktifkan-nonaktifkan penanda yang hilang atau rusak tanpa menghapus riwayatnya. |
| `/admin/staf` | superuser | Undang/nonaktifkan staf, atur peran |
| `/laporan` | **semua staf** (bukan `/admin/*`, karena waiter & kitchen juga boleh) | Riwayat penjualan permanen: rekap harian (`daily_sales`), item terlaris (`menu_sales`), daftar pesanan arsip + rincian per pesanan. Read-only. |
| `/api/orders/[orderNumber]/status` | publik | JSON status ringkas untuk polling halaman tunggu |
| `/api/webhooks/payment` | sistem | Stub untuk Xendit nanti (v1: verifikasi tanda tangan → 501) |

Middleware: `/waiter`, `/dapur`, `/admin`, `/laporan` wajib sesi + peran; salah peran → redirect ke dashboard yang benar, bukan 403 buntu.

---

## 9. Menu awal (seed)

Harga placeholder, semuanya bisa diubah superuser.

| Kategori | Ikon | Item | Harga |
|---|---|---|---|
| Makanan | `ramen_dining` | Nasi Goreng | 15.000 |
| | | Mie Goreng | 15.000 |
| Minuman | `local_cafe` | Es Teh | 5.000 |
| | | Air Mineral | 5.000 |
| Cemilan | `lunch_dining` | Fried Fries | 12.000 |
| Paket Hemat | `redeem` | *(kosong — diisi superuser)* | |
| Tambahan | `add_circle` | *(kosong — diisi superuser)* | |

Dua kategori kosong sengaja ada: membuktikan cincin dial dan dashboard superuser benar-benar data-driven, bukan hardcoded.

---

## 10. Rencana pengerjaan

Tiap fase harus bisa didemokan sendiri.

### Fase 0 — Fondasi
Scaffold Next 16 + TS, port `dial.css`, klien Supabase (browser + server), SQL di `supabase/migrations/0001_init.sql` + `seed.sql` terpisah (§14.1), deploy pertama ke Vercel Hobby.
**Selesai bila:** dial statis (kategori dari DB) tampil di URL Vercel.

### Fase 1 — Alur user
Layar masuk, dial berjenjang + swap-ke-tengah + badge, popover item, keranjang `localStorage`, section checkout + separator, pengingat pembatalan.
**Selesai bila:** bisa menyusun keranjang, edit qty, hapus item; refresh tidak menghilangkan keranjang.

### Fase 2 — Order + pembayaran mock + halaman tunggu
Server action buat order (Zod), `next_order_number()`, halaman bayar mockup, cookie guest, halaman tunggu + polling + animasi, trigger transisi status, `expires_at`, 410, `pg_cron`. Sekalian di lapisan DB: tabel arsip + trigger `archive_order()` + view rekap (§6.4) — dibuat di sini supaya sejak pesanan pertama selesai, riwayatnya sudah ikut terekam; UI-nya belakangan. Plus tombol **Pesan Lagi**, `/pesanan-saya`, layar masuk yang membaca `settings.identity_mode` (implementasi mode `marker`), dan pengaman §3.1.1 (peringatan duplikat, peringatan meja padat, rate limit per `guest_token`).
**Selesai bila:** satu alur penuh dari dial sampai halaman tunggu berjalan; status berubah saat DB diubah manual; set status ke `done` lewat SQL → baris muncul di `sales_records`, dan setelah barisnya di `orders` dihapus manual, arsipnya **tetap ada**.

### Fase 3 — Kitchen
Supabase Auth + tabel `staff` + RLS + middleware, `/dapur` 3 kolom dengan Realtime, tombol Antrekan/Selesai, `order_events`.
**Selesai bila:** klik Selesai di dapur → halaman tunggu user berubah dalam ≤5 detik tanpa refresh manual.

### Fase 4 — Waiter
`/waiter` daftar dikelompokkan per meja + filter + cari, batalkan item, batalkan pesanan dengan alasan, hitung ulang total, tandai diantar.
**Selesai bila:** batalkan satu item → total berubah di semua layar, item tercoret di dapur, tercatat di `order_events`; satu meja dengan 3 pesanan aktif tampil sebagai satu grup dan tombol per pesanan tetap bekerja terpisah.

### Fase 5 — Superuser + laporan
CRUD menu & kategori, konfigurasi dial, meja, staf. Halaman `/laporan` untuk semua staf: rekap harian, item terlaris, daftar arsip + rincian per pesanan.
**Selesai bila:** menambah kategori baru di `/admin/dial` langsung menambah lingkaran di dial user tanpa deploy; `/laporan` menampilkan pesanan yang barisnya sudah dihapus purge 12 jam.

### Fase 6 — Poles & demo
Mode kiosk, dark mode, `prefers-reduced-motion`, empty/error state, **GitHub Action harian anti-pause Supabase** (ini yang menjaga porto tetap hidup), README + demo script, akun demo tiap peran. Plus uji 36–37: pastikan mengganti brand + seluruh menu lewat dashboard cukup tanpa menyentuh kode.

Kalau waktu mepet: Fase 0–4 sudah cerita utuh untuk tes kerja. Fase 5 bisa dipangkas jadi CRUD menu saja; Fase 6 jangan dibuang seluruhnya — README + akun demo itu yang membuat reviewer bisa mencoba.

---

## 11. Kriteria penerimaan (rangkuman uji)

1. Nomor meja di luar `table_markers` yang aktif → ditolak dengan pesan jelas (mode `marker`).
2. Keranjang bertahan setelah refresh, hilang setelah order dibuat.
3. Klik *Lanjut Pembayaran* dua kali tidak membuat dua order (tombol dikunci + idempotency key di server action).
4. Setelah status `paid`, halaman bayar tidak lagi bisa mengedit; tombol *Kembali & Edit* hilang.
5. Halaman tunggu memantulkan perubahan status dalam ≤5 detik.
6. Pengunjung tidak punya jalan apa pun untuk mengubah/membatalkan pesanan (dicek juga dengan memanggil endpoint langsung).
7. Kitchen tidak melihat tombol batal, dan panggilan langsung ke API pembatalan sebagai kitchen ditolak RLS.
8. Item yang dibatalkan waiter: tercoret di dapur, tidak masuk total, tercatat pelakunya.
9. Order `done` + `expires_at` lewat → 410, walaupun `pg_cron` dimatikan.
10. Semua transisi status tercatat di `order_events` dengan pelaku.
11. Dial tetap terpakai dan tidak tumpang tindih pada 2 kategori maupun 12 kategori.
12. `prefers-reduced-motion: reduce` → tanpa animasi, lingkaran tetap di posisi benar.
13. Lighthouse mobile: performance ≥ 85, accessibility ≥ 95 di `/`.
14. Semua lingkaran bisa dijangkau keyboard (Tab) dengan `focus-visible` terlihat.

**Pesanan ganda per meja**

15. Satu meja bisa punya 3 pesanan aktif sekaligus, masing-masing nomor sendiri, tanpa saling menimpa.
16. *Pesan Lagi* dari halaman tunggu mengisi otomatis meja + nama, dan keranjangnya kosong (tidak membawa item pesanan sebelumnya).
17. `/pesanan-saya` menampilkan semua pesanan milik `guest_token` itu — dan **tidak** menampilkan pesanan pengunjung lain di meja yang sama (uji dengan dua browser/incognito di meja yang sama).
18. Dapur & waiter mengelompokkan pesanan per meja; menekan *Selesai* pada satu pesanan tidak mengubah pesanan lain di meja itu.
19. Keranjang identik dari `guest_token` yang sama dalam 60 detik → muncul konfirmasi duplikat, dan memilih *Ya, buat lagi* **tetap berhasil** membuat pesanan (peringatan, bukan penolakan).
20. Meja dengan 3 pesanan aktif → muncul peringatan "yakin nomor mejanya benar?", dan pesanan ke-4 sampai ke-10 tetap bisa dibuat.
21. Membuat 2 pesanan berturut-turut dalam < 15 detik → ditolak oleh rate limit dengan pesanan pertama tetap utuh; setelah jeda, berhasil.
22. Layar konfirmasi menampilkan nomor meja dengan ukuran sangat besar, cukup untuk dibandingkan sekilas dengan penanda fisik di meja.

**Model penanda meja (§3.1.2)**

23. Nomor non-numerik (`TA-3`, `A1`) diterima di seluruh alur: order, dapur, waiter, halaman tunggu, arsip — tidak ada tempat yang mengasumsikan integer.
24. Dua pesanan aktif dari **nama berbeda** pada nomor meja yang sama tampil jelas terpisah di dapur & waiter, dengan nama sejajar nomor meja (bukan lebih kecil).
25. Menonaktifkan penanda di `/admin/penanda` membuat nomornya ditolak untuk pesanan **baru**, tapi pesanan yang sedang aktif dengan nomor itu tetap berjalan normal.
26. Mengubah `settings.identity_mode` ke `marker_free` mematikan validasi daftar tanpa perubahan kode; `table_number_label` mengubah label di layar masuk.

**Arsip riwayat penjualan**

27. Pesanan `done` yang barisnya sudah dihapus purge 12 jam **tetap muncul** di `/laporan` lengkap dengan rincian item dan harga saat itu.
28. Menghapus item menu dari `/admin/menu` tidak menghilangkan/mengubah riwayat penjualan item tersebut (snapshot nama & harga bertahan).
29. Pesanan yang dibatalkan ikut terarsip dengan `status = 'cancelled'` + alasannya, dan tidak dihitung sebagai pendapatan di `daily_sales`.
30. Item yang dibatalkan waiter masuk arsip dengan `line_total = 0` dan tidak masuk `menu_sales`.
31. Permintaan tanpa sesi staf ke `sales_records`, `sales_record_items`, `daily_sales`, dan `menu_sales` **ditolak** — diuji dengan memanggil REST Supabase langsung pakai publishable key, bukan hanya lewat UI.
32. Superuser yang login **tidak bisa** UPDATE/DELETE baris arsip (append-only), diuji langsung lewat REST.
33. Nama pengunjung tidak ada di mana pun dalam arsip (`select * from sales_records` tidak memuat kolom/nilai nama).
34. Waiter menandai *Sudah diantar* setelah status `done` → `served_at` di arsip ikut ter-update (trigger memantau kolom `served_at`, bukan cuma `status`).
35. Waiter dan kitchen sama-sama bisa membuka `/laporan` dan melihat angka pendapatan (bukan hanya superuser).

**Semuanya jadi data, bukan kode (§14)**

36. `grep -rn` untuk nama menu, nama kategori, harga, nama brand, dan warna aksen tidak menemukan satu pun nilai hardcoded di luar `seed.sql`.
37. Mengganti seluruh menu, kategori, warna aksen, dan nama brand lewat dashboard → tidak ada satu pun deploy atau perubahan kode.
38. Menjalankan `supabase/migrations/*.sql` berurutan di project Supabase kosong → skema lengkap dan aplikasi langsung jalan.

---

## 12. Risiko

| Risiko | Dampak | Penanganan |
|---|---|---|
| Supabase free auto-pause 7 hari | **Risiko terbesar proyek ini** — porto mati diam-diam, dan yang menemukannya adalah reviewer | GitHub Action harian (gratis) + dicatat di README; Fase 6 |
| Cincin penuh saat kategori/item banyak | Lingkaran bertumpuk | Batasi cincin 12; lebih dari itu pakai lingkaran "Lainnya" (halaman kedua). Pengaman: `--radius` menyesuaikan `--total`. |
| Circular layout di layar sangat kecil (≤360px) | Terpotong | Breakpoint `--radius`/`--avatar` seperti wisnu-cms; uji di 360×640 |
| Animasi berat di tablet kiosk murah | Terasa lambat | Batasi animasi ke `transform`/`opacity`, `will-change` hemat, matikan parallax di touch |
| Next 16 beda dari yang diingat | Waktu terbuang | Baca `node_modules/next/dist/docs/` sebelum menulis kode (aturan `AGENTS.md` di wisnu-cms juga berlaku di sini) |
| Kebocoran RLS karena buru-buru | Nilai jelek di poin keamanan | Tulis policy bersamaan dengan fiturnya, dan uji poin 6, 7, 31, 32 secara eksplisit |
| **Penanda dipakai ulang → dua pesanan berbeda di nomor yang sama** | Makanan sampai ke orang yang salah di meja yang benar | Nama pemesan sejajar nomor meja di dapur & waiter (§3.1.2 poin 4), peringatan meja padat, dan siklus hidup penanda di v2. Uji 24. |
| `table_number` diperlakukan sebagai angka | `TA-3` / `A1` pecah, padahal penanda takeaway itu kebutuhan nyata | Tipe `text` di DB dan di seluruh tipe TypeScript. Uji 23 memakai nomor non-numerik dari ujung ke ujung. |
| Nilai spesifik pelanggan ter-hardcode "karena cuma demo" | Software tidak bisa dijual ke pelanggan kedua tanpa ngoprek kode | §14 sebagai daftar periksa + uji 36 & 37 (grep + ganti semuanya lewat dashboard) |
| Skema cuma hidup di dashboard Supabase | Project kena auto-pause/terhapus atau ingin mulai dari nol → skema hilang, susun ulang dari ingatan | SQL disimpan di `supabase/migrations/*.sql` bernomor (§14.1). Harganya nol. |
| Scope melar ke arah "produk siap jual" | Waktu habis di hal yang tidak dinilai reviewer, alur intinya malah belum selesai | Fase 0–4 adalah cerita utuh; §14 dibatasi ke "nilai jadi data", bukan perkakas operasional. Apa pun yang butuh tier berbayar otomatis di luar scope. |
| FK terpasang di `sales_records.order_id` (refleks "bikin relasi yang benar") | **Riwayat penjualan ikut terhapus purge 12 jam** — gagal memenuhi requirement inti | Komentar peringatan di DDL, plus kriteria uji 27 yang secara eksplisit menghapus baris `orders` lalu memastikan arsipnya masih ada |
| View rekap dibuat tanpa `security_invoker = on` | Pengunjung bisa membaca angka penjualan | Sudah ditulis di DDL; uji 31 memanggil view lewat publishable key |
| Pengaman salah-meja dibuat jadi penolakan, bukan peringatan | Pelanggan sah diblokir (keluarga 6 orang pesan bergiliran) | §3.1.1 menyebut eksplisit mana yang peringatan dan mana yang penolakan; uji 19 & 20 memastikan pesanan tetap bisa dibuat setelah peringatan |
| Mock payment = tidak ada friksi, dapur bisa dibanjiri | Demo bisa dirusak reviewer dalam 10 detik | Rate limit per `guest_token` + IP (§3.1.1 poin 8) dan KDS mem-cap tampilan, bukan data |
| Secret key dipakai demi cepat (atau bocor ke chat/commit/screenshot) | RLS jadi hiasan; satu env var bocor = seluruh DB terbuka | §7.1: aplikasi dirancang **tanpa** secret key — semua lewat RPC `security definer` + sesi staf. `.env.local` di `.gitignore` sejak commit pertama. Kalau pernah bocor: rotate, jangan cuma dihapus. |
| Arsip tumbuh tanpa batas | Menabrak 500 MB free tier (± setelah setahun di 300 pesanan/hari) | Sudah dihitung di §6.4; kalau perlu pangkas `events` atau agregasi arsip lama |
| Mock payment disangka nyata | Kesalahpahaman reviewer | Banner "MOCKUP — tidak ada transaksi nyata" di halaman bayar |

---

## 13. Jalur ke produksi (biar terlihat dipikirkan)

- **Xendit**: `payments` sudah punya `provider`, `external_id`, `raw`, dan ada `/api/webhooks/payment`. Yang berubah: halaman bayar memanggil pembuatan invoice, webhook memverifikasi tanda tangan lalu memajukan status. State machine tidak berubah.
- **Struk**: snapshot nama/harga di `sales_record_items` + `events` di `sales_records` sudah cukup untuk cetak ulang kapan pun, bahkan setelah pesanan hidupnya dihapus.
- **Multi-outlet / multi-tenant**: **bukan jalur yang dipilih** — modelnya satu deployment per pelanggan (§14.1). Peta ini disimpan hanya untuk kalau nanti jumlah pelanggan membuat biaya per-deployment terasa: tambah `outlet_id` di `categories`/`menu_items`/`table_markers`/`orders`/`staff`/`settings` **dan `sales_records`**, masukkan ke setiap policy RLS. Satu hal yang tetap layak dijaga sekarang meski multi-tenant belum dikerjakan: baca `settings` lewat **satu fungsi pembaca terpusat**, jangan `where id = 1` bertebaran di banyak file. Itu bukan pekerjaan ekstra, cuma disiplin — dan membuat perubahannya nanti sepele.
- **Siklus hidup penanda meja** (§3.1.2 poin 4): kolom status di `table_markers` + tabel `marker_sessions` + alur "serahkan penanda / penanda kembali" untuk resepsionis dan cleaning service. Menghapus seluruh kelas masalah nomor bertabrakan, dan ini fitur yang bisa dijual — tapi menuntut kedisiplinan staf, jadi tunggu ada pelanggan yang memintanya.
- **Mode identitas lain**: `queue` (nomor antrean tanpa meja, untuk kedai/takeaway) dan `table_qr` (meja permanen). Percabangannya sudah disiapkan di layar masuk; tinggal tambah cabang, bukan bongkar alur.
- **Laporan**: fondasinya sudah ada di v1 (§6.4) — arsip permanen + dua view rekap. Yang tersisa untuk produksi: ekspor CSV, filter rentang tanggal, grafik, laporan per shift, dan kebijakan retensi arsip di atas 1 tahun (agregasi ke tabel harian supaya tidak menabrak batas penyimpanan).
- **Pesanan gabungan per meja**: v1 sengaja tidak menggabungkan pesanan. Kalau nanti mau satu tagihan per meja (bayar di kasir di akhir), tambahkan `table_sessions` dan jadikan `orders.session_id` — arsipnya tidak perlu berubah bentuk, cuma tambah kolom.

---

## 14. Kesiapan untuk dijual — apa yang tidak boleh di-hardcode

Karena RM-IAM ditujukan untuk dijual, aturannya: **apa pun yang bisa berbeda antar rumah makan harus jadi data.** Ini daftar periksanya. Kalau saat implementasi ada nilai yang terasa "gampang, tulis saja di kode dulu", cari dulu di tabel ini.

| Hal | Di mana | Kenapa berbeda antar pelanggan |
|---|---|---|
| Nama & harga menu, deskripsi, gambar | `menu_items` | Jelas |
| Kategori, ikon, urutan di cincin, warna | `categories` | Struktur menu tiap rumah makan beda |
| Nama brand, warna aksen, tema | `settings` | Setiap pelanggan punya identitas sendiri |
| Teks hint & pengingat pembatalan | `settings` | Nada bahasa dan aturan tiap tempat beda |
| **Cara identifikasi meja** | `settings.identity_mode` | §3.1.2 — ini yang paling bervariasi |
| Label "Nomor Meja" | `settings.table_number_label` | Jadi "Nomor Antrean" di kedai takeaway |
| Nomor penanda meja & jenisnya | `table_markers` | Jumlah dan penomoran penanda milik mereka |
| Ambang peringatan duplikat & meja padat | `settings` | Ramai vs sepi butuh angka beda |
| Rate limit | `settings` | — |
| TTL halaman pesanan (12 jam) | `settings.order_ttl_hours` | Jam operasional beda; ada yang 24 jam |
| Idle timeout kiosk | `settings.kiosk_idle_secs` | — |
| Radius & ukuran dial | `settings.dial_radius_rem` | Ukuran layar kiosk mereka beda-beda |
| Zona waktu | `settings` (v2) | **v1 hardcode `Asia/Jakarta`** di `next_order_number()` dan view rekap. Ini utang teknis yang sadar — catat, dan pindahkan ke `settings` begitu ada pelanggan di luar WIB. |

Yang **boleh** tetap di kode: state machine pesanan, daftar peran, format nomor pesanan, dan aturan bahwa hanya waiter yang boleh membatalkan. Itu semua aturan produk, bukan preferensi pelanggan.

Satu hal yang perlu jujur diakui: **zona waktu masih hardcode** `Asia/Jakarta` di `next_order_number()` dan view rekap. Untuk demo ini tidak masalah — catat saja supaya tidak lupa kalau nanti benar-benar dipakai di luar WIB.

Yang **tidak** dikerjakan, dan sengaja: `outlet_id`/multi-tenant, perkakas onboarding pelanggan, apa pun yang butuh tier berbayar. Kalau nanti ada yang mau beli, §13 sudah memetakan jalannya. Jangan tambahkan `outlet_id` "biar siap" — kolom mati di 7 tabel plus ikut di setiap policy RLS, nol manfaat selama masih satu deployment.

### 14.1 Satu kebiasaan yang tetap dipakai: migrasi bernomor

Bukan demi jualan, tapi karena harganya nol dan menyelamatkan diri sendiri: **taruh SQL di file bernomor, bukan cuma ditempel ke SQL Editor.**

```
supabase/migrations/0001_init.sql
                    0002_sales_archive.sql
supabase/seed.sql          ← data contoh, dipisah
```

- Setiap perubahan skema = file baru; jangan edit file yang sudah dijalankan.
- Cara menjalankannya bebas: tempel ke SQL Editor Supabase juga sah untuk satu project. Supabase CLI (`supabase db push`) enak kalau mau, tapi **tidak wajib** dan bukan dependensi.
- Manfaat langsung untuk demo: kalau project Supabase kena auto-pause atau kamu ingin mulai dari nol, tinggal jalankan file-nya berurutan. Tanpa ini, skemanya cuma hidup di satu dashboard dan hilang kalau project-nya kenapa-kenapa.
- Manfaat untuk porto: reviewer bisa melihat riwayat skemanya di repo.

---

## Lampiran A — Demo script (taruh di README)

1. Buka `/` → isi meja **12**, nama **Reviewer** → Konfirmasi.
2. Ketuk **Makanan** → lingkaran terbang ke tengah → ketuk **Nasi Goreng** → qty 2 → Tambah. Perhatikan badge.
3. Ketuk tengah untuk kembali → **Minuman** → **Es Teh** ×1.
4. Scroll ke bawah lewat separator → cek daftar & total → **Lanjut Pembayaran**.
5. Di halaman mockup → **Bayar Sekarang** → masuk halaman tunggu, catat nomor pesanan.
6. Tab baru: login `dapur@demo.local` → `/dapur` → **Antrekan** → lihat halaman tunggu berubah sendiri.
7. Tab lain: login `waiter@demo.local` → `/waiter` → batalkan **Es Teh** → total berubah di mana-mana.
8. Balik ke `/dapur` → **Selesai** → halaman tunggu jadi "Pesanan siap!".
9. Di halaman tunggu → **Pesan Lagi** → meja & nama sudah terisi → pesan **Fried Fries** → bayar. Lihat `/dapur`: kartu baru bertanda *Meja 12 · +1 pesanan lain*.
10. `/laporan` → rekap hari ini muncul, **Nasi Goreng** teratas di item terlaris, pesanan yang dibatalkan tercatat terpisah dan tidak dihitung sebagai pendapatan.
11. Login `admin@demo.local` → `/admin/dial` → tambah kategori → refresh `/` → lingkaran baru muncul.

## Lampiran B — Pertanyaan terbuka

1. ~~Satu pesanan per kunjungan, atau boleh nambah pesanan ke meja yang sama?~~ **Diputuskan (12 Agu 2026): boleh nambah**, setiap tambahan jadi pesanan baru dengan nomor sendiri, staf melihatnya dikelompokkan per meja. Detail di §3.1.1.
2. Boleh pesan tanpa bayar dulu (bayar di kasir)? (Asumsi v1: **tidak** — selalu bayar dulu, seperti Mi Gacoan.)
3. ~~Nomor meja divalidasi atau bebas ketik?~~ **Diputuskan: divalidasi ke `table_markers`** untuk mode `marker` — himpunan nomornya memang terbatas pada penanda yang dimiliki rumah makan. Pelanggan yang penandanya belum terdata bisa pakai mode `marker_free`.
4. Perlu jeda "batal dalam 60 detik" setelah bayar? (Asumsi v1: **tidak** — aturannya sudah tegas: pembatalan hanya lewat waiter.)
5. ~~Nama disimpan berapa lama?~~ **Diputuskan: ikut umur pesanan, terhapus dalam 12 jam** — dan arsip penjualan sengaja tidak menyalin nama (§6.4). Jadi riwayat uang permanen, data pribadi tidak. Layak disebut saat presentasi.
6. ~~Angka pendapatan di `/laporan` boleh dilihat semua staf, atau superuser saja?~~ **Diputuskan (12 Agu 2026): semua staf** — waiter, kitchen, dan superuser sama-sama boleh melihat rekap termasuk pendapatan. Policy: `current_staff_role() is not null`.
7. ~~Perlu batas jumlah pesanan aktif per meja?~~ **Diputuskan: tidak ada batas keras.** Diganti pengaman berlapis di §3.1.1 — konfirmasi nomor besar, validasi ke daftar penanda, peringatan lunak untuk duplikat & meja padat, dan rate limit hanya sebagai penjaga penyalahgunaan.
8. ~~Apakah nama pemesan masih perlu diminta?~~ **Diputuskan: WAJIB, dan tidak bisa dihapus.** Karena penanda meja dipakai ulang (§3.1.2 poin 4), nama adalah satu-satunya pembeda ketika dua pesanan aktif memakai nomor yang sama. Kolom `ask_customer_name` di `settings` ada untuk mode `queue` nanti, **bukan** untuk dimatikan di mode `marker`.
9. **Baru:** QR **di penandanya** (ikut berpindah bersama nomornya, bukan ditempel di meja) — layak dikerjakan kapan? Tidak mengubah skema sama sekali, cuma menambah cara mengisi field yang sudah ada. (Usulku: setelah ada pelanggan pertama, karena butuh biaya cetak dan penandanya milik mereka.)
10. ~~Satu deployment per pelanggan atau multi-tenant?~~ **Diputuskan (12 Agu 2026): satu deployment per pelanggan**, bertahap. `outlet_id` **tidak** dikerjakan sekarang — jangan tambahkan kolom itu "biar siap", karena kolom yang tidak dipakai hanya menambah beban tanpa manfaat. Konsekuensi yang harus dikerjakan sejak Fase 0 ada di §14.1.
11. *(Ditunda — tidak relevan selama masih porto/demo.)* Kalau nanti benar-benar ada yang beli: project Supabase di akun siapa, dan biaya tier berbayar masuk ke harga jual bagaimana. Jangan dipikirkan sekarang.
