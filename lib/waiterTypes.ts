// Tipe & helper MURNI untuk layar waiter (dipakai server dan klien).
// Dipisah dari query-nya supaya komponen klien tidak ikut menarik
// `next/headers` ke bundle browser.

export type WaiterItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  note: string | null;
  status: "active" | "cancelled";
};

export type WaiterOrder = {
  id: string;
  order_number: string;
  table_number: string;
  customer_name: string;
  status: "paid" | "queued" | "done" | "cancelled";
  total: number;
  cancel_reason: string | null;
  created_at: string;
  served_at: string | null;
  items: WaiterItem[];
};

export type TableGroup = {
  table: string;
  orders: WaiterOrder[];
  total: number;
};

export const STATUS_TEXT: Record<WaiterOrder["status"], string> = {
  paid: "Dibayar",
  queued: "Diantre",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

/** Kelompokkan per meja — tampilan bawaan waiter (PRD §3.3).
 *  Penanda meja dipakai ulang, jadi satu nomor bisa memuat pesanan milik
 *  orang berbeda; nama pemesan yang membedakan. */
export function groupByTable(orders: WaiterOrder[]): TableGroup[] {
  const map = new Map<string, WaiterOrder[]>();
  for (const o of orders) {
    const arr = map.get(o.table_number);
    if (arr) arr.push(o);
    else map.set(o.table_number, [o]);
  }
  return [...map.entries()]
    .map(([table, list]) => ({
      table,
      orders: list,
      total: list
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.total, 0),
    }))
    .sort((a, b) => a.table.localeCompare(b.table, "id", { numeric: true }));
}

export function activeItemCount(o: WaiterOrder): number {
  return o.items.filter((i) => i.status === "active").reduce((s, i) => s + i.qty, 0);
}
