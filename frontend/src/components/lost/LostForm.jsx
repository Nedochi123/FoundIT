import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function LostForm({ onNavigate }) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Only ask for ID number if the user's account doesn't already have
  // one on file — same "ask once, never again" rule as the found-item flow.
  const needsIdNumber = !user?.idNumber;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (needsIdNumber && !idNumber.trim()) {
      setError("Your ID number is required so we know who's reporting this.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createLostItem({
        description,
        location: location || undefined,
        idNumber: needsIdNumber ? idNumber : undefined,
      });
      // Per spec: after reporting a lost item, the user is taken to the
      // gallery of found items to browse and message anyone whose find
      // might be theirs.
      onNavigate("gallery");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => onNavigate("home")}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-slate-50">Report something lost</h1>
        <p className="mt-1 text-sm text-slate-300">
          Describe it well — everyone on FoundIT will be notified, and you'll get to browse everything found so far.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onNavigate("gallery")}
        className="rounded-2xl border border-dashed border-slate-600 p-4 text-center text-sm font-semibold text-slate-300 transition hover:border-brand-teal hover:text-brand-teal active:scale-[0.98]"
      >
        Browse everything found so far →
      </button>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="lost-description" className={labelClass}>
            What did you lose?
          </label>
          <textarea
            id="lost-description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="e.g. A black backpack with a laptop inside, has a keychain on the zipper"
          />
        </div>
        <div>
          <label htmlFor="lost-location" className={labelClass}>
            Where did you last have it? <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="lost-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
            placeholder="e.g. Faculty of Engineering, Room 204"
          />
        </div>

        {needsIdNumber && (
          <div>
            <label htmlFor="lost-idnumber" className={labelClass}>
              Your ID number
            </label>
            <input
              id="lost-idnumber"
              type="text"
              inputMode="numeric"
              maxLength={9}
              required
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              className={inputClass}
              placeholder="252120246"
              pattern="\d{9}"
              title="Format: 9 digits, e.g. 252120246"
            />
            <p className="mt-1 text-xs text-slate-400">
              Format: 9 digits, e.g. 252120246. We'll remember this — you won't be asked again.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full rounded-lg bg-gradient-to-r from-red-600 to-rose-600 py-3 font-semibold text-white shadow-lg shadow-red-950/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Searching..." : "Search"}
        </button>
      </form>
    </div>
  );
}
