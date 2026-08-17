"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
  Mode kiosk (PRD §4.5).

  Diaktifkan lewat `?mode=kiosk`. Bedanya dari HP pengunjung:
    - target sentuh lebih besar (lewat atribut data-mode di CSS)
    - papan angka di layar; jangan mengandalkan keyboard OS di anjungan
    - reset otomatis saat ditinggalkan, supaya pengunjung berikutnya tidak
      melanjutkan pesanan orang sebelumnya

  Reset memberi peringatan dulu ("Masih di sana?") selama 10 detik terakhir —
  membuang keranjang tanpa aba-aba itu menjengkelkan kalau orangnya masih ada,
  cuma sedang membaca menu.

  Catatan implementasi: `Date.now()` dan penulisan ref sengaja TIDAK dilakukan
  saat render. Aturan react-hooks/refs & impure-function di Next 16 benar soal
  ini — keduanya membuat render tidak murni, dan pada Strict Mode bisa
  menghasilkan nilai yang berbeda antar percobaan render.
*/

const WARN_SECS = 10;

export function useKioskIdle({
  enabled,
  idleSecs,
  onReset,
}: {
  enabled: boolean;
  idleSecs: number;
  onReset: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastActive = useRef<number | null>(null);
  const resetRef = useRef(onReset);

  // Callback terbaru disimpan lewat effect, bukan ditulis saat render.
  useEffect(() => {
    resetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    if (!enabled) return;

    lastActive.current = Date.now();

    const bump = () => {
      lastActive.current = Date.now();
      setRemaining(null);
    };

    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true });

    const id = window.setInterval(() => {
      const started = lastActive.current;
      if (started === null) return;

      const left = idleSecs - Math.floor((Date.now() - started) / 1000);
      if (left <= 0) {
        setRemaining(null);
        lastActive.current = Date.now();
        resetRef.current();
      } else if (left <= WARN_SECS) {
        setRemaining(left);
      }
    }, 1000);

    return () => {
      for (const e of events) window.removeEventListener(e, bump);
      window.clearInterval(id);
      setRemaining(null);
    };
  }, [enabled, idleSecs]);

  const keepAlive = useCallback(() => {
    lastActive.current = Date.now();
    setRemaining(null);
  }, []);

  return { warnRemaining: remaining, keepAlive };
}
