import { useState } from "react";
import { api } from "../../lib/api";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function ForgotPasswordForm({ onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-slate-100">
          If an account exists for <span className="font-semibold text-slate-50">{email}</span>, a reset link is on
          its way. Check that inbox — the link expires in 1 hour.
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-brand-teal hover:underline"
        >
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="mb-3 text-sm text-slate-300">
          Enter your Nile University email and we'll send you a link to reset your password.
        </p>
        <label htmlFor="forgot-email" className={labelClass}>
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="yourIDnumber@nileuniversity.edu.ng"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full rounded-lg bg-brand-btn py-2.5 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send reset link"}
      </button>
      <button type="button" onClick={onSwitchToLogin} className="text-center text-sm font-medium text-slate-300 hover:text-slate-50">
        Back to log in
      </button>
    </form>
  );
}
