// Kredit pembuat. Ditaruh di layout supaya muncul di semua halaman —
// termasuk layar masuk dan halaman setup.
//
// Sengaja di kode, bukan di tabel `settings`: ini atribusi penulis, bukan
// preferensi pelanggan. Nama rumah makan yang boleh diganti per pelanggan
// (PRD §14), bukan barisnya ini.
export default function Credit() {
  return (
    <footer className="credit">
      <p>
        © {new Date().getFullYear()} · Created by <strong>Wisnu Dewantara</strong>{" "}
        <a href="mailto:wisnupriester@gmail.com">wisnupriester@gmail.com</a>
      </p>
      <p>
        Assisted by <strong>Kucing Oren</strong>{" "}
        <a href="mailto:iamgorange@gmail.com">iamgorange@gmail.com</a>
      </p>
      <p className="credit-tech">
        Powered with <strong>Claude Opus 5</strong>
      </p>
    </footer>
  );
}
