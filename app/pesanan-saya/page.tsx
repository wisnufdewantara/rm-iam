import Link from "next/link";
import { fetchMyOrders, STATUS_LABEL } from "@/lib/orderStatus";
import { rupiah } from "@/lib/types";

export const dynamic = "force-dynamic";

// Hanya pesanan milik guest_token di cookie — bukan semua pesanan di meja itu.
// Orang asing bisa saja mengetik nomor meja yang sama; pengelompokan per meja
// adalah fitur staf (PRD §3.1.1).
export default async function PesananSaya() {
  const orders = await fetchMyOrders();

  return (
    <div className="app">
      <div className="mylist">
        <h1 className="entry-title">Pesanan Saya</h1>

        {orders.length === 0 ? (
          <p className="cart-empty">Belum ada pesanan aktif dari perangkat ini.</p>
        ) : (
          <ul className="mylist-items">
            {orders.map((o) => (
              <li key={o.order_number}>
                <Link href={`/pesanan/${o.order_number}`}>
                  <div>
                    <strong>{o.order_number}</strong>
                    <span className={`pill pill-${o.status}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className="mylist-meta">
                    Meja {o.table_number} · {rupiah(o.total)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link href="/" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
          Pesan Lagi
        </Link>
      </div>
    </div>
  );
}
