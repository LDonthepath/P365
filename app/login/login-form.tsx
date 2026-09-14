"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="login-form">
      <label htmlFor="email">Email</label>
      <input autoComplete="email" id="email" name="email" placeholder="you@example.com" required type="email" />
      <label htmlFor="password">Password</label>
      <input autoComplete="current-password" id="password" name="password" required type="password" />
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button disabled={pending} type="submit">{pending ? "Memverifikasi..." : "Masuk ke briefing"}</button>
    </form>
  );
}
