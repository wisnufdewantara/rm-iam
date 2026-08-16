import { redirect } from "next/navigation";
import KitchenBoard from "@/components/staff/KitchenBoard";
import StaffBar from "@/components/staff/StaffBar";
import { getKitchenOrders } from "@/lib/kitchen";
import { getStaff, homeForRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function DapurPage() {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/dapur");

  // Salah peran → antar ke dashboard yang benar, bukan 403 buntu (PRD §8).
  if (staff.role !== "kitchen" && staff.role !== "superuser") {
    redirect(homeForRole(staff.role));
  }

  const orders = await getKitchenOrders();

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Dapur" />
      <KitchenBoard orders={orders} />
    </div>
  );
}
