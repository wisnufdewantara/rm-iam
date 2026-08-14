"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryWithItems, MenuItem, Settings } from "@/lib/types";
import { rupiah, shortItemLabel } from "@/lib/types";
import type { Cart } from "@/lib/cart";
import { linesForItem, qtyByCategory, qtyByItem } from "@/lib/cart";
import ItemPopover, { type PopoverTarget } from "./ItemPopover";

/*
  Dial berjenjang (PRD §4.1–4.2).

  Level 0: tengah = nomor meja,     cincin = kategori
  Level 1: tengah = kategori aktif, cincin = item kategori itu

  Yang membuat animasi "terbang ke tengah" bekerja: SEMUA lingkaran kategori
  tetap ter-mount di kedua level. Kategori aktif cuma berganti kelas jadi
  .is-center (yang men-set --radius: 0), kategori lain jadi .is-hidden.
  Elemennya sama, jadi transisi CSS pada transform/width yang menganimasikan.

  PAGINASI CINCIN
  Cincin punya 12 slot, mengikuti angka pada jam. Menu nyata bisa punya 18 item
  dalam satu kategori, dan 18 lingkaran di satu cincin pasti tumpang-tindih:
  keliling cincin (2πr) lebih kecil dari total diameter lingkarannya.

  Kalau item melebihi 12, slot terakhir dipakai lingkaran NAVIGASI berwarna
  beda yang memindahkan ke halaman berikutnya (dan berputar kembali ke halaman
  1 di ujung). Saat memaginasi, --total dipaku ke 12 supaya posisi slot tidak
  bergeser antar halaman — jam-nya tetap jam.
*/

export default function Dial({
  categories,
  settings,
  tableNumber,
  cart,
  onAdd,
  onSetQty,
  onRemoveLine,
}: {
  categories: CategoryWithItems[];
  settings: Settings;
  tableNumber: string | null;
  cart: Cart;
  onAdd: (itemId: string, qty: number, note: string) => void;
  onSetQty: (lineId: string, qty: number) => void;
  onRemoveLine: (lineId: string) => void;
}) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [page, setPage] = useState(0);
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

  const slots = Math.min(Math.max(settings.dial_max_ring, 6), 12);

  // Pembagian halaman cincin. Kalau perlu navigasi, satu slot dipakai tombolnya.
  const paging = useMemo(() => {
    const items = active?.items ?? [];
    if (items.length <= slots) {
      return { items, needsNav: false, pageCount: 1, total: items.length };
    }
    const perPage = slots - 1; // sisakan satu slot untuk lingkaran navigasi
    const pageCount = Math.ceil(items.length / perPage);
    const safePage = page % pageCount;
    return {
      items: items.slice(safePage * perPage, safePage * perPage + perPage),
      needsNav: true,
      pageCount,
      // Dipaku ke jumlah slot supaya posisi tidak bergeser antar halaman.
      total: slots,
    };
  }, [active, page, slots]);

  const ringTotal = active
    ? Math.max(paging.total, 1)
    : Math.max(categories.length, 1);

  const catBadges = qtyByCategory(cart, categories);
  const itemBadges = qtyByItem(cart);

  function openCategory(id: string | null) {
    setActiveCat(id);
    setPage(0); // halaman selalu mulai dari awal saat kategori berganti
  }

  function openItem(item: MenuItem, el: HTMLElement) {
    setPopover({ item, rect: el.getBoundingClientRect() });
  }

  const presets = active?.note_presets ?? settings.note_presets;
  const currentPage = paging.pageCount > 1 ? page % paging.pageCount : 0;

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
          onClick={() => openCategory(null)}
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
              onClick={() => openCategory(isCenter ? null : cat.id)}
            >
              <span className="material-symbols-outlined icon">{cat.icon_name}</span>
              <span className="node-label">{cat.name}</span>
              {badge ? <span className="badge">{badge}</span> : null}
              <span className="tip">{cat.name}</span>
            </button>
          );
        })}

        {/* ---- Item menu halaman aktif ---- */}
        {active &&
          paging.items.map((item, idx) => {
            const qty = itemBadges.get(item.id) ?? 0;
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
                {/* Label dipendekkan: kategorinya sudah tertulis di tengah.
                    Nama utuh tetap ada di tooltip & popover. */}
                <span className="node-label">
                  {shortItemLabel(item.name, active.name)}
                </span>
                {qty > 0 ? <span className="badge">{qty}</span> : null}
                <span className="tip">
                  {item.name} · {rupiah(item.price)}
                </span>
              </button>
            );
          })}

        {/* ---- Lingkaran navigasi: hanya kalau item > jumlah slot ---- */}
        {active && paging.needsNav && (
          <button
            type="button"
            className="node is-nav"
            style={{ ["--i" as string]: slots }}
            onClick={() => setPage((p) => (p + 1) % paging.pageCount)}
            aria-label={`Halaman menu berikutnya, sekarang halaman ${currentPage + 1} dari ${paging.pageCount}`}
          >
            <span className="material-symbols-outlined icon">chevron_right</span>
            <span className="node-label">
              {currentPage + 1}/{paging.pageCount}
            </span>
            <span className="tip">Menu berikutnya</span>
          </button>
        )}
      </div>

      <p className="hint">
        {active ? (
          active.items.length ? (
            <>
              Ketuk menu untuk memilih. Ketuk lingkaran tengah untuk kembali.
              {paging.needsNav && (
                <>
                  {" "}
                  Lingkaran <strong>{currentPage + 1}/{paging.pageCount}</strong> untuk
                  menu berikutnya.
                </>
              )}
            </>
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
          presets={presets}
          existing={linesForItem(cart, popover.item.id)}
          onClose={() => setPopover(null)}
          onAdd={(qty, note) => onAdd(popover.item.id, qty, note)}
          onSetQty={onSetQty}
          onRemove={onRemoveLine}
        />
      )}
    </main>
  );
}
