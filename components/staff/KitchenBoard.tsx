"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { advanceOrderAction } from "@/lib/kitchenActions";
import { siblingCount, type KitchenOrder } from "@/lib/kitchenTypes";

/*
  Kitchen Display System — 3 kolom.

  Realtime dipakai sebagai SINYAL, bukan sumber data: begitu ada perubahan di
  orders/order_items, komponen memanggil router.refresh() dan server component
  mengambil ulang datanya. Dengan begitu query dan RLS-nya cuma ada di satu
  tempat — tidak ada logika baca yang diduplikasi di klien dan bisa menyimpang.
*/

const COLUMNS = [
  { key: "paid" as const, title: "Masuk", icon: "receipt_long" },
  { key: "queued" as const, title: "Diantre", icon: "skillet" },
  { key: "done" as const, title: "Selesai", icon: "check_circle" },
];

function ageLabel(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function KitchenBoard({ orders }: { orders: KitchenOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [, setTick] = useState(0);

  // Umur pesanan harus terus berjalan tanpa memuat ulang data.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("kitchen")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        router.refresh()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () =>
        router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  function advance(orderId: string, to: "queued" | "done") {
    setError(null);
    start(async () => {
      const res = await advanceOrderAction({ orderId, to });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <div className="kds-toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
          />
          Kelompokkan per meja
        </label>
        {error && (
          <span className="field-error">
            <span className="material-symbols-outlined">error</span>
            {error}
          </span>
        )}
      </div>

      <div className="kds">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.key);
          return (
            <section className={`kds-col kds-${col.key}`} key={col.key}>
              <h2>
                <span className="material-symbols-outlined">{col.icon}</span>
                {col.title}
                <span className="kds-count">{list.length}</span>
              </h2>

              {list.length === 0 && <p className="kds-empty">Kosong</p>}

              {(grouped ? groupByTable(list) : list.map((o) => [o])).map((group, gi) => (
                <div key={gi} className={grouped ? "kds-group" : undefined}>
                  {grouped && group.length > 1 && (
                    <p className="kds-group-cap">
                      Meja {group[0].table_number} · {group.length} pesanan
                    </p>
                  )}

                  {group.map((o) => {
                    const others = siblingCount(orders, o);
                    return (
                      <article className="kds-card" key={o.id}>
                        <header>
                          <strong>{o.order_number}</strong>
                          <span className="kds-age">{ageLabel(o.created_at)}</span>
                        </header>

                        <p className="kds-table">
                          Meja {o.table_number}
                          {/* Nama sejajar nomor meja, bukan lebih kecil:
                              penanda meja dipakai ulang, jadi nama adalah
                              pembeda saat nomornya bertabrakan (PRD §3.1.2). */}
                          {o.customer_name && <b> · {o.customer_name}</b>}
                        </p>

                        {others > 0 && (
                          <p className="kds-sibling">
                            <span className="material-symbols-outlined">group</span>
                            +{others} pesanan lain di meja ini
                          </p>
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
                            </li>
                          ))}
                        </ul>

                        {col.key === "paid" && (
                          <button
                            className="btn-primary kds-btn"
                            disabled={pending}
                            onClick={() => advance(o.id, "queued")}
                          >
                            Antrekan
                          </button>
                        )}
                        {col.key === "queued" && (
                          <button
                            className="btn-primary kds-btn kds-done"
                            disabled={pending}
                            onClick={() => advance(o.id, "done")}
                          >
                            Selesai
                          </button>
                        )}
                        {/* Tidak ada tombol batal di sini — memang tidak boleh. */}
                      </article>
                    );
                  })}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

function groupByTable(list: KitchenOrder[]): KitchenOrder[][] {
  const map = new Map<string, KitchenOrder[]>();
  for (const o of list) {
    const arr = map.get(o.table_number);
    if (arr) arr.push(o);
    else map.set(o.table_number, [o]);
  }
  return [...map.values()];
}
