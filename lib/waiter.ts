import { createClient } from "@/lib/supabase/server";
import type { WaiterItem, WaiterOrder } from "@/lib/waiterTypes";

/*
  Query layar waiter — server-only, dibaca dengan sesi staf sehingga RLS yang
  menjaga.

  "Aktif" = belum diantar. Pesanan yang sudah ditandai diantar keluar dari
  daftar supaya layar tidak menumpuk sepanjang shift; riwayatnya tetap ada di
  sales_records. Pesanan yang dibatalkan tetap ditampilkan sebentar (12 jam)
  agar waiter bisa menjelaskan ke tamu kalau ditanya.
*/
export async function getWaiterOrders(): Promise<WaiterOrder[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, table_number, customer_name, status, total,
       cancel_reason, created_at, served_at,
       order_items ( id, name, price, qty, note, status )`
    )
    .in("status", ["paid", "queued", "done", "cancelled"])
    .is("served_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal membaca pesanan: ${error.message}`);

  return (data ?? []).map((o) => ({
    ...o,
    items: ((o as unknown as { order_items: WaiterItem[] }).order_items ?? []).sort(
      (a, b) => a.name.localeCompare(b.name)
    ),
  })) as WaiterOrder[];
}
