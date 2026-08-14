"use client";

import { useMemo } from "react";
import Dial from "@/components/dial/Dial";
import CheckoutSection from "./CheckoutSection";
import EntryScreen from "./EntryScreen";
import { STORAGE, useHydrated, usePersisted } from "@/lib/storage";
import {
  addToCart,
  cartLines,
  cartTotals,
  indexItems,
  removeLine,
  setLineNote,
  setLineQty,
  type Cart,
  type Session,
} from "@/lib/cart";
import type { CategoryWithItems, Settings } from "@/lib/types";

/*
  Pemegang state alur pemesanan pengunjung.

  Sesi (nomor meja + nama) dan keranjang keduanya bertahan di localStorage,
  jadi refresh atau layar HP yang mati tidak menghapus pesanan yang sedang
  disusun. Belum ada tulis ke DB sampai Fase 2.
*/

// Referensi konstan: nilai awal store harus stabil antar render supaya
// getServerSnapshot tidak dianggap berubah terus oleh React.
const EMPTY_CART: Cart = {};

export default function OrderFlow({
  categories,
  settings,
  markers,
}: {
  categories: CategoryWithItems[];
  settings: Settings;
  markers: string[];
}) {
  const hydrated = useHydrated();
  const session = usePersisted<Session | null>(STORAGE.session, null);
  const cart = usePersisted<Cart>(STORAGE.cart, EMPTY_CART);

  const index = useMemo(() => indexItems(categories), [categories]);
  const lines = useMemo(() => cartLines(cart.value, index), [cart.value, index]);
  const totals = useMemo(() => cartTotals(lines), [lines]);

  // Semua operasi keranjang murni, ada di lib/cart.ts, dan dikunci per VARIAN
  // (item + catatan) — bukan per item menu. Lihat komentar di lib/cart.ts.
  const add = (itemId: string, qty: number, note: string) =>
    cart.setValue((c) => addToCart(c, itemId, qty, note));
  const setQty = (lineId: string, qty: number) =>
    cart.setValue((c) => setLineQty(c, lineId, qty));
  const remove = (lineId: string) => cart.setValue((c) => removeLine(c, lineId));
  const setNote = (lineId: string, note: string) =>
    cart.setValue((c) => setLineNote(c, lineId, note));

  // Tunggu localStorage terbaca sebelum memutuskan layar mana yang tampil.
  // Tanpa ini, pengunjung yang sudah punya sesi akan melihat layar masuk
  // berkelip sesaat setiap kali refresh.
  if (!hydrated) return <div className="boot" aria-hidden="true" />;

  if (!session.value) {
    return (
      <EntryScreen
        settings={settings}
        markers={markers}
        onDone={(s) => session.setValue(s)}
      />
    );
  }

  return (
    <div className="app" data-theme={settings.theme}>
      <header className="topbar">
        <span className="brand">{settings.brand_name}</span>
        <button
          type="button"
          className="table-chip"
          onClick={() => {
            // Ganti meja = mulai sesi baru. Keranjang ikut dibuang supaya
            // pesanan tidak nyasar ke meja yang salah.
            if (
              lines.length > 0 &&
              !window.confirm("Ganti meja akan mengosongkan pesanan Anda. Lanjut?")
            ) {
              return;
            }
            cart.clear();
            session.clear();
          }}
          title="Ganti meja / nama"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
            table_restaurant
          </span>
          {settings.table_number_label} {session.value.tableNumber}
          {session.value.customerName ? ` · ${session.value.customerName}` : ""}
        </button>
      </header>

      <Dial
        categories={categories}
        settings={settings}
        tableNumber={session.value.tableNumber}
        cart={cart.value}
        onAdd={add}
        onSetQty={setQty}
        onRemoveLine={remove}
      />

      <CheckoutSection
        lines={lines}
        totalQty={totals.qty}
        totalRp={totals.rupiah}
        settings={settings}
        onChangeQty={setQty}
        onRemove={remove}
        onChangeNote={setNote}
      />
    </div>
  );
}
