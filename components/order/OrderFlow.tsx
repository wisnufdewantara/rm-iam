"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Dial from "@/components/dial/Dial";
import CheckoutSection from "./CheckoutSection";
import EntryScreen from "./EntryScreen";
import { STORAGE, useHydrated, usePersisted } from "@/lib/storage";
import { useKioskIdle } from "@/lib/kiosk";
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
  disusun.

  Mode kiosk lewat `?mode=kiosk` (PRD §4.5): target sentuh lebih besar, papan
  angka di layar, dan reset otomatis saat ditinggalkan.
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
  const params = useSearchParams();
  const kiosk = params.get("mode") === "kiosk";

  const session = usePersisted<Session | null>(STORAGE.session, null);
  const cart = usePersisted<Cart>(STORAGE.cart, EMPTY_CART);
  // Tema disimpan per perangkat; nilai awalnya dari settings, tapi pengunjung
  // (atau petugas kiosk) boleh menggantinya sendiri.
  const theme = usePersisted<"light" | "dark" | null>(STORAGE.theme, null);
  const activeTheme = theme.value ?? settings.theme;

  // Tema dipasang di <html>, bukan di .app: latar body dan footer kredit ada di
  // LUAR .app, jadi kalau dipasang di .app separuh halaman tetap terang.
  // Ini menulis ke DOM, bukan setState — jadi tidak melanggar
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
  }, [activeTheme]);

  const index = useMemo(() => indexItems(categories), [categories]);
  const lines = useMemo(() => cartLines(cart.value, index), [cart.value, index]);
  const totals = useMemo(() => cartTotals(lines), [lines]);

  function resetAll() {
    cart.clear();
    session.clear();
  }

  const { warnRemaining, keepAlive } = useKioskIdle({
    enabled: kiosk && hydrated,
    idleSecs: settings.kiosk_idle_secs,
    onReset: resetAll,
  });

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

  const themeToggle = (
    <button
      type="button"
      className="theme-btn"
      onClick={() => theme.setValue(activeTheme === "dark" ? "light" : "dark")}
      aria-label={activeTheme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      title="Ganti tema"
    >
      <span className="material-symbols-outlined">
        {activeTheme === "dark" ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );

  if (!session.value) {
    return (
      <div className="app" data-theme={activeTheme} data-mode={kiosk ? "kiosk" : undefined}>
        <div className="entry-top">{themeToggle}</div>
        <EntryScreen
          settings={settings}
          markers={markers}
          kiosk={kiosk}
          onDone={(s) => session.setValue(s)}
        />
      </div>
    );
  }

  return (
    <div className="app" data-theme={activeTheme} data-mode={kiosk ? "kiosk" : undefined}>
      <header className="topbar">
        <span className="brand">{settings.brand_name}</span>
        <span className="topbar-right">
          {themeToggle}
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
              resetAll();
            }}
            title="Ganti meja / nama"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
              table_restaurant
            </span>
            {settings.table_number_label} {session.value.tableNumber}
            {session.value.customerName ? ` · ${session.value.customerName}` : ""}
          </button>
        </span>
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
        session={session.value}
        kiosk={kiosk}
        onOrdered={() => cart.clear()}
      />

      {/* Peringatan sebelum kiosk mereset sendiri. Membuang keranjang tanpa
          aba-aba menjengkelkan kalau orangnya masih ada, cuma sedang membaca. */}
      {warnRemaining !== null && (
        <div className="idle-warn" role="alertdialog">
          <p>Masih di sana?</p>
          <p className="idle-sub">
            Pesanan akan dikosongkan dalam {warnRemaining} detik.
          </p>
          <button type="button" className="btn-primary" onClick={keepAlive}>
            Ya, lanjutkan
          </button>
        </div>
      )}
    </div>
  );
}
