import { CAMPUS_LOCATIONS } from "../../lib/itemCategories";

// Sits above the free-text location input as shortcuts, not a
// replacement — tapping one just fills the text field, so someone with
// a more specific spot in mind can still type it themselves.
export default function LocationChips({ onPick }) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {CAMPUS_LOCATIONS.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onPick(loc)}
          className="rounded-full bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800"
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
