import { useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { api } from "../../lib/api";

const REASONS = [
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam or fraud" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "other", label: "Other" },
];

// Reusable across a gallery item card and a conversation — both just
// need to say what's being reported (targetType/targetId) and how to
// close the dialog when done.
export default function ReportDialog({ targetType, targetId, onClose }) {
  const [reason, setReason] = useState("inappropriate");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await api.createReport({ targetType, targetId, reason, note: note || undefined });
      setStatus("sent");
    } catch (err) {
      setError(err.message || "Couldn't send the report.");
      setStatus("idle");
    }
  }

  // Rendered via a portal straight into <body> rather than in place --
  // this can be triggered from inside an ItemCard, which has a
  // hover:-translate-y-0.5 transform utility. Tailwind always emits a
  // transform declaration for that class (even at rest, via CSS
  // variables), and any ancestor with a non-none transform becomes the
  // containing block for position:fixed descendants, which would
  // otherwise clip this dialog to the card instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-950/95 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-6">
        {status === "sent" ? (
          <div className="text-center">
            <Flag className="mx-auto h-8 w-8 text-emerald-400" />
            <h2 className="mt-3 text-lg font-bold text-slate-50">Report sent</h2>
            <p className="mt-1 text-sm text-slate-300">Thanks — an admin will take a look.</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-brand-btn py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-100">
              <Flag className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Report {targetType === "user" ? "this user" : "this post"}</h2>
            </div>

            <div>
              <label htmlFor="report-reason" className="mb-1 block text-sm font-medium text-slate-300">
                Reason
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-note" className="mb-1 block text-sm font-medium text-slate-300">
                Details (optional)
              </label>
              <textarea
                id="report-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal"
                placeholder="Anything that would help an admin review this"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "sending"}
                className="flex-1 rounded-lg bg-brand-btn py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {status === "sending" ? "Sending..." : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
