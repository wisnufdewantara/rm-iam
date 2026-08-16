"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ensureGuestToken, readGuestToken } from "@/lib/guest";

/*
  Server Action untuk pesanan.

  Semuanya lewat fungsi Postgres `security definer` (migrasi 0003), bukan
  secret key — lihat PRD §7.1. Kalau env var bocor, yang bocor bukan seluruh
  database, dan RLS yang sudah ditulis benar-benar berlaku.

  Zod dipakai di batas ini karena input pengunjung tidak dipercaya. Validasi
  yang SAMA juga ada di dalam RPC — itu bukan duplikasi sia-sia: yang di sini
  memberi pesan enak dibaca, yang di DB yang benar-benar menjaga (dan tetap
  jalan walau ada jalur kode lain yang lupa memvalidasi).
*/

const OrderInput = z.object({
  tableNumber: z.string().trim().min(1, "Nomor meja belum diisi").max(16),
  customerName: z.string().trim().max(40),
  items: z
    .array(
      z.object({
        menu_item_id: z.uuid(),
        qty: z.number().int().min(1).max(99),
        note: z.string().trim().max(80).default(""),
      })
    )
    .min(1, "Keranjang kosong")
    .max(50, "Terlalu banyak baris pesanan"),
  confirm: z.boolean().default(false),
});

export type CreateOrderResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; needsConfirm: true; reason: "duplicate" | "busy_table"; detail: string }
  | { ok: false; needsConfirm?: false; error: string };

export async function createOrderAction(
  raw: unknown
): Promise<CreateOrderResult> {
  const parsed = OrderInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const input = parsed.data;

  const token = await ensureGuestToken();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_order", {
    p_table_number: input.tableNumber,
    p_customer_name: input.customerName,
    p_guest_token: token,
    p_items: input.items,
    p_confirm: input.confirm,
  });

  if (error) return { ok: false, error: cleanPgError(error.message) };

  const res = data as {
    needs_confirm: boolean;
    reason?: string;
    order_number?: string;
    total?: number;
    active_count?: number;
  };

  if (res.needs_confirm) {
    return {
      ok: false,
      needsConfirm: true,
      reason: res.reason === "duplicate" ? "duplicate" : "busy_table",
      detail:
        res.reason === "duplicate"
          ? `Pesanan dengan isi yang sama baru saja dibuat (${res.order_number}).`
          : `Meja ini sudah punya ${res.active_count} pesanan yang sedang berjalan.`,
    };
  }

  return { ok: true, orderNumber: res.order_number!, total: res.total ?? 0 };
}

export async function payOrderAction(
  orderNumber: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const token = await readGuestToken();
  if (!token) return { ok: false, error: "Sesi tidak ditemukan. Buka ulang dari halaman pesanan." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_order_paid", {
    p_order_number: orderNumber,
    p_guest_token: token,
  });

  if (error) return { ok: false, error: cleanPgError(error.message) };
  return { ok: true, status: (data as { status: string }).status };
}

/** Pesan Postgres bisa memuat konteks teknis; ambil kalimatnya saja. */
function cleanPgError(msg: string): string {
  return msg.replace(/^.*?:\s*/, "").split("\n")[0] || msg;
}
