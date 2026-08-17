import Link from "next/link";
import { redirect } from "next/navigation";
import StaffBar from "@/components/staff/StaffBar";
import { getStaff, homeForRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin/menu", icon: "restaurant_menu", title: "Kelola Menu",
    desc: "Kategori, item, harga, ketersediaan, catatan cepat." },
  { href: "/admin/dial", icon: "tune", title: "Konfigurasi",
    desc: "Brand, warna, slot dial, mode identitas meja, ambang peringatan." },
  { href: "/admin/penanda", icon: "table_restaurant", title: "Penanda Meja",
    desc: "Nomor penanda fisik yang dipinjamkan ke tamu." },
  { href: "/laporan", icon: "receipt_long", title: "Laporan",
    desc: "Rekap harian, item terlaris, arsip pesanan." },
  { href: "/dapur", icon: "skillet", title: "Layar Dapur",
    desc: "Antrekan dan selesaikan pesanan." },
  { href: "/waiter", icon: "room_service", title: "Layar Waiter",
    desc: "Batalkan item/pesanan, tandai sudah diantar." },
];

export default async function AdminPage() {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/admin");
  if (staff.role !== "superuser") redirect(homeForRole(staff.role));

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Admin" />
      <div className="adm">
        <div className="adm-tiles">
          {LINKS.map((l) => (
            <Link href={l.href} className="adm-tile" key={l.href}>
              <span className="material-symbols-outlined">{l.icon}</span>
              <strong>{l.title}</strong>
              <span className="adm-tile-desc">{l.desc}</span>
            </Link>
          ))}
        </div>

        <p className="adm-hint">
          <strong>Akun staf dikelola dari dashboard Supabase</strong> (Authentication
          → Users), lalu dicocokkan lewat <code>supabase/seed_staff.sql</code>.
          Membuat akun dari halaman ini butuh kunci yang menembus RLS, dan aplikasi
          ini sengaja tidak pernah memegang kunci seperti itu.
        </p>
      </div>
    </div>
  );
}
