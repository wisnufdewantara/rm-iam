import type { CategoryWithItems } from "@/lib/types";

// Keranjang hidup di sisi klien sampai checkout (PRD §5): tidak ada tulis ke DB
// sebelum pengunjung menekan "Lanjut Pembayaran". Jadi tidak ada baris pesanan
// terbengkalai untuk setiap orang yang cuma melihat-lihat menu.

export type CartEntry = { qty: number; note?: string };
export type Cart = Record<string, CartEntry>; // menu_item_id -> entry

export type Session = {
  tableNumber: string;
  customerName: string;
};

export type CartLine = {
  id: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
  lineTotal: number;
};

/** Peta id item -> {name, price} dari seluruh kategori. */
export function indexItems(categories: CategoryWithItems[]) {
  const map = new Map<string, { name: string; price: number }>();
  for (const c of categories) {
    for (const i of c.items) map.set(i.id, { name: i.name, price: i.price });
  }
  return map;
}

/**
 * Baris keranjang yang siap ditampilkan.
 *
 * Item yang sudah tidak ada di menu (dihapus superuser saat keranjang masih
 * terbuka) DIBUANG, bukan ditampilkan dengan harga 0 — kalau tidak, totalnya
 * akan menyesatkan.
 */
export function cartLines(
  cart: Cart,
  index: Map<string, { name: string; price: number }>
): CartLine[] {
  const lines: CartLine[] = [];
  for (const [id, entry] of Object.entries(cart)) {
    if (entry.qty <= 0) continue;
    const meta = index.get(id);
    if (!meta) continue;
    lines.push({
      id,
      name: meta.name,
      price: meta.price,
      qty: entry.qty,
      note: entry.note,
      lineTotal: meta.price * entry.qty,
    });
  }
  return lines;
}

export function cartTotals(lines: CartLine[]) {
  return {
    qty: lines.reduce((s, l) => s + l.qty, 0),
    rupiah: lines.reduce((s, l) => s + l.lineTotal, 0),
  };
}

/** Jumlah qty per kategori — untuk badge di lingkaran kategori. */
export function qtyByCategory(
  cart: Cart,
  categories: CategoryWithItems[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of categories) {
    let n = 0;
    for (const i of c.items) n += cart[i.id]?.qty ?? 0;
    if (n > 0) out.set(c.id, n);
  }
  return out;
}
