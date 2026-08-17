import { redirect } from "next/navigation";
import AdminNotice from "@/components/staff/AdminNotice";
import StaffBar from "@/components/staff/StaffBar";
import {
  createMarkerAction,
  deleteMarkerAction,
  toggleMarkerAction,
} from "@/lib/adminActions";
import { getStaff, homeForRole } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Marker = {
  id: string;
  number: string;
  label: string | null;
  kind: "dine_in" | "takeaway";
  is_active: boolean;
};

export default async function AdminPenandaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/admin/penanda");
  if (staff.role !== "superuser") redirect(homeForRole(staff.role));

  const { ok, err } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("table_markers")
    .select("id, number, label, kind, is_active")
    .order("kind")
    .order("number");

  const markers = (data ?? []) as Marker[];

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Penanda Meja" />
      <div className="adm adm-narrow">
        <AdminNotice ok={ok} err={err} />

        <p className="adm-hint">
          Ini <strong>penanda</strong> — standee atau plakat bernomor yang
          dipinjamkan ke tamu lalu dikembalikan petugas dan dipakai ulang. Bukan
          lokasi meja permanen, jadi jumlahnya tidak harus sama dengan jumlah meja.
          Nonaktifkan penanda yang hilang atau rusak; pesanan yang sedang berjalan
          dengan nomor itu tetap jalan, hanya pesanan baru yang ditolak.
        </p>

        <section className="adm-sec">
          <h2>Daftar penanda ({markers.length})</h2>
          <div className="mk-grid">
            {markers.map((m) => (
              <form action={toggleMarkerAction} className={`mk ${m.is_active ? "" : "is-off"}`} key={m.id}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="to" value={m.is_active ? "off" : "on"} />
                <span className="mk-num">{m.number}</span>
                <span className="mk-meta">
                  {m.kind === "takeaway" ? "Bungkus" : (m.label ?? "Dine-in")}
                </span>
                <button type="submit" className="mk-toggle">
                  {m.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  type="submit"
                  formAction={deleteMarkerAction}
                  className="cart-del"
                  aria-label={`Hapus penanda ${m.number}`}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="adm-sec">
          <h2>Tambah penanda</h2>
          <form action={createMarkerAction} className="adm-row adm-new">
            <label className="adm-f">
              <span>Nomor</span>
              <input name="number" placeholder="13 atau TA-4" required maxLength={16} />
            </label>
            <label className="adm-f">
              <span>Label</span>
              <input name="label" placeholder="Standee kayu (opsional)" />
            </label>
            <label className="adm-f">
              <span>Jenis</span>
              <select name="kind" defaultValue="dine_in">
                <option value="dine_in">Dine-in</option>
                <option value="takeaway">Bungkus</option>
              </select>
            </label>
            <button type="submit" className="btn-primary adm-add">
              Tambah
            </button>
          </form>
          <p className="adm-sub">
            Nomor bertipe teks, jadi <code>TA-4</code> dan <code>A1</code> sah —
            bukan hanya angka.
          </p>
        </section>
      </div>
    </div>
  );
}
