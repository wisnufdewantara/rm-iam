import { createClient } from "@/lib/supabase/server";

export type StaffRole = "waiter" | "kitchen" | "superuser";

export type Staff = {
  id: string;
  name: string;
  role: StaffRole;
};

/** Staf yang sedang login, atau null. Dibaca dari tabel `staff` — jadi akun
 *  auth yang belum terdaftar sebagai staf tetap dianggap bukan staf. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Staff;
}

/** Dashboard bawaan tiap peran — dipakai setelah login dan saat salah peran. */
export function homeForRole(role: StaffRole): string {
  if (role === "kitchen") return "/dapur";
  if (role === "waiter") return "/waiter";
  return "/admin";
}
