// Tipe & helper MURNI untuk layar dapur.
//
// Dipisah dari lib/kitchen.ts dengan sengaja: file itu mengimpor klien Supabase
// server yang memakai `next/headers`, dan komponen klien yang ikut mengimpornya
// akan menarik kode server-only ke bundle browser — build langsung gagal.
// Semua yang dibutuhkan dua sisi tinggal di sini.

export type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  status: "active" | "cancelled";
};

export type KitchenOrder = {
  id: string;
  order_number: string;
  table_number: string;
  customer_name: string;
  status: "paid" | "queued" | "done";
  created_at: string;
  queued_at: string | null;
  completed_at: string | null;
  items: KitchenItem[];
};

/** Berapa pesanan aktif lain di meja yang sama — supaya dapur bisa
 *  menyiapkan satu meja bersamaan (PRD §3.1.1). */
export function siblingCount(orders: KitchenOrder[], o: KitchenOrder): number {
  return orders.filter(
    (x) =>
      x.table_number === o.table_number &&
      x.id !== o.id &&
      (x.status === "paid" || x.status === "queued")
  ).length;
}
