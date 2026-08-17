# Panduan RM-IAM

**Aplikasi pesan-sendiri untuk rumah makan.** Panduan ini ditulis untuk siapa
saja — tidak perlu latar belakang teknis.

🔗 **Coba langsung: https://rm-iam.vercel.app**

---

## Apa ini sebenarnya

Bayangkan Anda makan di rumah makan yang ramai. Biasanya Anda harus mengantre di
kasir, menyebutkan pesanan, mengulanginya karena tidak terdengar, lalu menunggu
tanpa tahu pesanan Anda sudah dimasak atau belum.

RM-IAM menghapus antrean itu. Pengunjung memesan sendiri dari ponselnya — atau
dari layar sentuh yang dipasang di dekat kasir — lalu mendapat halaman yang
memberitahu perkembangan pesanannya: *sudah dibayar*, *sedang disiapkan*,
*siap diambil*.

Di sisi dalam, dapur mendapat layar berisi daftar pesanan yang masuk, dan
pelayan mendapat layar untuk mengurus pembatalan atau mengantar. Semuanya
tersambung: begitu dapur menekan satu tombol, halaman di ponsel pengunjung
berubah dengan sendirinya — tanpa perlu di-refresh.

Aplikasi ini dibuat untuk rumah makan bergaya kekinian — mi ayam, nasi goreng,
kedai yang ramai dan cepat.

---

## Filosofi desain: **Orbit Culture**

Hampir semua aplikasi pesan-makanan berbentuk daftar panjang yang di-scroll ke
bawah. RM-IAM tidak. Di sini menu berbentuk **lingkaran-lingkaran yang saling
mengitari sesuatu yang lebih besar di tengah**.

Aturannya cuma satu, dan itu yang membuatnya terasa hidup:

> **Apa yang Anda pilih menjadi pusat, dan sisanya mengitarinya.**

Praktiknya begini:

```
       ○   ○   ○                       ○   ○   ○
    ○             ○                 ○             ○
   ○    ┌─────┐    ○      →        ○   ┌───────┐   ○
        │  12 │                        │  Nasi │
   ○    │Meja │    ○               ○   │ Goreng│   ○
    ○   └─────┘   ○                 ○  └───────┘  ○
       ○   ○   ○                       ○   ○   ○

  Tengah: nomor meja Anda            Anda ketuk "Nasi Goreng" —
  Sekeliling: kategori menu          lingkarannya TERBANG KE TENGAH,
                                     dan sekelilingnya berganti
                                     menjadi daftar nasi gorengnya
```

Ketuk lingkaran tengah untuk kembali. Selesai — itu seluruh cara
menavigasinya. Tidak ada menu bertumpuk, tidak ada tombol "kembali" yang
membingungkan, tidak ada halaman yang hilang entah ke mana.

Cincinnya punya **12 posisi, seperti angka pada jam**. Kalau satu kategori
punya lebih dari 12 menu — kategori Nasi Goreng punya 18 — satu posisi dipakai
tombol berwarna berbeda untuk pindah ke halaman berikutnya. Warnanya sengaja
dibedakan supaya tidak keliru diketuk sebagai makanan.

Angka merah kecil di sudut lingkaran memberitahu berapa banyak yang sudah Anda
pesan, dan angka itu ikut menjumlah ke lingkaran kategorinya. Jadi Anda selalu
tahu isi pesanan tanpa harus membukanya.

### Fun fact di balik namanya

**Orbit Culture** diambil dari nama band metal Swedia favorit developer-nya.
Di bandnya, namanya tidak dimaksudkan berarti apa-apa secara khusus — di sini
developer-nya "mencocok-logikan" jadi filosofi desain. 😄

Kebetulan cocoknya lumayan pas: **orbit** karena elemennya benar-benar
mengitari satu pusat, dan **culture** karena aturan "yang dipilih jadi pusat"
berlaku konsisten di seluruh aplikasi — bukan cuma di satu halaman.

---

## Coba sendiri dalam 3 menit

Buka **https://rm-iam.vercel.app**

### Sebagai pengunjung

1. **Masukkan nomor meja `12` dan nama Anda**, lalu konfirmasi.
   Nomor mejanya akan ditampilkan besar-besar untuk dicocokkan. (Kenapa
   demikian? Lihat bagian *Hal-hal yang mungkin bikin penasaran* di bawah.)

2. **Ketuk lingkaran "Nasi Goreng."** Perhatikan lingkarannya berpindah ke
   tengah, dan sekelilingnya berubah menjadi 18 pilihan nasi goreng. Ketuk
   lingkaran abu-abu bertanda `1/2` untuk melihat sisanya.

