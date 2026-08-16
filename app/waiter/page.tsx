import Link from "next/link";
import { redirect } from "next/navigation";
import StaffBar from "@/components/staff/StaffBar";
import { getStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

// Placeholder yang jujur. Tanpa ini, waiter yang login akan mentok 404 —
// dan halaman kosong pada demo terlihat seperti aplikasi yang rusak, bukan
// aplikasi yang belum selesai.
export default async function WaiterPage() {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/waiter");

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Waiter" />
      <div className="soon">
        <span className="material-symbols-outlined">construction</span>
        <h2>Layar waiter sedang dibangun</h2>
        <p>
          Nanti di sini: daftar pesanan aktif dikelompokkan per meja, pembatalan
          item atau seluruh pesanan, dan penandaan &ldquo;sudah diantar&rdquo;.
          Pembatalan memang hanya bisa lewat waiter — aturannya sudah berlaku di
          database, bukan menunggu halaman ini jadi.
        </p>
        {(staff.role === "superuser" || staff.role === "waiter") && (
          <Link href="/dapur" className="btn-ghost">
            Lihat layar dapur
          </Link>
        )}
      </div>
    </div>
  );
}
