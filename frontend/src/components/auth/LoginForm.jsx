import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import PasswordInput from "./PasswordInput";
import { useSchool } from "../school/SchoolProvider";
import { emailExample } from "../../lib/schools";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function LoginForm({ onSwitchToSignup, onForgotPassword }) {
  const { login } = useAuth();
  const { school } = useSchool();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="login-email" className={labelClass}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder={emailExample(school)}
        />
      </div>
      <div>
        <label htmlFor="login-password" className={labelClass}>
          Password
        </label>
        <PasswordInput
          id="login-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
        />
        <button
          type="button"
          onClick={onForgotPassword}
          className="mt-1.5 text-xs font-medium text-slate-400 hover:text-brand-teal"
        >
          Forgot password?
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-lg shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Logging in..." : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-400">
        New to FoundIT?{" "}
        <button type="button" onClick={onSwitchToSignup} className="font-semibold text-brand-teal hover:underline">
          Create an account
        </button>
      </p>
    </form>
  );
}
