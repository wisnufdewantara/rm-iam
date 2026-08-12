"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryWithItems, Settings } from "@/lib/types";
import { rupiah } from "@/lib/types";

/*
  Dial berjenjang (PRD §4.1–4.2).

  Level 0: tengah = nomor meja,     cincin = kategori
  Level 1: tengah = kategori aktif, cincin = item kategori itu

  Yang membuat animasi "terbang ke tengah" bekerja: SEMUA lingkaran kategori
  tetap ter-mount di kedua level. Kategori aktif cuma berganti kelas jadi
  .is-center (yang men-set --radius: 0), kategori lain jadi .is-hidden.
  Elemennya sama, jadi transisi CSS pada transform/width yang menganimasikan.
  Kalau di-remount, animasinya hilang.

  Item menu memang baru mount saat kategorinya dibuka — itu wajar dan tampak
  seperti cincin yang mekar.
*/

type Cart = Record<string, number>; // menu_item_id -> qty

export default function Dial({
  categories,
  settings,
  tableNumber,
}: {
  categories: CategoryWithItems[];
  settings: Settings;
  tableNumber: string | null;
}) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart>({});

  // Tutup level dengan Escape — dial ini dipakai juga dengan keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveCat(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const active = activeCat
    ? (categories.find((c) => c.id === activeCat) ?? null)
    : null;

  // Jumlah anak cincin di level aktif — dipakai CSS untuk menyebar posisi.
  const ringTotal = active ? Math.max(active.items.length, 1) : categories.length;

  const itemsById = useMemo(() => {
    const m = new Map<string, { name: string; price: number }>();
    for (const c of categories) {
      for (const i of c.items) m.set(i.id, { name: i.name, price: i.price });
    }
    return m;
  }, [categories]);

  const qtyByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of categories) {
      let n = 0;
      for (const i of c.items) n += cart[i.id] ?? 0;
      if (n > 0) m.set(c.id, n);
    }
    return m;
  }, [categories, cart]);

  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const meta = itemsById.get(id);
      return { id, qty, name: meta?.name ?? "—", price: meta?.price ?? 0 };
    });

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalRp = lines.reduce((s, l) => s + l.qty * l.price, 0);

  function addItem(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function removeItem(id: string) {
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  }

  return (
    <>
      <main className="stage">
        <div
          className="dial"
          style={{ ["--total" as string]: ringTotal }}
        >
          {/* ---- Lingkaran tengah level 0: nomor meja ---- */}
          <button
            type="button"
            className={`node is-table ${active ? "is-hidden" : "is-center"}`}
            style={{ ["--i" as string]: 0 }}
            aria-hidden={active ? true : undefined}
            tabIndex={active ? -1 : 0}
            onClick={() => setActiveCat(null)}
          >
            <span className="table-num">{tableNumber ?? "—"}</span>
            <span className="table-cap">{settings.table_number_label}</span>
          </button>

          {/* ---- Kategori: selalu ter-mount, cuma berganti kelas ---- */}
          {categories.map((cat, idx) => {
            const isCenter = cat.id === activeCat;
            const hidden = Boolean(active) && !isCenter;
            const badge = qtyByCategory.get(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                className={`node ${isCenter ? "is-center" : ""} ${hidden ? "is-hidden" : ""}`}
                style={{ ["--i" as string]: idx + 1 }}
                aria-hidden={hidden ? true : undefined}
                tabIndex={hidden ? -1 : 0}
                aria-label={
                  isCenter ? `Tutup kategori ${cat.name}` : `Buka kategori ${cat.name}`
                }
                onClick={() => setActiveCat(isCenter ? null : cat.id)}
              >
                <span className="material-symbols-outlined icon">{cat.icon_name}</span>
                <span className="node-label">{cat.name}</span>
                {badge ? <span className="badge">{badge}</span> : null}
                <span className="tip">{cat.name}</span>
              </button>
            );
          })}

          {/* ---- Item menu kategori aktif ---- */}
          {active?.items.map((item, idx) => {
            const qty = cart[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                className="node"
                style={{ ["--i" as string]: idx + 1 }}
                aria-label={`Tambah ${item.name}, ${rupiah(item.price)}`}
                onClick={() => addItem(item.id)}
              >
                <span className="material-symbols-outlined icon">
                  {item.icon_name ?? "restaurant"}
                </span>
                <span className="node-label">{item.name}</span>
                {qty > 0 ? <span className="badge">{qty}</span> : null}
                <span className="tip">
                  {item.name} · {rupiah(item.price)}
                </span>
              </button>
            );
          })}
        </div>

        <p className="hint">
          {active ? (
            active.items.length ? (
              <>
                Ketuk menu untuk menambah. Ketuk lingkaran tengah untuk kembali.
              </>
            ) : (
              <>
                Kategori <strong>{active.name}</strong> belum ada menunya — bisa
                diisi dari dashboard superuser.
              </>
            )
          ) : (
            settings.hint_text
          )}
        </p>
      </main>

      {/* Separator memisahkan dial dari section checkout (PRD §4.3) */}
      <hr className="separator" />

      <section className="checkout">
        <h2>
          Pesanan Anda
          <span className="count">
            {totalQty > 0 ? `${totalQty} item` : "belum ada"}
          </span>
        </h2>

        {lines.length === 0 ? (
          <p className="cart-empty">
            Belum ada pesanan. Pilih kategori di atas untuk mulai memesan.
          </p>
        ) : (
          <>
            {lines.map((l) => (
              <div className="cart-line" key={l.id}>
                <span className="qty">{l.qty}×</span>
                <span className="nm">{l.name}</span>
                <span className="pr">{rupiah(l.qty * l.price)}</span>
                <button
                  type="button"
                  className="node-remove"
                  aria-label={`Hapus ${l.name}`}
                  onClick={() => removeItem(l.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text-soft)",
                    display: "grid",
                    placeContent: "center",
                  }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}

            <div className="cart-total">
              <span>Total</span>
              <span>{rupiah(totalRp)}</span>
            </div>

            {/* Pengingat wajib — diminta eksplisit di PRD §2 */}
            <p className="notice">
              <span className="material-symbols-outlined">info</span>
              <span>{settings.cancel_notice}</span>
            </p>
          </>
        )}

        <button type="button" className="btn-primary" disabled title="Fase 2">
          Lanjut Pembayaran
        </button>
      </section>
    </>
  );
}
