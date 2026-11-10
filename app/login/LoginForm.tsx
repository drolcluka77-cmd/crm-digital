"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(
    loginAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
