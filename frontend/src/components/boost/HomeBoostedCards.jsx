import { Rocket, MapPin, ChevronRight } from "lucide-react";

/**
 * Home: lost posts someone has boosted, so they get seen by everyone who opens the app. Shows at most two,
 * never the student's own, with a link to the whole Lost board.
 */
export default function HomeBoostedCards({ items, onFound, onSeeAll }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="animate-fade-up" style={{ "--delay": "0.2s" }}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Rocket className="h-3.5 w-3.5 text-amber-300" />
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Help find</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-amber-400/40 bg-slate-900 p-3.5">
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm font-semibold text-slate-50">{item.description}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              {item.location && (
                <>
                  <MapPin className="h-3 w-3" /> {item.location} ·{" "}
                </>
              )}
              {item.posterName} is looking for this
            </div>
            <button
              type="button"
              onClick={onFound}
              className="mt-2.5 min-h-11 rounded-lg bg-brand-btn px-4 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
            >
              I found this
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onSeeAll}
        className="mt-2 flex min-h-11 items-center gap-1 text-xs font-semibold text-brand-teal underline-offset-2 hover:underline"
      >
        See all lost posts <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
