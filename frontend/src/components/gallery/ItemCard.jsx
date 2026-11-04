import { useState } from "react";
import { MessageCircle, MapPin, CheckCircle2, Flag, Pencil, Trash2 } from "lucide-react";
import { resolvePhotoUrl } from "../../lib/api";
import { getCategoryIcon } from "../../lib/itemCategories";
import ReportDialog from "../shared/ReportDialog";

export default function ItemCard({ item, currentUserId, onMessage, onResolve, messaging, onEdit, onDelete, deleting }) {
  const isOwn = item.posterId === currentUserId;
  const [reporting, setReporting] = useState(false);
  const CategoryIcon = item.category ? getCategoryIcon(item.category) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/85 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl">
      <div className="relative">
        <img
          src={resolvePhotoUrl(item.photoUrl)}
          alt={item.description || "Found item"}
          className="h-44 w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {CategoryIcon && (
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/70 text-slate-100 backdrop-blur">
            <CategoryIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="p-3">
        {item.description && <p className="text-sm text-slate-100 line-clamp-2">{item.description}</p>}
        <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
          {item.location && (
            <>
              <MapPin className="h-3 w-3" /> {item.location} ·{" "}
            </>
          )}
          Found by {item.posterName}
        </div>

        {isOwn ? (
          <div className="mt-3 flex flex-col gap-1.5">
            {onResolve && (
              <button
                onClick={() => onResolve(item.id)}
                className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark as resolved
              </button>
            )}
            {onEdit && onDelete && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => onEdit(item)}
                  aria-label="Edit this post"
                  className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-600 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </button>
                <button
                  onClick={() => onDelete(item)}
                  disabled={deleting}
                  aria-label="Delete this post"
                  className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-red-500/40 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {deleting ? "..." : "Delete"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 flex gap-1.5">
            <button
              onClick={() => onMessage(item.id)}
              disabled={messaging}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient py-2 text-xs font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Message
            </button>
            <button
              onClick={() => setReporting(true)}
              title="Report this post"
              className="flex items-center justify-center rounded-lg border border-slate-700 px-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-red-400"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {reporting && (
        <ReportDialog targetType="found_item" targetId={item.id} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}
