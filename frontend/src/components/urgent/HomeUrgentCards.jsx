import { TriangleAlert, MapPin, ChevronRight } from "lucide-react";
import { formatNaira } from "../../lib/rewards";

/**
 * Home: every open "Urgently need" alert, at the very top so nobody misses it. Someone else's alert says
 * what they need and the reward; your own says it is live. Shows at most three.
 */
export default function HomeUrgentCards({ items, currentUserId, onFound, onSeeAll }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="animate-fade-up" style={{ "--delay": "0.04s" }}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <TriangleAlert className="h-4 w-4 text-red-400" aria-hidden="true" />
        <p className="text-xs font-extrabold uppercase tracking-wider text-red-400">Urgent alert</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.slice(0, 3).map((item) => {
          const own = item.posterId === currentUserId;
          return (
            <div key={item.id} role="alert" className="rounded-2xl border border-red-500/50 bg-gradient-to-br from-red-500/15 to-transparent p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-3 min-w-0 whitespace-pre-wrap break-words text-sm font-bold text-slate-50">{item.description}</p>
                <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-amber-950">
                  {formatNaira(item.urgent.reward)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
                {item.location && (
                  <>
                    <MapPin className="h-3 w-3" /> {item.location} ·{" "}
                  </>
                )}
                {own ? "Your alert is live. Everyone has been told." : `${item.posterName} urgently needs this and is offering a reward`}
              </div>
              {!own && (
                <button
                  type="button"
                  onClick={onFound}
                  className="mt-2.5 min-h-11 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-red-950/40 transition hover:brightness-110 active:scale-95"
                >
                  I found this
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onSeeAll} className="mt-2 flex min-h-11 items-center gap-1 text-xs font-semibold text-red-300 underline-offset-2 hover:underline">
        See the Lost board <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
