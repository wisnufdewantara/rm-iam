import { createClient } from "@/lib/supabase/server";
import type { KitchenItem, KitchenOrder } from "@/lib/kitchenTypes";

/*
  Query layar dapur — server-only.

  Dibaca dengan sesi staf (publishable key + JWT), jadi RLS yang menjaga —
  bukan secret key. Kalau policy-nya salah, halamannya kosong; itu memang
  yang diinginkan.

  Tipe & helper murni ada di lib/kitchenTypes.ts supaya komponen klien bisa
  memakainya tanpa ikut menarik `next/headers` ke bundle browser.

  'done' dibatasi 12 jam terakhir: kolom "Selesai" gunanya memastikan pesanan
  sudah keluar, bukan jadi arsip. Riwayat permanen ada di sales_records (0004).
*/
export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  const supabase = await createClient();

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, table_number, customer_name, status, created_at,
       queued_at, completed_at,
       order_items ( id, name, qty, note, status )`
    )
    .in("status", ["paid", "queued", "done"])
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Gagal membaca pesanan: ${error.message}`);

  return (data ?? []).map((o) => ({
    ...o,
    items: ((o as unknown as { order_items: KitchenItem[] }).order_items ?? []).sort(
      (a, b) => a.name.localeCompare(b.name)
    ),
  })) as KitchenOrder[];
}
