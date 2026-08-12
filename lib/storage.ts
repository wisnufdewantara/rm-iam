"use client";

import { useSyncExternalStore } from "react";

/*
  State yang bertahan di localStorage.

  Kenapa useSyncExternalStore dan bukan useState + useEffect:

  1. localStorage itu state eksternal yang bisa berubah di luar React (tab lain,
     devtools). useSyncExternalStore memang dibuat untuk kasus ini.
  2. Pola "baca localStorage di useEffect lalu setState" melanggar aturan
     react-hooks/set-state-in-effect di Next 16 — dan aturannya benar: itu
     memicu render berantai setiap kali komponen mount.
  3. getServerSnapshot memberi nilai awal saat SSR, jadi tidak ada hydration
     mismatch: server merender nilai awal, lalu React membaca ulang setelah
     hydration selesai.

  Efek samping yang berguna: dua tab yang membuka halaman yang sama akan
  otomatis sinkron lewat event `storage`.
*/

type Listener = () => void;

type Store<T> = {
  subscribe: (l: Listener) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (updater: T | ((prev: T) => T)) => void;
  clear: () => void;
};

// Satu store per kunci, dibagi ke semua komponen yang memakainya.
const stores = new Map<string, Store<unknown>>();

function createStore<T>(key: string, initial: T): Store<T> {
  const listeners = new Set<Listener>();
  let lastRaw: string | null = null;
  let cached: T = initial;
  let primed = false;

  // getSnapshot WAJIB memulangkan referensi yang sama kalau datanya tidak
  // berubah — kalau tidak, React menganggapnya selalu berubah dan render
  // tanpa henti. Karena itu hasil JSON.parse di-cache dan dibandingkan lewat
  // string mentahnya.
  function read(): T {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null; // mode privat / storage diblokir
    }
    if (!primed || raw !== lastRaw) {
      primed = true;
      lastRaw = raw;
      if (raw === null) {
        cached = initial;
      } else {
        try {
          cached = JSON.parse(raw) as T;
        } catch {
          cached = initial; // JSON rusak — jangan sampai merusak UI
        }
      }
    }
    return cached;
  }

  function emit() {
    for (const l of listeners) l();
  }

  return {
    subscribe(l) {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },

    getSnapshot: read,
    getServerSnapshot: () => initial,

    set(updater) {
      const prev = read();
      const next =
        typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      cached = next;
      primed = true;
      try {
        const raw = JSON.stringify(next);
        lastRaw = raw;
        window.localStorage.setItem(key, raw);
      } catch {
        // Storage penuh atau diblokir: state in-memory tetap jalan supaya
        // pengunjung tidak kehilangan keranjangnya di sesi ini.
      }
      emit();
    },

    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* diabaikan */
      }
      cached = initial;
      lastRaw = null;
      primed = true;
      emit();
    },
  };
}

function getStore<T>(key: string, initial: T): Store<T> {
  const found = stores.get(key) as Store<T> | undefined;
  if (found) return found;
  // Catatan: `initial` milik pemanggil pertama yang menang. Semua pemanggil
  // untuk kunci yang sama harus memberi nilai awal yang sama.
  const created = createStore(key, initial);
  stores.set(key, created as Store<unknown>);
  return created;
}

export function usePersisted<T>(key: string, initial: T) {
  const store = getStore(key, initial);
  const value = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  return { value, setValue: store.set, clear: store.clear };
}

const noopSubscribe = () => () => {};

/**
 * false saat SSR & hydration, true sesudahnya.
 *
 * Dipakai untuk menunda keputusan "layar mana yang ditampilkan" sampai nilai
 * localStorage benar-benar terbaca — tanpa ini, pengunjung yang sesinya sudah
 * ada akan melihat layar masuk berkelip sesaat setiap refresh.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

// ---- Kunci storage, dikumpulkan di satu tempat supaya tidak salah ketik ----
export const STORAGE = {
  session: "rmiam.session",
  cart: "rmiam.cart",
  myOrders: "rmiam.myOrders",
} as const;
