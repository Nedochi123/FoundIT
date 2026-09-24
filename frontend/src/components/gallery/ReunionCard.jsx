import { Sparkles } from "lucide-react";
import { resolvePhotoUrl } from "../../lib/api";
import { getCategoryIcon } from "../../lib/itemCategories";

// Read-only — a reunited item has no message/report actions, since
// there's nothing left to do with it. Kept as its own component
// instead of an ItemCard variant since the action row genuinely
// doesn't apply here.
export default function ReunionCard({ item }) {
  const CategoryIcon = item.category ? getCategoryIcon(item.category) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/85 shadow-lg shadow-black/20">
      <div className="relative">
        <img
          src={resolvePhotoUrl(item.photoUrl)}
          alt={item.description || "Reunited item"}
          className="h-32 w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {CategoryIcon && (
          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/70 text-slate-100 backdrop-blur">
            <CategoryIcon className="h-3 w-3" />
          </span>
        )}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-emerald-950">
          <Sparkles className="h-3 w-3" /> Reunited
        </span>
      </div>
      <div className="p-2.5">
        {item.description && <p className="line-clamp-2 text-xs text-slate-200">{item.description}</p>}
      </div>
    </div>
  );
}
