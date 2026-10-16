import { ITEM_CATEGORIES } from "../../lib/itemCategories";

export default function CategoryPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ITEM_CATEGORIES.map((c) => {
        const Icon = c.icon;
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(active ? "" : c.value)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-brand-teal/15 text-brand-teal ring-1 ring-brand-teal/40"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
