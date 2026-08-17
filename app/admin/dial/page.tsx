import { redirect } from "next/navigation";
import AdminNotice from "@/components/staff/AdminNotice";
import StaffBar from "@/components/staff/StaffBar";
import { updateSettingsAction } from "@/lib/adminActions";
import { getSettings } from "@/lib/settings";
import { getStaff, homeForRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function AdminDialPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/admin/dial");
  if (staff.role !== "superuser") redirect(homeForRole(staff.role));

  const { ok, err } = await searchParams;
  const s = await getSettings();

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Konfigurasi" />
      <div className="adm adm-narrow">
        <AdminNotice ok={ok} err={err} />

        <form action={updateSettingsAction} className="adm-form">
          <section className="adm-sec">
            <h2>Identitas</h2>
            <label className="adm-f">
              <span>Nama brand</span>
              <input name="brand_name" defaultValue={s.brand_name} required />
            </label>
            <label className="adm-f">
              <span>Warna aksen</span>
              <input name="accent" defaultValue={s.accent} pattern="^#[0-9a-fA-F]{6}$" required />
            </label>
            <label className="adm-f">
              <span>Tema</span>
              <select name="theme" defaultValue={s.theme}>
                <option value="light">Terang</option>
                <option value="dark">Gelap</option>
              </select>
            </label>
            <label className="adm-f">
              <span>Teks petunjuk di dial</span>
              <input name="hint_text" defaultValue={s.hint_text} required />
            </label>
            <label className="adm-f">
              <span>Pengingat pembatalan</span>
              <input name="cancel_notice" defaultValue={s.cancel_notice} required />
            </label>
          </section>

          <section className="adm-sec">
            <h2>Cara tamu mengenali mejanya</h2>
            <p className="adm-sub">
              Ini bagian yang paling berbeda antar rumah makan. Nomor meja di sini
              bukan alamat tetap — dia penanda fisik yang dipinjamkan lalu dipakai
              ulang, jadi nama pemesan tetap wajib sebagai pembeda.
            </p>
            <label className="adm-f">
              <span>Mode identitas</span>
              <select name="identity_mode" defaultValue={s.identity_mode}>
                <option value="marker">Penanda meja, divalidasi ke daftar</option>
                <option value="marker_free">Penanda meja, nomor bebas</option>
                <option value="table_qr">QR di meja permanen (belum dibangun)</option>
                <option value="queue">Nomor antrean tanpa meja (belum dibangun)</option>
              </select>
            </label>
            <label className="adm-f">
              <span>Label nomor</span>
              <input name="table_number_label" defaultValue={s.table_number_label} required />
            </label>
            <label className="adm-chk">
              <input
                type="checkbox"
                name="ask_customer_name"
                defaultChecked={s.ask_customer_name}
              />
              Minta nama pemesan (jangan dimatikan pada mode penanda meja)
            </label>
          </section>

          <section className="adm-sec">
            <h2>Dial</h2>
            <label className="adm-f">
              <span>Jumlah slot cincin (6–12)</span>
              <input
                name="dial_max_ring"
                type="number"
                min={6}
                max={12}
                defaultValue={s.dial_max_ring}
              />
            </label>
            <p className="adm-sub">
              12 mengikuti angka pada jam. Kalau item lebih banyak dari slot, satu
              slot dipakai lingkaran navigasi berwarna beda.
            </p>
            <label className="adm-f">
              <span>Catatan cepat bawaan (dipisah koma)</span>
              <input name="note_presets" defaultValue={s.note_presets.join(", ")} />
            </label>
            <p className="adm-sub">
              Dipakai kalau kategori tidak punya catatan cepatnya sendiri.
            </p>
          </section>

          <section className="adm-sec">
            <h2>Operasional</h2>
            <label className="adm-f">
              <span>Umur halaman pesanan setelah selesai (jam)</span>
              <input name="order_ttl_hours" type="number" min={1} max={168} defaultValue={s.order_ttl_hours} />
            </label>
            <label className="adm-f">
              <span>Idle kiosk sebelum reset (detik)</span>
              <input name="kiosk_idle_secs" type="number" min={15} max={600} defaultValue={s.kiosk_idle_secs} />
            </label>
          </section>

          <section className="adm-sec">
            <h2>Peringatan &amp; pengaman</h2>
            <p className="adm-sub">
              Dua yang pertama hanya <strong>memperingatkan</strong> — tamu tetap
              bisa melanjutkan. Dua yang terakhir benar-benar{" "}
              <strong>menolak</strong>, dan angkanya sengaja jauh di atas perilaku
              wajar supaya pelanggan sungguhan tidak pernah menyentuhnya.
            </p>
            <label className="adm-f">
              <span>Jendela deteksi pesanan kembar (detik)</span>
              <input name="duplicate_window_secs" type="number" min={0} max={600} defaultValue={s.duplicate_window_secs} />
            </label>
            <label className="adm-f">
              <span>Peringatkan bila meja sudah punya N pesanan aktif</span>
              <input name="same_table_warn_threshold" type="number" min={1} max={50} defaultValue={s.same_table_warn_threshold} />
            </label>
            <label className="adm-f">
              <span>Jeda minimal antar pesanan (detik)</span>
              <input name="guest_order_rate_limit_secs" type="number" min={0} max={600} defaultValue={s.guest_order_rate_limit_secs} />
            </label>
            <label className="adm-f">
              <span>Maksimal pesanan per jam per perangkat</span>
              <input name="guest_paid_orders_per_hour" type="number" min={1} max={200} defaultValue={s.guest_paid_orders_per_hour} />
            </label>
          </section>

          <button type="submit" className="btn-primary">
            Simpan konfigurasi
          </button>
        </form>
      </div>
    </div>
  );
}
