"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staff";

/*
  Aksi dapur: Antrekan (paid -> queued) dan Selesai (queued -> done).

  Perhatikan yang TIDAK ada di sini: pembatalan. Dapur memang tidak boleh
  membatalkan (PRD §2), dan itu bukan hanya soal tombol yang disembunyikan —
  trigger peran di 0005 akan menolaknya walau seseorang memanggil API langsung.
*/

const Input = z.object({
  orderId: z.uuid(),
  to: z.enum(["queued", "done"]),
});

export async function advanceOrderAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  const staff = await getStaff();
  if (!staff) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("orders")
    .select("status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.to })
    .eq("id", parsed.data.orderId);

  if (error) return { ok: false, error: error.message };

  // Jejak audit: siapa, kapan, dari status apa ke apa.
  await supabase.from("order_events").insert({
    order_id: parsed.data.orderId,
    actor_role: staff.role,
    actor_id: staff.id,
    from_status: before?.status ?? null,
    to_status: parsed.data.to,
    action: parsed.data.to === "queued" ? "queue" : "complete",
  });

  revalidatePath("/dapur");
  return { ok: true };
}
