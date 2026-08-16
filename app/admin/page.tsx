import Link from "next/link";
import { redirect } from "next/navigation";
import StaffBar from "@/components/staff/StaffBar";
import { getStaff, homeForRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/admin");
  if (staff.role !== "superuser") redirect(homeForRole(staff.role));

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Admin" />
      <div className="soon">
        <span className="material-symbols-outlined">construction</span>
        <h2>Dashboard superuser sedang dibangun</h2>
        <p>
          Nanti di sini: CRUD menu &amp; kategori, konfigurasi dial, kelola
          penanda meja, kelola staf, dan laporan penjualan. Sementara ini menu
          masih diubah lewat SQL Editor Supabase.
        </p>
        <div className="soon-links">
          <Link href="/dapur" className="btn-ghost">
            Layar dapur
          </Link>
          <Link href="/waiter" className="btn-ghost">
            Layar waiter
          </Link>
        </div>
      </div>
    </div>
  );
}
