"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/types";
import { rupiah } from "@/lib/types";

/*
  Popover detail item, menempel pada lingkaran yang diketuk (PRD §4.1).

  Lingkaran ada di dalam cincin ber-transform, jadi posisinya tidak bisa dihitung
  dari layout statis. Kita ambil getBoundingClientRect() dari tombol yang diketuk
  lalu pasang popover dengan position: fixed, dijepit ke dalam viewport.
*/

export type PopoverTarget = { item: MenuItem; rect: DOMRect };

export default function ItemPopover({
  target,
  currentQty,
  currentNote,
  onClose,
  onSubmit,
  onRemove,
}: {
  target: PopoverTarget;
  currentQty: number;
  currentNote: string;
  onClose: () => void;
  onSubmit: (qty: number, note: string) => void;
  onRemove: () => void;
}) {
  const { item, rect } = target;
  const inCart = currentQty > 0;

  const [qty, setQty] = useState(inCart ? currentQty : 1);
  const [note, setNote] = useState(currentNote);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Jepit ke viewport SETELAH ukuran sebenarnya diketahui, sebelum paint.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const pad = 12;
    const w = box.offsetWidth;
    const h = box.offsetHeight;

    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.min(Math.max(pad, left), window.innerWidth - w - pad);

    // Default di bawah lingkaran; pindah ke atas kalau tidak cukup ruang.
    let top = rect.bottom + 10;
    if (top + h > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - h - 10);
    }
    setPos({ left, top });
  }, [rect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
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
        <button className="pop-close" onClick={onClose} aria-label="Tutup">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="pop-head">
          <span className="material-symbols-outlined pop-icon">
            {item.icon_name ?? "restaurant"}
          </span>
          <div>
            <h3>{item.name}</h3>
            <p className="pop-price">{rupiah(item.price)}</p>
          </div>
        </div>

        {item.description && <p className="pop-desc">{item.description}</p>}

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

        <label className="field field-compact">
          <span>Catatan (opsional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. tidak pakai sambal"
            maxLength={80}
          />
        </label>

        <div className="pop-actions">
          {inCart && (
            <button type="button" className="btn-ghost btn-danger" onClick={onRemove}>
              Hapus
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSubmit(qty, note.trim())}
          >
            {inCart ? "Perbarui" : `Tambah · ${rupiah(item.price * qty)}`}
          </button>
        </div>
      </div>
    </>
  );
}
