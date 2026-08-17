"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaff, type Staff } from "@/lib/staff";

/*
  Aksi waiter: batalkan item, batalkan pesanan, tandai sudah diantar.

  Pembatalan HANYA lewat waiter (PRD §2), dan itu ditegakkan trigger peran di
  0005 — bukan oleh fungsi ini. Yang dikerjakan di sini adalah bagian yang
  tidak bisa dilakukan trigger: mencatat SIAPA dan MENGAPA ke order_events,
  supaya setiap pembatalan bisa dipertanggungjawabkan.

  Total tidak dihitung di sini. Trigger order_items_after_change (0003) yang
  menghitung ulang dari baris item — jadi tidak ada dua sumber angka uang.
*/

type Gate = { ok: true; staff: Staff } | { ok: false; error: string };

async function requireWaiter(): Promise<Gate> {
  const staff = await getStaff();
  if (!staff) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };
  if (staff.role !== "waiter" && staff.role !== "superuser") {
    return { ok: false, error: "Hanya waiter yang boleh melakukan ini." };
  }
  return { ok: true, staff };
}

const CancelItem = z.object({
  orderId: z.uuid(),
  itemId: z.uuid(),
});

export async function cancelItemAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = CancelItem.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  const gate = await requireWaiter();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("order_items")
    .select("name, qty, status")
    .eq("id", parsed.data.itemId)
    .maybeSingle();

  if (!item) return { ok: false, error: "Item tidak ditemukan." };
  if (item.status === "cancelled") return { ok: true }; // idempoten

  const { error } = await supabase
    .from("order_items")
    .update({ status: "cancelled", cancelled_by: gate.staff.id })
    .eq("id", parsed.data.itemId);

  if (error) return { ok: false, error: error.message };

  await supabase.from("order_events").insert({
    order_id: parsed.data.orderId,
    actor_role: gate.staff.role,
    actor_id: gate.staff.id,
    action: "cancel_item",
    detail: { item: item.name, qty: item.qty },
  });

  revalidatePath("/waiter");
  revalidatePath("/dapur");
  return { ok: true };
}

const CancelOrder = z.object({
  orderId: z.uuid(),
  // Alasan WAJIB: pembatalan tanpa alasan membuat jejak auditnya tidak berguna,
  // dan tamu berhak tahu kenapa pesanannya dibatalkan.
  reason: z.string().trim().min(3, "Alasan pembatalan wajib diisi").max(200),
});

export async function cancelOrderAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = CancelOrder.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Tidak valid" };
  }

  const gate = await requireWaiter();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("orders")
    .select("status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: parsed.data.reason,
      cancelled_by: gate.staff.id,
    })
    .eq("id", parsed.data.orderId);

  if (error) return { ok: false, error: error.message };

  await supabase.from("order_events").insert({
    order_id: parsed.data.orderId,
    actor_role: gate.staff.role,
    actor_id: gate.staff.id,
    from_status: before?.status ?? null,
    to_status: "cancelled",
    action: "cancel_order",
    detail: { reason: parsed.data.reason },
  });

  revalidatePath("/waiter");
  revalidatePath("/dapur");
  return { ok: true };
}

const MarkServed = z.object({ orderId: z.uuid() });

export async function markServedAction(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = MarkServed.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  const gate = await requireWaiter();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ served_at: new Date().toISOString() })
    .eq("id", parsed.data.orderId);

  if (error) return { ok: false, error: error.message };

  await supabase.from("order_events").insert({
    order_id: parsed.data.orderId,
    actor_role: gate.staff.role,
    actor_id: gate.staff.id,
    action: "serve",
  });

  revalidatePath("/waiter");
  return { ok: true };
}
