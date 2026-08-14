import type { CategoryWithItems } from "@/lib/types";

/*
  Keranjang hidup di sisi klien sampai checkout (PRD §5): tidak ada tulis ke DB
  sebelum pengunjung menekan "Lanjut Pembayaran".

  PENTING — keranjang dikunci per VARIAN, bukan per item menu.

  Versi pertama memakai menu_item_id sebagai kunci, dan itu salah: pengunjung
  jadi tidak bisa memesan 1 Nasi Goreng pedas DAN 1 Nasi Goreng tidak pedas.
  Satu-satunya jalan keluar adalah menulis "3 nasi goreng, yang 1 pedas" di satu
  kolom catatan — yang berarti dapur harus menafsirkan teks bebas, dan itu
  sumber kesalahan pesanan di dunia nyata.

  Kunci sekarang = `${menu_item_id}|${catatan}`. Konsekuensinya persis seperti
  yang diinginkan:
    - item sama + catatan sama  → qty digabung (tambah 2× "pedas" = qty 2)
    - item sama + catatan beda  → dua baris terpisah

  Tabel `order_items` di database SUDAH benar sejak awal: satu baris per varian
  dengan kolom `note` sendiri. Jadi perbaikannya hanya di bentuk keranjang
  klien, bukan skema.
*/

export type CartEntry = {
  itemId: string;
  qty: number;
  note: string; // "" = tanpa catatan
};

/** lineKey -> entry */
export type Cart = Record<string, CartEntry>;

export type Session = {
  tableNumber: string;
  customerName: string;
};

export type CartLine = {
  lineId: string;
  itemId: string;
  name: string;
  price: number;
  qty: number;
  note: string;
  lineTotal: number;
};

/** Kunci baris keranjang. Catatan di-normalisasi supaya "Pedas " dan "Pedas"
 *  tidak jadi dua baris berbeda. */
export function lineKey(itemId: string, note: string): string {
  return `${itemId}|${note.trim()}`;
}

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
  for (const [lineId, entry] of Object.entries(cart)) {
    if (entry.qty <= 0) continue;
    const meta = index.get(entry.itemId);
    if (!meta) continue;
    lines.push({
      lineId,
      itemId: entry.itemId,
      name: meta.name,
      price: meta.price,
      qty: entry.qty,
      note: entry.note,
      lineTotal: meta.price * entry.qty,
    });
  }
  // Urut stabil: item yang sama berdekatan, varian tanpa catatan lebih dulu.
  lines.sort(
    (a, b) => a.name.localeCompare(b.name) || a.note.localeCompare(b.note)
  );
  return lines;
}

export function cartTotals(lines: CartLine[]) {
  return {
    qty: lines.reduce((s, l) => s + l.qty, 0),
    rupiah: lines.reduce((s, l) => s + l.lineTotal, 0),
  };
}

/** Total qty per menu_item_id — untuk badge di lingkaran item.
 *  Menjumlahkan SEMUA varian item itu. */
export function qtyByItem(cart: Cart): Map<string, number> {
  const out = new Map<string, number>();
  for (const entry of Object.values(cart)) {
    if (entry.qty <= 0) continue;
    out.set(entry.itemId, (out.get(entry.itemId) ?? 0) + entry.qty);
  }
  return out;
}

/** Total qty per kategori — untuk badge di lingkaran kategori. */
export function qtyByCategory(
  cart: Cart,
  categories: CategoryWithItems[]
): Map<string, number> {
  const perItem = qtyByItem(cart);
  const out = new Map<string, number>();
  for (const c of categories) {
    let n = 0;
    for (const i of c.items) n += perItem.get(i.id) ?? 0;
    if (n > 0) out.set(c.id, n);
  }
  return out;
}

/** Varian yang sudah ada di keranjang untuk satu item menu. */
export function linesForItem(cart: Cart, itemId: string): CartLine[] {
  return Object.entries(cart)
    .filter(([, e]) => e.itemId === itemId && e.qty > 0)
    .map(([lineId, e]) => ({
      lineId,
      itemId: e.itemId,
      name: "",
      price: 0,
      qty: e.qty,
      note: e.note,
      lineTotal: 0,
    }))
    .sort((a, b) => a.note.localeCompare(b.note));
}

// ---------------- operasi keranjang (pure) ----------------

/** Tambah varian. Kalau item+catatan sama sudah ada, qty-nya digabung. */
export function addToCart(
  cart: Cart,
  itemId: string,
  qty: number,
  note: string
): Cart {
  const key = lineKey(itemId, note);
  const prev = cart[key]?.qty ?? 0;
  return {
    ...cart,
    [key]: { itemId, note: note.trim(), qty: Math.min(99, prev + qty) },
  };
}

export function setLineQty(cart: Cart, lineId: string, qty: number): Cart {
  const entry = cart[lineId];
  if (!entry) return cart;
  if (qty <= 0) return removeLine(cart, lineId);
  return { ...cart, [lineId]: { ...entry, qty: Math.min(99, qty) } };
}

export function removeLine(cart: Cart, lineId: string): Cart {
  const next = { ...cart };
  delete next[lineId];
  return next;
}

/** Ubah catatan sebuah baris. Kuncinya ikut berubah; kalau bentrok dengan
 *  varian yang sudah ada, qty-nya digabung. */
export function setLineNote(cart: Cart, lineId: string, note: string): Cart {
  const entry = cart[lineId];
  if (!entry) return cart;
  const nextKey = lineKey(entry.itemId, note);
  if (nextKey === lineId) return cart;

  const without = removeLine(cart, lineId);
  const existing = without[nextKey]?.qty ?? 0;
  return {
    ...without,
    [nextKey]: {
      itemId: entry.itemId,
      note: note.trim(),
      qty: Math.min(99, existing + entry.qty),
    },
  };
}
