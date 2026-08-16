"use client";

import { useEffect, useRef, useState } from "react";
import type { CartLine } from "@/lib/cart";
import { rupiah } from "@/lib/types";
import type { Settings } from "@/lib/types";

/*
  Section checkout: di halaman yang sama, di bawah dial, dipisah separator
  (PRD §4.3). Bukan modal — pengunjung harus bisa melihat pesanannya sambil
  masih memilih menu.

  Mini-bar sticky muncul kalau keranjang tidak kosong DAN section ini sedang
  di luar viewport, supaya total selalu terlihat tanpa harus scroll.
*/

export default function CheckoutSection({
  lines,
  totalQty,
  totalRp,
  settings,
  onChangeQty,
  onRemove,
  onChangeNote,
}: {
  lines: CartLine[];
  totalQty: number;
  totalRp: number;
  settings: Settings;
  onChangeQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onChangeNote: (lineId: string, note: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const empty = lines.length === 0;

  return (
    <>
      <hr className="separator" />

      <section className="checkout" ref={ref}>
        <h2>
          Pesanan Anda
          <span className="count">{empty ? "belum ada" : `${totalQty} item`}</span>
        </h2>

        {empty ? (
          <p className="cart-empty">
            Belum ada pesanan. Pilih kategori di atas untuk mulai memesan.
          </p>
        ) : (
          <>
            {/* Satu baris = satu VARIAN. Item yang sama dengan catatan berbeda
                muncul sebagai baris terpisah, jadi dapur tidak perlu menafsirkan
                "3 nasi goreng, yang 1 pedas". */}
            {lines.map((l) => (
              <div className="cart-line" key={l.lineId}>
                <div className="cart-qty" role="group" aria-label={`Jumlah ${l.name}`}>
                  <button
                    type="button"
                    onClick={() => onChangeQty(l.lineId, l.qty - 1)}
                    aria-label={`Kurangi ${l.name}`}
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <span>{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => onChangeQty(l.lineId, l.qty + 1)}
                    aria-label={`Tambah ${l.name}`}
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>

                <div className="nm">
                  {l.name}
                  <input
                    className="cart-note-input"
                    value={l.note}
                    onChange={(e) => onChangeNote(l.lineId, e.target.value)}
                    placeholder="tambah catatan…"
                    maxLength={80}
                    aria-label={`Catatan untuk ${l.name}`}
                  />
                </div>

                <span className="pr">{rupiah(l.lineTotal)}</span>

                <button
                  type="button"
                  className="cart-del"
                  onClick={() => onRemove(l.lineId)}
                  aria-label={`Hapus ${l.name}`}
                >
                  <span className="material-symbols-outlined">delete</span>
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

        {/* Pembayaran belum dibangun. Penjelasannya ditulis TERLIHAT, bukan
            lewat atribut `title`: tooltip tidak pernah muncul di layar sentuh,
            jadi di HP dan kiosk pengunjung hanya akan dapat tombol mati tanpa
            keterangan apa pun. Teksnya juga untuk pengunjung, bukan jargon
            internal seperti "Fase 2". */}
        <button type="button" className="btn-primary" disabled>
          Lanjut Pembayaran
        </button>
        <p className="entry-foot">
          {empty
            ? "Pilih menu dulu untuk melanjutkan."
            : "Pembayaran belum tersedia pada demo ini. Anda masih bisa mengubah pesanan."}
        </p>
      </section>

      {/* Mini-bar sticky */}
      {!empty && offscreen && (
        <div className="minibar">
          <span>
            {totalQty} item · <strong>{rupiah(totalRp)}</strong>
          </span>
          <button
            type="button"
            onClick={() => ref.current?.scrollIntoView({ behavior: "smooth" })}
          >
            Lihat pesanan
          </button>
        </div>
      )}
    </>
  );
}
