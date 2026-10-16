import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import PasswordInput from "../auth/PasswordInput";

const cardClass = "rounded-xl border border-red-900/40 bg-red-950/20 p-4";

export default function DeleteAccountForm() {
  const { logout } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.deleteAccount(password);
      // The backend already revoked this session and cleared its
      // cookies -- logout() just clears the client-side state so
      // AuthGate falls back to the login screen immediately.
      logout();
    } catch (err) {
      setError(err.message || "Couldn't delete your account.");
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-center text-xs text-red-400 opacity-80 underline hover:opacity-100"
      >
        Delete my account
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${cardClass}`}>
      <div className="flex items-center gap-2 text-red-400">
        <AlertTriangle className="h-4 w-4" />
        <p className="text-sm font-semibold">Delete your account</p>
      </div>
      <p className="text-sm text-slate-300">
        Your name, email, password, and ID number are permanently removed and you're logged out
        everywhere. Items you've posted and messages you've sent stay visible to others (attributed to
        "Deleted User") so their conversations and open item reports aren't broken — this can't be
        undone.
      </p>
      <div>
        <label htmlFor="delete-account-password" className="mb-1 block text-sm font-medium text-slate-300">
          Enter your password to confirm
        </label>
        <PasswordInput
          id="delete-account-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setPassword("");
            setError("");
          }}
          className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
        >
          {submitting ? "Deleting..." : "Permanently delete"}
        </button>
      </div>
    </form>
  );
}
