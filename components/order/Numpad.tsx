"use client";

// Papan angka di layar untuk anjungan mandiri.
//
// Jangan mengandalkan keyboard OS di kiosk: di banyak tablet yang dipasang
// permanen, keyboard sistemnya dimatikan atau muncul menutupi setengah layar.
//
// Tetap menerima teks non-angka lewat tombol khusus, karena ada penanda
// bungkus bernomor "TA-3" (PRD §3.1.2).
export default function Numpad({
  value,
  onChange,
  allowPrefix,
}: {
  value: string;
  onChange: (next: string) => void;
  allowPrefix?: boolean;
}) {
  const press = (k: string) => {
    if (value.length >= 8) return;
    onChange(value + k);
  };

  return (
    <div className="numpad" role="group" aria-label="Papan angka">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
        <button type="button" key={k} onClick={() => press(k)}>
          {k}
        </button>
      ))}

      {allowPrefix ? (
        <button
          type="button"
          className="numpad-alt"
          onClick={() => onChange(value.startsWith("TA-") ? value : "TA-")}
          title="Penanda bungkus"
        >
          TA-
        </button>
      ) : (
        <span />
      )}

      <button type="button" onClick={() => press("0")}>
        0
      </button>

      <button
        type="button"
        className="numpad-del"
        onClick={() => onChange(value.slice(0, -1))}
        aria-label="Hapus satu karakter"
      >
        <span className="material-symbols-outlined">backspace</span>
      </button>
    </div>
  );
}
