import Link from "next/link";
import WaitingView from "@/components/order/WaitingView";
import { fetchOrderStatus, type OrderStatus } from "@/lib/orderStatus";

// Halaman dinamis per nomor pesanan (PRD §4.4). Selalu segar — statusnya
// berubah dari layar dapur.
export const dynamic = "force-dynamic";

export default async function PesananPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await fetchOrderStatus(orderNumber);

  if (!order.found) {
    const expired = "expired" in order && order.expired;
    return (
      <div className="setup">
        <h1>{expired ? "Pesanan sudah kedaluwarsa" : "Pesanan tidak ditemukan"}</h1>
        <p>
          {expired
            ? "Halaman ini hanya aktif 12 jam setelah pesanan selesai."
            : `Nomor ${orderNumber} tidak ada.`}
        </p>
        <Link href="/" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
          Pesan lagi
        </Link>
      </div>
    );
  }

  // Status awal dirender di server supaya halaman langsung terisi walau
  // fungsi serverless-nya cold start.
  return (
    <div className="app">
      <WaitingView initial={order as OrderStatus} />
    </div>
  );
}
