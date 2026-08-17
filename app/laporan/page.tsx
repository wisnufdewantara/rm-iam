import { redirect } from "next/navigation";
import StaffBar from "@/components/staff/StaffBar";
import { getStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/types";

export const dynamic = "force-dynamic";

type Daily = {
  day: string;
  orders_done: number;
  orders_cancelled: number;
  revenue: number;
  items_sold: number;
};
type MenuSale = { name: string; qty_sold: number; revenue: number };
type Record_ = {
  order_number: string;
  table_number: string;
  status: "done" | "cancelled";
  total: number;
  item_count: number;
  cancel_reason: string | null;
  completed_at: string | null;
  archived_at: string;
};

/*
  Riwayat penjualan — SEMUA staf boleh melihat (keputusan 12 Agu 2026), tapi
  pengunjung tidak sama sekali: tabel arsip tidak punya policy untuk `anon`.

  Halaman ini memakai klien bersesi staf, BUKAN secret key. Kalau memakai secret
  key, policy RLS-nya cuma jadi hiasan.

  Datanya bertahan walau pesanan hidupnya sudah dihapus purge 12 jam — itu
  memang inti dari arsip ini.
*/
export default async function LaporanPage() {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/laporan");

  const supabase = await createClient();
  const [daily, menu, recent] = await Promise.all([
    supabase.from("daily_sales").select("*").limit(30),
    supabase.from("menu_sales").select("*").limit(15),
    supabase
      .from("sales_records")
      .select(
        "order_number, table_number, status, total, item_count, cancel_reason, completed_at, archived_at"
      )
      .order("archived_at", { ascending: false })
      .limit(40),
  ]);

  const days = (daily.data ?? []) as Daily[];
  const items = (menu.data ?? []) as MenuSale[];
  const records = (recent.data ?? []) as Record_[];
  const today = days[0];

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Laporan" />
      <div className="adm">
        {today && (
          <section className="rep-tiles">
            <div className="rep-tile">
              <span className="rep-cap">Pendapatan hari ini</span>
              <strong>{rupiah(today.revenue)}</strong>
            </div>
            <div className="rep-tile">
              <span className="rep-cap">Pesanan selesai</span>
              <strong>{today.orders_done}</strong>
            </div>
            <div className="rep-tile">
              <span className="rep-cap">Item terjual</span>
              <strong>{today.items_sold}</strong>
            </div>
            <div className="rep-tile">
              <span className="rep-cap">Dibatalkan</span>
              <strong>{today.orders_cancelled}</strong>
            </div>
          </section>
        )}

        <section className="adm-sec">
          <h2>Rekap harian</h2>
          {days.length === 0 ? (
            <p className="kds-empty">Belum ada pesanan yang selesai.</p>
          ) : (
            <div className="rep-scroll">
              <table className="rep">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th className="num">Selesai</th>
                    <th className="num">Dibatalkan</th>
                    <th className="num">Item</th>
                    <th className="num">Pendapatan</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td className="num">{d.orders_done}</td>
                      <td className="num">{d.orders_cancelled}</td>
                      <td className="num">{d.items_sold}</td>
                      <td className="num">{rupiah(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adm-sec">
          <h2>Item terlaris</h2>
          {items.length === 0 ? (
            <p className="kds-empty">Belum ada data.</p>
          ) : (
            <div className="rep-scroll">
              <table className="rep">
                <thead>
                  <tr>
                    <th>Menu</th>
                    <th className="num">Terjual</th>
                    <th className="num">Pendapatan</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.name}>
                      <td>{i.name}</td>
                      <td className="num">{i.qty_sold}</td>
                      <td className="num">{rupiah(i.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adm-sec">
          <h2>Arsip pesanan</h2>
          <p className="adm-sub">
            Tetap ada walau halaman pesanannya sudah kedaluwarsa dan barisnya
            dihapus. Nama tamu sengaja tidak diarsipkan.
          </p>
          {records.length === 0 ? (
            <p className="kds-empty">Belum ada arsip.</p>
          ) : (
            <div className="rep-scroll">
              <table className="rep">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Meja</th>
                    <th>Status</th>
                    <th className="num">Item</th>
                    <th className="num">Total</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.order_number}>
                      <td>{r.order_number}</td>
                      <td>{r.table_number}</td>
                      <td>
                        <span className={`pill pill-${r.status}`}>
                          {r.status === "done" ? "Selesai" : "Dibatalkan"}
                        </span>
                      </td>
                      <td className="num">{r.item_count}</td>
                      <td className="num">{rupiah(r.total)}</td>
                      <td className="rep-reason">{r.cancel_reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
