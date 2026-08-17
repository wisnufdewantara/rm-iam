import { redirect } from "next/navigation";
import StaffBar from "@/components/staff/StaffBar";
import WaiterBoard from "@/components/staff/WaiterBoard";
import { getStaff, homeForRole } from "@/lib/staff";
import { getWaiterOrders } from "@/lib/waiter";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/waiter");

  // Salah peran → antar ke dashboard yang benar, bukan 403 buntu (PRD §8).
  if (staff.role !== "waiter" && staff.role !== "superuser") {
    redirect(homeForRole(staff.role));
  }

  const orders = await getWaiterOrders();

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Waiter" />
      <WaiterBoard orders={orders} />
    </div>
  );
}