3. **Ketuk "Ayam."** Muncul kotak berisi harga dan keterangan. Pilih catatan
   cepat **"Pedas"** lalu tekan *Tambah*.

4. **Jangan tutup kotaknya.** Pilih **"Tidak pedas"** lalu tekan *Tambah*
   sekali lagi. Sekarang lihat ke bawah — pesanannya jadi **dua baris
   terpisah**, bukan satu baris berisi 2. Inilah bagian yang paling sering
   salah di aplikasi lain.

5. **Geser ke bawah** melewati garis pemisah untuk melihat daftar pesanan, lalu
   tekan **Lanjut Pembayaran** → **Bayar Sekarang**.

6. Anda masuk **halaman tunggu**. **Biarkan tab ini terbuka** — kita akan
   melihatnya berubah sendiri.

### Sebagai staf (buka tab baru)

Buka **https://rm-iam.vercel.app/masuk**

| Masuk sebagai | Untuk melihat |
|---|---|
| `dapur@demo.local` | Layar dapur |
| `waiter@demo.local` | Layar pelayan |
| `admin@demo.local` | Pengaturan menu & laporan |

*(Password ketiganya sama — ada di catatan yang dikirim terpisah, sengaja tidak
ditaruh di dokumen ini.)*

7. **Masuk sebagai `dapur@demo.local`.** Pesanan Anda tadi ada di kolom
   **Masuk**. Tekan **Antrekan** — lalu **lihat tab pengunjung tadi**. Dalam
   beberapa detik statusnya berubah menjadi *Diantre*, **tanpa Anda refresh
   apa pun**. Tekan **Selesai**, dan tab pengunjung berubah jadi centang hijau.

8. **Keluar, masuk sebagai `waiter@demo.local`.** Coba batalkan satu menu:
   totalnya langsung dihitung ulang di semua layar, termasuk di halaman
   pengunjung. Coba juga **Batalkan pesanan** — tombolnya terkunci sampai Anda
   mengisi alasan, dan alasan itu sampai ke pengunjung.

9. **Masuk sebagai `admin@demo.local` → Kelola Menu.** Ubah harga menu apa pun,
   simpan, lalu refresh tab pengunjung. Harganya sudah berubah — **tanpa
   perlu memperbarui aplikasinya**. Semua menu, harga, kategori, dan warna
   diatur dari halaman ini.

10. Buka **Laporan** — pesanan yang selesai dan yang dibatalkan sudah tercatat,
    lengkap dengan alasan pembatalannya.

### Bonus: mode anjungan

Buka **https://rm-iam.vercel.app/?mode=kiosk**

Ini tampilan untuk layar sentuh yang dipasang permanen di rumah makan: tombol
lebih besar, ada papan angka di layar (karena tablet yang dipasang permanen
sering tidak punya keyboard), dan layarnya membersihkan diri sendiri kalau
ditinggalkan — supaya pengunjung berikutnya tidak melanjutkan pesanan orang
sebelumnya.

Ada juga tombol bulan/matahari di kanan atas untuk mode gelap.

---

## Siapa bisa apa

| Peran | Perlu login? | Bisa melakukan |
|---|---|---|
| **Pengunjung** | Tidak | Melihat menu, memesan, membayar, memantau pesanannya |
| **Dapur** | Ya | Melihat semua pesanan, menandai *diantre* dan *selesai* |
| **Pelayan** | Ya | Membatalkan menu atau pesanan, menandai sudah diantar |
| **Admin** | Ya | Semua di atas + mengatur menu, harga, dan tampilan |

Perhatikan yang **tidak** bisa dilakukan masing-masing — itu justru bagian
pentingnya:

- **Pengunjung tidak bisa membatalkan pesanannya sendiri** setelah membayar.
  Harus lewat pelayan. Aturan ini ditulis jelas di layar pengunjung supaya tidak
  ada yang merasa dikelabui.
- **Dapur tidak bisa membatalkan apa pun.** Tidak ada tombolnya — dan kalaupun
  seseorang mencoba mengakalinya dari luar aplikasi, sistemnya tetap menolak.
- **Pelayan tidak bisa memajukan pesanan** ke tahap "sedang disiapkan". Itu
  wewenang dapur.

Pembagian ini dijaga di lapisan paling dalam (basis datanya), bukan hanya dengan
menyembunyikan tombol. Menyembunyikan tombol saja mudah diakali; ini tidak.

