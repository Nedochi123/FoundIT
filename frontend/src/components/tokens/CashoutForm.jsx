import { useState } from "react";
import { api } from "../../lib/api";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function CashoutForm({ tier, maxNaira, onCancel, onDone }) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.cashoutTokens({ tier, bankName, accountNumber, accountName });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
        <p className="text-sm font-semibold text-slate-50">Request submitted</p>
        <p className="mt-1 text-xs text-slate-200">
          Your ₦{maxNaira.toLocaleString()} cash-out request is in — the team will pay it out to the account you
          gave and mark it paid.
        </p>
        <button
          onClick={onDone}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-slate-900 p-5"
    >
      <p className="text-sm font-semibold text-slate-50">
        Cash out {tier} tokens for ₦{maxNaira.toLocaleString()}
      </p>
      <p className="text-xs text-slate-300">
        Where should we send it? This spends {tier} tokens immediately — payout follows by bank transfer.
      </p>
      <div>
        <label htmlFor="cashout-bank" className={labelClass}>
          Bank name
        </label>
        <input
          id="cashout-bank"
          type="text"
          required
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className={inputClass}
          placeholder="e.g. GTBank"
        />
      </div>
      <div>
        <label htmlFor="cashout-account-number" className={labelClass}>
          Account number
        </label>
        <input
          id="cashout-account-number"
          type="text"
          inputMode="numeric"
          required
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className={inputClass}
          placeholder="0123456789"
        />
      </div>
      <div>
        <label htmlFor="cashout-account-name" className={labelClass}>
          Account name
        </label>
        <input
          id="cashout-account-name"
          type="text"
          required
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className={inputClass}
          placeholder="Name on the account"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Confirm cash-out"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
