import { MessageCircle, MapPin, CheckCircle2 } from "lucide-react";
import { resolvePhotoUrl } from "../../lib/api";

export default function ItemCard({ item, currentUserId, onMessage, onResolve, messaging }) {
  const isOwn = item.posterId === currentUserId;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/85 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl">
      <img
        src={resolvePhotoUrl(item.photoUrl)}
        alt={item.description || "Found item"}
        className="h-44 w-full object-cover"
        loading="lazy"
        decoding="async"
      />
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
          onResolve && (
            <button
              onClick={() => onResolve(item.id)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as resolved
            </button>
          )
        ) : (
          <button
            onClick={() => onMessage(item.id)}
            disabled={messaging}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-gradient py-2 text-xs font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Message
          </button>
        )}
      </div>
    </div>
  );
}