---

## Hal-hal yang mungkin bikin penasaran

**Kenapa nomor meja diketik, bukan scan QR?**
Karena di banyak rumah makan, nomor meja bukan menempel di mejanya — nomornya
ada di **penanda yang bisa dipindah**: standee, plakat, atau asbak bernomor
yang diberikan resepsionis, dibawa pengunjung ke meja mana pun yang kosong, lalu
diambil petugas kebersihan untuk dipakai ulang. Kalau QR ditempel di meja,
nomor di QR dan nomor di penanda bisa berbeda — dan yang benar adalah
penandanya, karena itu yang dilihat pelayan saat mengantar. Jadi pengunjung
menyalin angka dari benda yang ada di depannya, dan layar konfirmasi menampilkan
angka itu besar-besar supaya mudah dicocokkan.

**Kenapa "pedas" dan "tidak pedas" jadi dua baris terpisah?**
Karena kalau digabung, dapur menerima tulisan seperti *"3 nasi goreng, yang 1
pedas"* — dan seseorang harus menafsirkannya di tengah jam sibuk. Itu sumber
pesanan salah yang nyata. Dengan dipisah, dapur menerima daftar yang jelas
tanpa perlu ditafsirkan.

**Kenapa nama pemesan wajib diisi?**
Karena penanda meja dipakai ulang. Bisa terjadi dua pesanan berbeda memakai
nomor yang sama dalam waktu berdekatan — dan nama pemesanlah yang
membedakannya. Karena itu nama ditampilkan sebesar nomor meja di layar dapur,
bukan sebagai keterangan kecil.

**Kenapa halaman pesanan hilang setelah beberapa jam?**
Halaman pesanan hidup 12 jam setelah pesanan selesai, lalu dihapus. Nomor
pesanan hari ini akan dipakai lagi besok, jadi halaman lama tidak boleh
menumpuk. Riwayat penjualannya tetap tersimpan permanen untuk pemilik — tetapi
nama pengunjung ikut terhapus, karena untuk laporan penjualan nama tidak
dibutuhkan.

---

## Yang masih berupa tiruan

Supaya tidak ada salah paham:

- **Pembayaran belum sungguhan.** Tombol *Bayar Sekarang* langsung menandai
  pesanan sebagai lunas. Halamannya diberi label **MOCKUP** yang jelas. Sistem
  pembayaran asli (Xendit) belum dipasang, tapi tempatnya sudah disiapkan
  sehingga bisa ditambahkan tanpa mengubah alurnya.
- **Menu belum berfoto.** Semua menu memakai ikon. Tampilannya sudah siap
  menampilkan foto — tinggal diisi dari halaman admin.
- **Akun staf dibuat dari luar aplikasi.** Ini keputusan yang diambil sadar:
  membuat akun dari dalam aplikasi memerlukan kunci akses tingkat tertinggi, dan
  aplikasi ini sengaja dirancang untuk **tidak pernah** memegang kunci
  semacam itu.

---

## Kalau demonya tidak bisa dibuka

Demo ini berjalan di layanan gratis, dan basis datanya otomatis "tidur" kalau
tidak ada aktivitas selama beberapa hari. Sudah ada dua penjaga otomatis yang
membangunkannya setiap hari, tapi kalau ternyata tetap tidak bisa dibuka,
kabari saja — membangunkannya hanya perlu beberapa menit.

Kalau halamannya memberi pesan tentang konfigurasi atau basis data, itu pesan
yang memang disengaja: aplikasinya menjelaskan apa yang kurang, bukan
menampilkan halaman error kosong.

---

## Untuk yang ingin melihat sisi teknisnya

- **Kode:** https://github.com/wisnufdewantara/rm-iam
- **Dokumen rancangan lengkap:** [docs/PRD.md](PRD.md) — memuat alasan di balik
  setiap keputusan, termasuk yang ditolak dan mengapa
- **Cara menjalankan sendiri:** [README.md](../README.md)

Ringkasnya: Next.js 16, React 19, TypeScript, Supabase (PostgreSQL). Seluruh
aturan peran dan keamanan ditegakkan di basis data, bukan di antarmuka.
Aplikasinya tidak pernah memegang kunci yang bisa melewati aturan keamanan itu.
Semuanya berjalan di layanan tingkat gratis.

---

Dibuat oleh **Wisnu Dewantara** · wisnupriester@gmail.com
Dibantu **Kucing Oren** · iamgorange@gmail.com · dengan **Claude Opus 5**
