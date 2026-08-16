"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OrderStatus, OrderStatusValue } from "@/lib/orderStatus";
import { rupiah } from "@/lib/types";

/*
  Halaman tunggu (PRD §4.4).

  Status disegarkan lewat polling 4 detik ke Route Handler, bukan Realtime —
  halaman ini diakses anonim, dan polling kebal terhadap reconnect di jaringan
  HP. Polling berhenti sendiri begitu pesanan mencapai status akhir.
*/

const STEPS: { key: OrderStatusValue; label: string }[] = [
  { key: "paid", label: "Dibayar" },
  { key: "queued", label: "Diantre" },
  { key: "done", label: "Selesai" },
];

function stepIndex(status: OrderStatusValue): number {
  if (status === "paid") return 0;
  if (status === "queued") return 1;
  if (status === "done") return 2;
  return -1;
}

export default function WaitingView({ initial }: { initial: OrderStatus }) {
  const [order, setOrder] = useState<OrderStatus>(initial);
  const [gone, setGone] = useState(false);

  const finished = order.status === "done" || order.status === "cancelled";

  useEffect(() => {
    if (finished) return; // tidak ada gunanya polling status akhir
    let alive = true;

    const tick = async () => {
      try {
        const r = await fetch(`/api/orders/${order.order_number}/status`, {
          cache: "no-store",
        });
        if (r.status === 410 || r.status === 404) {
          if (alive) setGone(true);
          return;
        }
        const next = (await r.json()) as OrderStatus;
        if (alive && next.found) setOrder(next);
      } catch {
        // Jaringan HP naik-turun itu normal; percobaan berikutnya 4 detik lagi.
      }
    };

    const id = window.setInterval(tick, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [order.order_number, finished]);

  if (gone) {
    return (
      <div className="setup">
        <h1>Pesanan sudah kedaluwarsa</h1>
        <p>Halaman ini hanya aktif 12 jam setelah pesanan selesai.</p>
        <Link href="/" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
          Pesan lagi
        </Link>
      </div>
    );
  }

  const idx = stepIndex(order.status);
  const cancelled = order.status === "cancelled";
  const done = order.status === "done";

  return (
    <div className="wait">
      {/* Dial mini yang berputar; berhenti dan jadi centang saat selesai */}
      <div className={`waitdial ${done ? "is-done" : ""} ${cancelled ? "is-cancel" : ""}`}>
        <div className="waitdial-ring" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
        <div className="waitdial-core">
          {done ? (
            <span className="material-symbols-outlined">check</span>
          ) : cancelled ? (
            <span className="material-symbols-outlined">close</span>
          ) : (
            <span className="waitdial-num">{order.order_number.split("-")[1]}</span>
          )}
        </div>
      </div>

      <p className="wait-cap">Nomor Pesanan</p>
      <h1 className="wait-number">{order.order_number}</h1>
      <p className="wait-meta">
        Meja {order.table_number}
        {order.customer_short ? ` · ${order.customer_short}` : ""} · {order.item_count} item
      </p>

      {cancelled ? (
        <p className="notice notice-danger">
          <span className="material-symbols-outlined">cancel</span>
          <span>
            Pesanan dibatalkan{order.cancel_reason ? `: ${order.cancel_reason}` : ""}.
            Silakan hubungi waiter kami.
          </span>
        </p>
      ) : (
        <>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li
                key={s.key}
                className={i < idx ? "is-past" : i === idx ? "is-now" : ""}
              >
                <span className="dot" />
                {s.label}
              </li>
            ))}
          </ol>

          {order.status === "paid" && (
            <p className="wait-queue">
              {order.queue_position > 0
                ? `${order.queue_position} pesanan di depan Anda`
                : "Pesanan Anda berikutnya"}
            </p>
          )}
          {done && <p className="wait-ready">Silakan ambil di kasir 🎉</p>}
        </>
      )}

      {order.mine && order.items.length > 0 && (
        <ul className="pay-items wait-items">
          {order.items.map((it, i) => (
            <li key={i} className={it.status === "cancelled" ? "is-cancelled" : ""}>
              <span className="q">{it.qty}×</span>
              <span className="n">
                {it.name}
                {it.note && <em>{it.note}</em>}
              </span>
              <span className="p">{rupiah(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="cart-total wait-total">
        <span>Total</span>
        <span>{rupiah(order.total)}</span>
      </div>

      {/* Pengingat wajib, juga di halaman ini (PRD §2) */}
      <p className="notice">
        <span className="material-symbols-outlined">info</span>
        <span>
          Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri. Silakan
          panggil waiter kami.
        </span>
      </p>

      <div className="wait-actions">
        <Link href="/" className="btn-primary">
          Pesan Lagi
        </Link>
        <Link href="/pesanan-saya" className="btn-ghost">
          Pesanan saya
        </Link>
      </div>
    </div>
  );
}
