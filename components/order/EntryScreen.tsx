"use client";

import { useState } from "react";
import type { Session } from "@/lib/cart";
import type { Settings } from "@/lib/types";
import Numpad from "./Numpad";

/*
  Layar masuk (PRD §3.1.2).

  Nomor meja DIBACA dari penanda fisik yang sedang dipegang pengunjung —
  standee/asbak bernomor yang dipinjamkan resepsionis. Jadi pengunjung sedang
  MENYALIN angka dari benda di depannya, bukan mengingat. Karena itu pertahanan
  utamanya bukan validasi rumit, tapi langkah konfirmasi yang menampilkan
  nomornya sangat besar supaya bisa dibandingkan sekilas dengan penandanya.

  Komponen ini membaca `settings.identity_mode`, bukan mengasumsikan satu cara.
  Menambah mode 'queue' nanti = menambah satu cabang di sini, bukan membongkar
  alur (PRD §3.1.2 poin 3).
*/

export default function EntryScreen({
  settings,
  markers,
  kiosk,
  onDone,
}: {
  settings: Settings;
  markers: string[]; // nomor penanda aktif
  kiosk?: boolean;
  onDone: (s: Session) => void;
}) {
  const [table, setTable] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const label = settings.table_number_label;
  const validateAgainstList = settings.identity_mode === "marker";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = table.trim();
    const n = name.trim();

    if (!t) return setError(`${label} belum diisi.`);
    if (validateAgainstList && !markers.includes(t)) {
      setError(
        `Penanda nomor ${t} tidak terdaftar. Cek lagi angka pada penanda di meja Anda.`
      );
      return;
    }
    if (settings.ask_customer_name && !n) {
      return setError("Nama belum diisi — dipakai untuk memanggil pesanan Anda.");
    }

    setError(null);
    setConfirming(true);
  }

  if (confirming) {
    return (
      <div className="entry">
        <div className="entry-card">
          <p className="entry-kicker">Pastikan nomornya sama dengan penanda di meja Anda</p>
          <div className="confirm-num">{table.trim()}</div>
          <p className="confirm-cap">{label}</p>
          {settings.ask_customer_name && (
            <p className="confirm-name">
              atas nama <strong>{name.trim()}</strong>
            </p>
          )}
          <div className="entry-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setConfirming(false)}
            >
              Ubah
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onDone({ tableNumber: table.trim(), customerName: name.trim() })
              }
            >
              Benar, lanjut
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="entry">
      <form className="entry-card" onSubmit={submit}>
        <h1 className="entry-title">{settings.brand_name}</h1>
        <p className="entry-kicker">
          Masukkan nomor yang tertera pada penanda di meja Anda
        </p>

        <label className="field">
          <span>{label}</span>
          <input
            value={table}
            onChange={(e) => {
              setTable(e.target.value);
              setError(null);
            }}
            // inputMode numeric memunculkan papan angka di HP, tapi tetap
            // menerima teks: ada penanda "TA-3" untuk bungkus.
            inputMode="numeric"
            autoComplete="off"
            autoFocus={!kiosk}
            readOnly={kiosk}
            placeholder="12"
            maxLength={8}
          />
        </label>

        {/* Di kiosk, angka diketuk di layar — keyboard OS sering dimatikan
            atau menutupi setengah layar pada tablet yang dipasang permanen. */}
        {kiosk && (
          <Numpad
            value={table}
            onChange={(v) => {
              setTable(v);
              setError(null);
            }}
            allowPrefix
          />
        )}

        {settings.ask_customer_name && (
          <label className="field">
            <span>Nama</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              placeholder="Nama Anda"
              maxLength={40}
            />
          </label>
        )}

        {error && (
          <p className="field-error" role="alert">
            <span className="material-symbols-outlined">error</span>
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary">
          Lanjut
        </button>

        <p className="entry-foot">
          Penanda meja diambil kembali oleh petugas setelah Anda selesai.
        </p>
      </form>
    </div>
  );
}
