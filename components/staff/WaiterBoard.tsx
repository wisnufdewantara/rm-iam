"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  cancelItemAction,
  cancelOrderAction,
  markServedAction,
} from "@/lib/waiterActions";
import {
  activeItemCount,
  groupByTable,
  STATUS_TEXT,
  type WaiterOrder,
} from "@/lib/waiterTypes";
import { rupiah } from "@/lib/types";

/*
  Layar waiter.

  Dikelompokkan per meja secara bawaan (PRD §3.3): penanda meja dipakai ulang,
  jadi satu nomor bisa memuat pesanan milik orang berbeda — mengelompokkan
  membuat anomali itu terlihat, dan memudahkan mengantar satu meja sekaligus.

  Realtime sebagai sinyal, sama seperti layar dapur.
*/

type Filter = "all" | "paid" | "queued" | "done";

export default function WaiterBoard({ orders }: { orders: WaiterOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [flat, setFlat] = useState(false);
  const [cancelling, setCancelling] = useState<WaiterOrder | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const ch = supabase
      .channel("waiter")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        router.refresh()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () =>
        router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!needle) return true;
      return (
        o.order_number.toLowerCase().includes(needle) ||
        o.table_number.toLowerCase().includes(needle) ||
        o.customer_name.toLowerCase().includes(needle)
      );
    });
  }, [orders, filter, q]);

  const groups = useMemo(() => groupByTable(visible), [visible]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Gagal.");
      else router.refresh();
    });
  }

  return (
    <>
      <div className="kds-toolbar wt-toolbar">
        <div className="wt-filters">
          {(["all", "paid", "queued", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f ? "is-on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Semua" : STATUS_TEXT[f]}
            </button>
          ))}
        </div>
        <input
          className="wt-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nomor pesanan / meja / nama"
          aria-label="Cari pesanan"
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={flat}
            onChange={(e) => setFlat(e.target.checked)}
          />
          Daftar rata
        </label>
        {error && (
          <span className="field-error">
            <span className="material-symbols-outlined">error</span>
            {error}
          </span>
        )}
      </div>

      <div className="wt">
        {visible.length === 0 && <p className="kds-empty wt-empty">Tidak ada pesanan aktif.</p>}

        {(flat
          ? [{ table: "", orders: visible, total: 0 }]
          : groups
        ).map((g) => (
          <section className="wt-group" key={g.table || "flat"}>
            {!flat && (
              <h2>
                Meja {g.table}
                <span className="wt-group-meta">
                  {g.orders.length} pesanan · {rupiah(g.total)}
                </span>
              </h2>
            )}

            {g.orders.map((o) => (
              <article
                className={`wt-card ${o.status === "cancelled" ? "is-cancelled" : ""}`}
                key={o.id}
              >
                <header>
                  <strong>{o.order_number}</strong>
                  <span className={`pill pill-${o.status}`}>{STATUS_TEXT[o.status]}</span>
                  <span className="wt-total">{rupiah(o.total)}</span>
                </header>

                <p className="kds-table">
                  Meja {o.table_number}
                  {o.customer_name && <b> · {o.customer_name}</b>} ·{" "}
                  {activeItemCount(o)} item
                </p>

                {o.cancel_reason && (
                  <p className="wt-reason">Alasan: {o.cancel_reason}</p>
                )}

                <ul className="kds-items">
                  {o.items.map((it) => (
                    <li
                      key={it.id}
                      className={it.status === "cancelled" ? "is-cancelled" : ""}
                    >
                      <span className="q">{it.qty}×</span>
                      <span className="n">
                        {it.name}
                        {it.note && <em>{it.note}</em>}
                      </span>
                      <span className="wt-price">{rupiah(it.price * it.qty)}</span>
                      {it.status === "active" && o.status !== "cancelled" && (
                        <button
                          type="button"
                          className="cart-del"
                          disabled={pending}
                          title={`Batalkan ${it.name}`}
                          aria-label={`Batalkan ${it.name}`}
                          onClick={() =>
                            run(() =>
                              cancelItemAction({ orderId: o.id, itemId: it.id })
                            )
                          }
                        >
                          <span className="material-symbols-outlined">
                            remove_shopping_cart
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {o.status !== "cancelled" && (
                  <div className="wt-actions">
                    {o.status === "done" && (
                      <button
                        type="button"
                        className="btn-primary kds-btn kds-done"
                        disabled={pending}
                        onClick={() => run(() => markServedAction({ orderId: o.id }))}
                      >
                        Sudah diantar
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost btn-danger wt-cancel"
                      disabled={pending}
                      onClick={() => {
                        setReason("");
                        setCancelling(o);
                      }}
                    >
                      Batalkan pesanan
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>

      {/* Dialog alasan pembatalan. Alasan wajib — pembatalan tanpa alasan
          membuat jejak auditnya tidak berguna, dan tamu berhak tahu sebabnya. */}
      {cancelling && (
        <>
          <div className="pop-backdrop" onClick={() => setCancelling(null)} />
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <h3>Batalkan {cancelling.order_number}?</h3>
            <p className="pop-desc">
              Meja {cancelling.table_number}
              {cancelling.customer_name ? ` · ${cancelling.customer_name}` : ""} ·{" "}
              {rupiah(cancelling.total)}
            </p>
            <label className="field field-compact">
              <span>Alasan (wajib)</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="mis. tamu membatalkan, stok habis"
                maxLength={200}
                autoFocus
              />
            </label>
            <div className="pop-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCancelling(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary wt-confirm"
                disabled={pending || reason.trim().length < 3}
                onClick={() => {
                  const target = cancelling;
                  setCancelling(null);
                  run(() =>
                    cancelOrderAction({ orderId: target.id, reason: reason.trim() })
                  );
                }}
              >
                Ya, batalkan
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
