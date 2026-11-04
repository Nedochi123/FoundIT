import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { api } from "../../lib/api";
import { ITEM_CATEGORIES } from "../../lib/itemCategories";

/**
 * Editing your own lost or found post: description, place and category (a found item's photo stays as it is).
 * `kind` is "lost" or "found". The server checks again that the post is yours and the details are valid.
 * Rendered in a portal for the same reason as ReportDialog: a card's hover transform would otherwise clip it.
 */
export default function EditPostDialog({ kind, item, onClose, onSaved }) {
  const [description, setDescription] = useState(item.description || "");
  const [location, setLocation] = useState(item.location || "");
  const [category, setCategory] = useState(item.category || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (kind === "lost" && !description.trim()) {
      setError("Describe what you lost.");
      return;
    }
    setSaving(true);
    setError("");
    const body = { description: description.trim(), location: location.trim(), category: category || null };
    try {
      const { item: saved } = kind === "lost" ? await api.updateLostItem(item.id, body) : await api.updateFoundItem(item.id, body);
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Couldn't save your changes. Please try again.");
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";

  return createPortal(
    <div className="fixed inset-0 z-50 flex min-h-app items-center justify-center bg-slate-950/95 px-4 py-10 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-post-title">
      <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 text-slate-100">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <h2 id="edit-post-title" className="text-sm font-semibold">
            Edit your {kind === "lost" ? "lost" : "found"} post
          </h2>
        </div>

        <div>
          <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-slate-300">
            Description{kind === "lost" ? "" : " (optional)"}
          </label>
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className={`${field} resize-none`}
            aria-invalid={Boolean(error) && !description.trim()}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="edit-location" className="mb-1 block text-sm font-medium text-slate-300">
            Where (optional)
          </label>
          <input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className={field} />
        </div>

        <div>
          <label htmlFor="edit-category" className="mb-1 block text-sm font-medium text-slate-300">
            Category (optional)
          </label>
          <select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            <option value="">No category</option>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 flex-1 rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
