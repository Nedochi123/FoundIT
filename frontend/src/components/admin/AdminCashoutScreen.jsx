import { useEffect, useState } from "react";
import { Check, X, Banknote } from "lucide-react";
import { api } from "../../lib/api";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

function formatDate(iso) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminCashoutScreen() {
  const [filter, setFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { requests } = await api.getAdminCashoutRequests(filter);
      setRequests(requests);
    } catch (err) {
      setError(err.message || "Couldn't load cash-out requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleAction(id, status) {
    setActingId(id);
    try {
      await api.updateAdminCashoutRequest(id, status);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message || "That didn't go through. Try again.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-300">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
          <Banknote className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">Nothing here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-50">{r.userName}</p>
                  <p className="truncate text-xs text-slate-400">{r.userEmail}</p>
                  {r.idNumber && <p className="text-xs text-slate-400">ID: {r.idNumber}</p>}
                </div>
                <p className="shrink-0 text-lg font-extrabold text-amber-300">₦{r.amountNaira.toLocaleString()}</p>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-400">Bank</dt>
                <dd className="text-right text-slate-100">{r.bankName}</dd>
                <dt className="text-slate-400">Account number</dt>
                <dd className="text-right font-mono text-slate-100">{r.accountNumber}</dd>
                <dt className="text-slate-400">Account name</dt>
                <dd className="text-right text-slate-100">{r.accountName}</dd>
                <dt className="text-slate-400">Requested</dt>
                <dd className="text-right text-slate-100">{formatDate(r.createdAt)}</dd>
              </dl>

              {r.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAction(r.id, "paid")}
                    disabled={actingId === r.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark paid
                  </button>
                  <button
                    onClick={() => handleAction(r.id, "rejected")}
                    disabled={actingId === r.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Reject &amp; refund
                  </button>
                </div>
              ) : (
                <span
                  className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                    r.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {r.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
