import { useEffect, useState } from "react";
import { Flag, Trash2, UserX, X } from "lucide-react";
import { api, resolvePhotoUrl } from "../../lib/api";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "actioned", label: "Actioned" },
  { key: "dismissed", label: "Dismissed" },
  { key: "", label: "All" },
];

const REASON_LABELS = {
  inappropriate: "Inappropriate content",
  spam: "Spam",
  scam: "Scam or fraud",
  harassment: "Harassment or abuse",
  other: "Other",
};

function formatDate(iso) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminReportsScreen() {
  const [filter, setFilter] = useState("pending");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { reports } = await api.getAdminReports(filter);
      setReports(reports);
    } catch (err) {
      setError(err.message || "Couldn't load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleAction(id, action) {
    setActingId(id);
    try {
      await api.updateAdminReport(id, action);
      setReports((prev) => prev.filter((r) => r.id !== id));
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
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
          <Flag className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">Nothing here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">
                    Reported by {r.reporterName} · {formatDate(r.createdAt)}
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-50">{REASON_LABELS[r.reason] || r.reason}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {r.targetType === "user" ? "User" : "Post"}
                </span>
              </div>

              {r.note && <p className="mt-2 text-sm text-slate-300">"{r.note}"</p>}

              <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/5 bg-slate-800/40 p-2.5">
                {r.target.deleted ? (
                  <p className="text-sm text-slate-400">This {r.targetType === "user" ? "account" : "post"} no longer exists.</p>
                ) : r.targetType === "user" ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-100">{r.target.name}</p>
                    <p className="truncate text-xs text-slate-400">{r.target.email}</p>
                    {r.target.suspended && (
                      <span className="mt-1 inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                        Suspended
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    {r.target.photoUrl && (
                      <img
                        src={resolvePhotoUrl(r.target.photoUrl)}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <p className="min-w-0 truncate text-sm text-slate-100">{r.target.description || "(no description)"}</p>
                  </>
                )}
              </div>

              {r.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAction(r.id, "dismiss")}
                    disabled={actingId === r.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </button>
                  {r.targetType === "user" ? (
                    <button
                      onClick={() => handleAction(r.id, "suspend_user")}
                      disabled={actingId === r.id || r.target.deleted || r.target.suspended}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                    >
                      <UserX className="h-3.5 w-3.5" /> Suspend user
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(r.id, "remove_item")}
                      disabled={actingId === r.id || r.target.deleted}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove post
                    </button>
                  )}
                </div>
              ) : (
                <span
                  className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    r.status === "actioned" ? "bg-red-500/15 text-red-400" : "bg-slate-700 text-slate-300"
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
