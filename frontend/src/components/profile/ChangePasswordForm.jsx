import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api } from "../../lib/api";
import PasswordInput from "../auth/PasswordInput";

const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const cardClass = "rounded-xl border border-white/10 bg-slate-900 p-4";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Couldn't change your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-4 ${cardClass}`}>
      <div className="flex items-center gap-2 text-slate-100">
        <KeyRound className="h-4 w-4" />
        <p className="text-sm font-semibold">Change password</p>
      </div>

      {success && (
        <p className="text-sm text-emerald-400">
          Password changed. You'll need to log in again with it next time.
        </p>
      )}

      <div>
        <label htmlFor="change-current-password" className={labelClass}>
          Current password
        </label>
        <PasswordInput
          id="change-current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Your current password"
        />
      </div>
      <div>
        <label htmlFor="change-new-password" className={labelClass}>
          New password
        </label>
        <PasswordInput
          id="change-new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label htmlFor="change-confirm-password" className={labelClass}>
          Confirm new password
        </label>
        <PasswordInput
          id="change-confirm-password"
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
        className="rounded-lg bg-brand-btn py-2.5 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}
