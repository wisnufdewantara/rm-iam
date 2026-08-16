"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MenuItem } from "@/lib/types";
import { rupiah } from "@/lib/types";
import type { CartLine } from "@/lib/cart";

/*
  Dialog detail item, menempel pada lingkaran yang diketuk (PRD §4.1).

  DI-PORTAL KE <body> — ini wajib, bukan gaya.
  `.stage` memakai `perspective: 1200px` untuk efek 3D dial. Properti
  perspective (juga transform & filter) MEMBUAT CONTAINING BLOCK BARU untuk
  turunan `position: fixed`. Kalau dialog dirender di dalam `.stage`, maka
  `inset: 0` pada backdrop mengacu ke kotak .stage — bukan viewport — dan
  koordinat dari getBoundingClientRect() (yang relatif viewport) meleset.
  Gejalanya: dialog mencong ke pinggir, backdrop hanya menutupi area dial,
  dan muncul scrollbar horizontal. Portal ke <body> menghapus seluruh kelas
  masalah ini.

  Foto menyatu dengan dialog: gambar (atau ikon besar kalau item belum punya
  foto) jadi kepala dialog yang menempel ke tepi, bukan ikon kecil di samping
  judul.
*/

export type PopoverTarget = { item: MenuItem; rect: DOMRect };

export default function ItemPopover({
  target,
  presets,
  existing,
  onClose,
  onAdd,
  onSetQty,
  onRemove,
}: {
  target: PopoverTarget;
  presets: string[];
  existing: CartLine[];
  onClose: () => void;
  onAdd: (qty: number, note: string) => void;
  onSetQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
}) {
  const { item, rect } = target;

  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Posisi dihitung SETELAH ukuran sebenarnya diketahui, sebelum paint.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const pad = 12;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const vw = document.documentElement.clientWidth; // tanpa lebar scrollbar
    const vh = window.innerHeight;

    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.min(Math.max(pad, left), Math.max(pad, vw - w - pad));

    // Default di bawah lingkaran; pindah ke atas kalau tidak cukup ruang;
    // kalau dua-duanya tidak muat (dialog tinggi di layar pendek), tempel atas.
    let top = rect.bottom + 10;
    if (top + h > vh - pad) {
      const above = rect.top - h - 10;
      top = above >= pad ? above : Math.max(pad, vh - h - pad);
    }
    setPos({ left, top });
  }, [rect, existing.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function togglePreset(p: string) {
    // Preset bersifat menumpuk: "Pedas" + "Tanpa bawang" itu wajar.
    const parts = note.split(",").map((s) => s.trim()).filter(Boolean);
    const at = parts.findIndex((s) => s.toLowerCase() === p.toLowerCase());
    if (at >= 0) parts.splice(at, 1);
    else parts.push(p);
    setNote(parts.join(", "));
  }

  const activePresets = new Set(
    note.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );

  const dialog = (
    <>
      <div className="pop-backdrop" onClick={onClose} />
      <div
        ref={boxRef}
        className="pop"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        style={
          pos
            ? { left: pos.left, top: pos.top }
            : // Sebelum posisi terhitung, sembunyikan supaya tidak terlihat
              // melompat dari pojok kiri atas.
              { left: 0, top: 0, visibility: "hidden" }
        }
      >
        {/* Kepala dialog: foto menyatu dengan kotaknya, menempel ke tepi */}
        <div className="pop-media">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.name} />
          ) : (
            <span className="material-symbols-outlined">
              {item.icon_name ?? "restaurant"}
            </span>
          )}
          <button className="pop-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="pop-body">
          <div className="pop-head">
            {/* Nama UTUH di sini — lingkaran hanya menampilkan versi pendeknya */}
            <h3>{item.name}</h3>
            <p className="pop-price">{rupiah(item.price)}</p>
          </div>

          {item.description && <p className="pop-desc">{item.description}</p>}

          {existing.length > 0 && (
            <div className="variants">
              <p className="variants-cap">Sudah di keranjang</p>
              {existing.map((line) => (
                <div className="variant" key={line.lineId}>
                  <span className="variant-note">
                    {line.note || <em>tanpa catatan</em>}
                  </span>
                  <div
                    className="cart-qty"
                    role="group"
                    aria-label={`Jumlah ${line.note || "tanpa catatan"}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSetQty(line.lineId, line.qty - 1)}
                      aria-label="Kurangi"
                    >
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => onSetQty(line.lineId, line.qty + 1)}
                      aria-label="Tambah"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cart-del"
                    onClick={() => onRemove(line.lineId)}
                    aria-label="Hapus varian"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="variants-cap">
            {existing.length > 0 ? "Tambah varian lain" : "Tambah ke keranjang"}
          </p>

          <div className="stepper" role="group" aria-label="Jumlah">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Kurangi"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
            <span className="stepper-val" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              disabled={qty >= 99}
              aria-label="Tambah"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>

          {/* Catatan cepat: mengetik di HP lambat, di kiosk lebih lambat lagi.
              Isinya dari DB (kategori → settings), bukan hardcoded. */}
          {presets.length > 0 && (
            <div className="chips">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip ${activePresets.has(p.toLowerCase()) ? "is-on" : ""}`}
                  onClick={() => togglePreset(p)}
                  aria-pressed={activePresets.has(p.toLowerCase())}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <label className="field field-compact">
            <span>Catatan</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. tidak pakai sambal"
              maxLength={80}
            />
          </label>

          <div className="pop-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onAdd(qty, note.trim());
                // Reset supaya varian berikutnya bisa langsung ditambah tanpa
                // menutup dialog — alur yang persis dibutuhkan untuk
                // "1 pedas, 1 tidak pedas".
                setQty(1);
                setNote("");
              }}
            >
              Tambah · {rupiah(item.price * qty)}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Dialog hanya muncul setelah interaksi pengguna, jadi document selalu ada
  // di titik ini. Penjagaannya tetap ditulis supaya aman kalau kelak dirender
  // dari jalur lain.
  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
