"use client";

import { useEffect, useState } from "react";
import type { CategoryWithItems, MenuItem, Settings } from "@/lib/types";
import { rupiah } from "@/lib/types";
import type { Cart } from "@/lib/cart";
import { qtyByCategory } from "@/lib/cart";
import ItemPopover, { type PopoverTarget } from "./ItemPopover";

/*
  Dial berjenjang (PRD §4.1–4.2).

  Level 0: tengah = nomor meja,     cincin = kategori
  Level 1: tengah = kategori aktif, cincin = item kategori itu

  Yang membuat animasi "terbang ke tengah" bekerja: SEMUA lingkaran kategori
  tetap ter-mount di kedua level. Kategori aktif cuma berganti kelas jadi
  .is-center (yang men-set --radius: 0), kategori lain jadi .is-hidden.
  Elemennya sama, jadi transisi CSS pada transform/width yang menganimasikan.
  Kalau di-remount, animasinya hilang dan harus FLIP manual.
*/

export default function Dial({
  categories,
  settings,
  tableNumber,
  cart,
  onSetItem,
  onRemoveItem,
}: {
  categories: CategoryWithItems[];
  settings: Settings;
  tableNumber: string | null;
  cart: Cart;
  onSetItem: (id: string, qty: number, note: string) => void;
  onRemoveItem: (id: string) => void;
}) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverTarget | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Popover menangani Escape-nya sendiri; di sini hanya untuk level dial.
      if (e.key === "Escape" && !popover) setActiveCat(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popover]);

  const active = activeCat
    ? (categories.find((c) => c.id === activeCat) ?? null)
    : null;

  // Jumlah anak cincin di level aktif — dipakai CSS untuk menyebar posisi.
  const ringTotal = active ? Math.max(active.items.length, 1) : categories.length;
  const catBadges = qtyByCategory(cart, categories);

  function openItem(item: MenuItem, el: HTMLElement) {
    setPopover({ item, rect: el.getBoundingClientRect() });
  }

  return (
    <main className="stage">
      <div className="dial" style={{ ["--total" as string]: ringTotal }}>
        {/* ---- Lingkaran tengah level 0: nomor meja ---- */}
        <button
          type="button"
          className={`node is-table ${active ? "is-hidden" : "is-center"}`}
          style={{ ["--i" as string]: 0 }}
          aria-hidden={active ? true : undefined}
          tabIndex={active ? -1 : 0}
          onClick={() => setActiveCat(null)}
          aria-label={`${settings.table_number_label} ${tableNumber ?? "belum diisi"}`}
        >
          <span className="table-num">{tableNumber ?? "—"}</span>
          <span className="table-cap">{settings.table_number_label}</span>
        </button>

        {/* ---- Kategori: selalu ter-mount, hanya berganti kelas ---- */}
        {categories.map((cat, idx) => {
          const isCenter = cat.id === activeCat;
          const hidden = Boolean(active) && !isCenter;
          const badge = catBadges.get(cat.id);
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
          const qty = cart[item.id]?.qty ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              className="node"
              style={{ ["--i" as string]: idx + 1 }}
              aria-label={`${item.name}, ${rupiah(item.price)}${qty ? `, ${qty} di keranjang` : ""}`}
              onClick={(e) => openItem(item, e.currentTarget)}
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
            <>Ketuk menu untuk memilih. Ketuk lingkaran tengah untuk kembali.</>
          ) : (
            <>
              Kategori <strong>{active.name}</strong> belum ada menunya — bisa diisi
              dari dashboard superuser.
            </>
          )
        ) : (
          settings.hint_text
        )}
      </p>

      {popover && (
        <ItemPopover
          target={popover}
          currentQty={cart[popover.item.id]?.qty ?? 0}
          currentNote={cart[popover.item.id]?.note ?? ""}
          onClose={() => setPopover(null)}
          onSubmit={(qty, note) => {
            onSetItem(popover.item.id, qty, note);
            setPopover(null);
          }}
          onRemove={() => {
            onRemoveItem(popover.item.id);
            setPopover(null);
          }}
        />
      )}
    </main>
  );
}
