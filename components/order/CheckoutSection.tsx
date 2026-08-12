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
}: {
  lines: CartLine[];
  totalQty: number;
  totalRp: number;
  settings: Settings;
  onChangeQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
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
            {lines.map((l) => (
              <div className="cart-line" key={l.id}>
                <div className="cart-qty" role="group" aria-label={`Jumlah ${l.name}`}>
                  <button
                    type="button"
                    onClick={() => onChangeQty(l.id, l.qty - 1)}
                    aria-label={`Kurangi ${l.name}`}
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <span>{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => onChangeQty(l.id, l.qty + 1)}
                    aria-label={`Tambah ${l.name}`}
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>

                <div className="nm">
                  {l.name}
                  {l.note && <span className="cart-note">{l.note}</span>}
                </div>

                <span className="pr">{rupiah(l.lineTotal)}</span>

                <button
                  type="button"
                  className="cart-del"
                  onClick={() => onRemove(l.id)}
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

        <button
          type="button"
          className="btn-primary"
          disabled
          title="Menyusul di Fase 2"
        >
          Lanjut Pembayaran
        </button>
        {!empty && (
          <p className="entry-foot">
            Anda masih bisa mengubah pesanan sampai pembayaran dilakukan.
          </p>
        )}
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
