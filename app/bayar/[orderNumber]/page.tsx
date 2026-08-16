import Link from "next/link";
import PayButton from "@/components/order/PayButton";
import { fetchOrderStatus, STATUS_LABEL } from "@/lib/orderStatus";
import { rupiah } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BayarPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await fetchOrderStatus(orderNumber);

  if (!order.found) {
    return (
      <div className="setup">
        <h1>Pesanan tidak ditemukan</h1>
        <p>Nomor {orderNumber} tidak ada atau sudah kedaluwarsa.</p>
        <Link href="/" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
          Kembali
        </Link>
      </div>
    );
  }

  const paid = order.status !== "pending_payment";

  return (
    <div className="app">
      <div className="pay">
        <p className="mock-banner">
          <span className="material-symbols-outlined">science</span>
          MOCKUP — tidak ada transaksi nyata
        </p>

        <div className="pay-card">
          <p className="pay-cap">Nomor Pesanan</p>
          <p className="pay-number">{order.order_number}</p>
          <p className="pay-meta">
            Meja {order.table_number}
            {order.customer_short ? ` · ${order.customer_short}` : ""}
          </p>

          <hr className="pop-sep" />

          {order.mine && order.items.length > 0 ? (
            <ul className="pay-items">
              {order.items.map((it, i) => (
                <li key={i}>
                  <span className="q">{it.qty}×</span>
                  <span className="n">
                    {it.name}
                    {it.note && <em>{it.note}</em>}
                  </span>
                  <span className="p">{rupiah(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pay-meta">{order.item_count} item</p>
          )}

          <div className="cart-total">
            <span>Total</span>
            <span>{rupiah(order.total)}</span>
          </div>

          {paid ? (
            <>
              <p className="notice">
                <span className="material-symbols-outlined">check_circle</span>
                <span>
                  Pesanan sudah dibayar ({STATUS_LABEL[order.status]}). Tidak bisa
                  diubah lagi.
                </span>
              </p>
              <Link
                href={`/pesanan/${order.order_number}`}
                className="btn-primary"
                style={{ display: "block", textAlign: "center" }}
              >
                Lihat status pesanan
              </Link>
            </>
          ) : (
            <>
              <p className="notice">
                <span className="material-symbols-outlined">info</span>
                <span>
                  Setelah membayar, pesanan tidak bisa diubah atau dibatalkan
                  sendiri. Silakan panggil waiter kami bila perlu perubahan.
                </span>
              </p>
              <PayButton orderNumber={order.order_number} />
              {/* Selama masih pending_payment, pengunjung boleh kembali & edit */}
              <Link href="/" className="btn-ghost pay-back">
                Kembali &amp; ubah pesanan
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
