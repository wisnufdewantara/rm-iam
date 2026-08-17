// Umpan balik dari server action. Aksi admin memakai <form action> biasa tanpa
// JavaScript tambahan, jadi pesannya dibawa lewat query string — bukan state
// klien. Efeknya halaman admin tetap berfungsi walau JS gagal dimuat.
export default function AdminNotice({
  ok,
  err,
}: {
  ok?: string;
  err?: string;
}) {
  if (!ok && !err) return null;
  return (
    <p className={err ? "notice notice-danger" : "notice notice-ok"} role="status">
      <span className="material-symbols-outlined">
        {err ? "error" : "check_circle"}
      </span>
      <span>{err ?? ok}</span>
    </p>
  );
}
