import { signOutAction } from "@/lib/staffActions";
import type { Staff } from "@/lib/staff";

const ROLE_LABEL: Record<Staff["role"], string> = {
  kitchen: "Dapur",
  waiter: "Waiter",
  superuser: "Superuser",
};

export default function StaffBar({
  staff,
  title,
}: {
  staff: Staff;
  title: string;
}) {
  return (
    <header className="staffbar">
      <div>
        <span className="staffbar-title">{title}</span>
        <span className="staffbar-role">{ROLE_LABEL[staff.role]}</span>
      </div>
      <form action={signOutAction}>
        <span className="staffbar-name">{staff.name}</span>
        <button type="submit" className="staffbar-out">
          <span className="material-symbols-outlined">logout</span>
          Keluar
        </button>
      </form>
    </header>
  );
}
