import { useState } from "react";
import { api } from "../../lib/api";
import PasswordInput from "./PasswordInput";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function ResetPasswordForm({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "This reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-slate-100">Your password has been reset. You can log in with it now.</p>
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-lg shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98]"
        >
          Go to log in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">Choose a new password for your account.</p>
      <div>
        <label htmlFor="reset-password" className={labelClass}>
          New password
        </label>
        <PasswordInput
          id="reset-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label htmlFor="reset-confirm-password" className={labelClass}>
          Confirm new password
        </label>
        <PasswordInput
          id="reset-confirm-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Type it again"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-lg shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
