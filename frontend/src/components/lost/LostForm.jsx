import { useState } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import CategoryPicker from "../shared/CategoryPicker";
import LocationChips from "../shared/LocationChips";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function LostForm({ onNavigate }) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
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
        category: category || undefined,
        idNumber: needsIdNumber ? idNumber : undefined,
      });
      // Per spec: after reporting a lost item, the user is taken to the
      // gallery of found items to browse and message anyone whose find
      // might be theirs.
      try {
        sessionStorage.setItem("foundit_just_posted_lost", "1"); // lets the gallery offer a boost, once
      } catch {
        // Private browsing: the offer is just skipped.
      }
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
        onClick={() => onNavigate("urgent")}
        className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-left transition hover:border-red-400/70 active:scale-[0.98]"
      >
        <TriangleAlert className="h-6 w-6 shrink-0 text-red-400" aria-hidden="true" />
        <span className="text-sm text-slate-200">
          <span className="font-bold text-slate-50">Can't do without it?</span> Make it urgent: offer a reward and alert everyone.
        </span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate("gallery")}
        className="rounded-xl border border-dashed border-slate-600 p-4 text-center text-sm font-semibold text-slate-300 transition hover:border-brand-teal hover:text-brand-teal active:scale-[0.98]"
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
          <label className={labelClass}>
            What kind of item? <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div>
          <label htmlFor="lost-location" className={labelClass}>
            Where did you last have it? <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <LocationChips onPick={setLocation} />
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
              placeholder="123456789"
              pattern="\d{9}"
              title="Format: 9 digits, e.g. 123456789"
            />
            <p className="mt-1 text-xs text-slate-400">
              Format: 9 digits, e.g. 123456789. We'll remember this — you won't be asked again.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full rounded-lg bg-red-600 py-3 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Searching..." : "Search"}
        </button>
      </form>
    </div>
  );
}
