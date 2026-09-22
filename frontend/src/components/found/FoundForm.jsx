import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import CameraCapture from "./CameraCapture";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

export default function FoundForm({ onNavigate }) {
  const { user } = useAuth();
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Only ask for ID number if the user's account doesn't already have
  // one on file — never re-ask something already captured once.
  const needsIdNumber = !user?.idNumber;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!photo) {
      setError("Take a photo of the item first.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("photo", photo, "photo.jpg");
      if (description) formData.append("description", description);
      if (location) formData.append("location", location);
      if (needsIdNumber && idNumber) formData.append("idNumber", idNumber);

      await api.createFoundItem(formData);
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
        <h1 className="text-xl font-bold text-slate-50">Report something found</h1>
        <p className="mt-1 text-sm text-slate-300">
          Snap a photo — everyone on FoundIT will be notified, and it'll be added to the shared gallery.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <CameraCapture onCapture={setPhoto} />

        <div>
          <label htmlFor="found-description" className={labelClass}>
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="found-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Anything that might help the owner recognize it"
          />
        </div>
        <div>
          <label htmlFor="found-location" className={labelClass}>
            Where did you find it? <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="found-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
            placeholder="e.g. Cafeteria, near the entrance"
          />
        </div>

        {needsIdNumber && (
          <div>
            <label htmlFor="found-idnumber" className={labelClass}>
              Your ID number
            </label>
            <input
              id="found-idnumber"
              type="text"
              inputMode="numeric"
              maxLength={9}
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
          className="mt-1 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-3 font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Posting..." : "Post to Gallery"}
        </button>
      </form>
    </div>
  );
}
