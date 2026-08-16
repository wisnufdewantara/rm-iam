"use client";

import { useActionState } from "react";
import { signInAction } from "@/lib/staffActions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, null);

  return (
    <form className="entry-card" action={action}>
      <h1 className="entry-title">Masuk Staf</h1>
      <p className="entry-kicker">Halaman ini untuk waiter, dapur, dan admin.</p>

      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="dapur@demo.local"
          required
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state?.error && (
        <p className="field-error" role="alert">
          <span className="material-symbols-outlined">error</span>
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
