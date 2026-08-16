"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type StaffRole } from "@/lib/staff";

const Credentials = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(1, "Password belum diisi"),
});

export async function signInAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    // Pesan sengaja tidak memisahkan "email tidak ada" dan "password salah":
    // membedakannya memberi tahu penyerang email mana yang terdaftar.
    return { error: "Email atau password salah." };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) {
    await supabase.auth.signOut();
    return {
      error:
        "Akun ini belum terdaftar sebagai staf. Jalankan supabase/seed_staff.sql.",
    };
  }

  redirect(homeForRole(staff.role as StaffRole));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}
