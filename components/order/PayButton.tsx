"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { payOrderAction } from "@/lib/orders";

export default function PayButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = pending || processing;

  function pay() {
    setError(null);
    setProcessing(true);
    // Jeda pendek supaya terasa seperti pembayaran sungguhan — dan supaya
    // jelas ini mockup, bukan tombol yang tidak melakukan apa-apa.
    window.setTimeout(() => {
      start(async () => {
        const res = await payOrderAction(orderNumber);
        setProcessing(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.replace(`/pesanan/${orderNumber}`);
      });
    }, 1200);
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={pay} disabled={busy}>
        {busy ? "Memproses pembayaran…" : "Bayar Sekarang"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <span className="material-symbols-outlined">error</span>
          {error}
        </p>
      )}
    </>
  );
}
