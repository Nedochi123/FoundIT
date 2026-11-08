import { useEffect, useState } from "react";
import { Check, X, Rocket, Landmark } from "lucide-react";
import { api } from "../../lib/api";
import { formatNaira } from "../../lib/rewards";
import { timeAgo } from "../../lib/boosts";
import { ListSkeleton } from "../shared/Skeleton";

const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";
const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/50";
const labelClass = "mb-1 block text-sm font-medium text-slate-300";

const lengthLabel = (hours) => (hours === 24 ? "24 hours" : `${hours / 24} days`);

function RequestCard({ boost, busy, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const claimed = boost.state === "payment_claimed";
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-semibold text-slate-50">{boost.itemDescription}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            claimed ? "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/40" : "bg-slate-700 text-slate-300"
          }`}
        >
          {claimed ? "Says they've paid" : "Hasn't paid yet"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</dt>
          <dd className="font-extrabold text-amber-300">{formatNaira(boost.amount)} <span className="font-normal text-slate-400">· {lengthLabel(boost.hours)}</span></dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reference</dt>
          <dd className="font-mono font-bold tracking-wider text-slate-50">{boost.reference}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Student</dt>
          <dd className="text-slate-100">{boost.requester.name}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{claimed ? "Said paid" : "Started"}</dt>
          <dd className="text-slate-100">{timeAgo(claimed ? boost.paidClaimedAt : boost.createdAt)}</dd>
        </div>
      </dl>
      {boost.payerNote && <p className="mt-2 text-sm text-slate-300">Name on transfer: <span className="font-semibold text-slate-50">{boost.payerNote}</span></p>}
      {boost.itemStatus !== "open" && <p className="mt-2 text-sm text-red-400">This post has been marked found, so it can't be boosted. Reject it.</p>}

      {rejecting ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`reject-${boost.id}`} className={labelClass}>Reason (the student will see it)</label>
          <input id={`reject-${boost.id}`} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. We couldn't find a payment of that amount" className={inputClass} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => onReject(boost.id, reason.trim())} className="min-h-11 flex-1 rounded-lg bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-60">
              Reject boost
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-300 hover:text-slate-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy || boost.itemStatus !== "open"}
            onClick={() => {
              if (window.confirm(`Approve only if ${formatNaira(boost.amount)} with reference ${boost.reference} is in your account. Approve now?`)) onApprove(boost.id);
            }}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

/** Admin: set the bank account boosts are paid into, then approve or reject each payment you've checked. */
export default function AdminBoostsScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);
  const [form, setForm] = useState({ bank: "", accountNumber: "", accountName: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      const d = await api.getAdminBoosts();
      setData(d);
      if (d.settings) setForm(d.settings);
    } catch (err) {
      setError(err.message || "Couldn't load boosts.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id, action) {
    setActingId(id);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message || "That didn't go through. Try again.");
    } finally {
      setActingId(null);
    }
  }

  async function saveDetails(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { settings } = await api.saveBoostPaymentDetails(form);
      setForm(settings);
      setSaved(true);
      await load();
    } catch (err) {
      setError(err.message || "Couldn't save the details.");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return error ? <p className="text-sm text-slate-300">{error}</p> : <ListSkeleton label="Loading boosts..." rows={3} thumb={false} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["This month", formatNaira(data.revenue.thisMonth)],
          ["All time", formatNaira(data.revenue.total)],
          ["Boosts sold", data.revenue.count],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-800/70 py-2.5">
            <p className="text-base font-extrabold text-slate-50">{value}</p>
            <p className="text-[11px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <form onSubmit={saveDetails} className={`${cardClass} flex flex-col gap-3`}>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-50"><Landmark className="h-4 w-4 text-amber-300" /> Where students pay</p>
        {!data.settings && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-inset ring-amber-400/30">
            Boosts are switched off until you add your bank account here. Students are shown these details when they boost a post.
          </p>
        )}
        <div>
          <label htmlFor="boost-bank" className={labelClass}>Bank</label>
          <input id="boost-bank" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="e.g. GTBank" className={inputClass} />
        </div>
        <div>
          <label htmlFor="boost-account-number" className={labelClass}>Account number</label>
          <input id="boost-account-number" inputMode="numeric" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="10 digits" className={`${inputClass} font-mono tracking-wider`} />
        </div>
        <div>
          <label htmlFor="boost-account-name" className={labelClass}>Name on the account</label>
          <input id="boost-account-name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className={inputClass} />
        </div>
        <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 text-sm font-bold text-amber-950 disabled:opacity-60">
          {saving ? "Saving..." : data.settings ? "Save changes" : "Save and switch boosts on"}
        </button>
        {saved && <p role="status" className="text-sm text-emerald-300">Saved.</p>}
      </form>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400"><Rocket className="h-3.5 w-3.5" /> Waiting for you ({data.queue.length})</p>
        {data.queue.length === 0 ? (
          <p className="text-sm text-slate-400">No boosts waiting. You'll get an alert when someone says they've paid.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.queue.map((b) => (
              <RequestCard
                key={b.id}
                boost={b}
                busy={actingId === b.id}
                onApprove={(id) => act(id, () => api.approveBoost(id))}
                onReject={(id, reason) => act(id, () => api.rejectBoost(id, reason))}
              />
            ))}
          </div>
        )}
      </div>

      {data.recent.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Recent</p>
          <div className="flex flex-col gap-2">
            {data.recent.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{b.itemDescription}</p>
                  <p className="text-xs text-slate-400">{b.requester.name} · {formatNaira(b.amount)} · {lengthLabel(b.hours)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    b.state === "live" ? "bg-emerald-500/15 text-emerald-300" : b.state === "ended" ? "bg-slate-700 text-slate-300" : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {b.state === "live" ? "Live" : b.state === "ended" ? "Ended" : "Rejected"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
