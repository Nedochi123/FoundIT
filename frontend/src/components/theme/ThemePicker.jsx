import { useRef } from "react";
import { Ban, Check } from "lucide-react";
import { THEMES, DOODLES, DEFAULT_THEME, DEFAULT_DOODLE, getTheme } from "../../lib/themes";
import { DOODLE_ICON } from "./doodles";
import { useTheme } from "./ThemeProvider";
import { useSchool } from "../school/SchoolProvider";

/**
 * Pick an app color and a style of floating doodles. Controlled: value is { theme, doodle } and onChange gets
 * the new pair. The app itself re-colors as they choose (the parent previews the value), so they see exactly
 * what they are getting. With autoSuggest, choosing a color also picks the doodles that suit it (pink ->
 * kittens, camo -> dogs...) until the student picks doodles themselves.
 */
export default function ThemePicker({ value, onChange, autoSuggest = true }) {
  const { still, setStill } = useTheme();
  const { school } = useSchool();
  // every color, plus this student's school's own colors (another school's are not offered)
  const themes = THEMES.filter((t) => !t.school || t.school === school.id);
  const pickedDoodle = useRef(!autoSuggest);

  function pickTheme(id) {
    const next = { theme: id, doodle: value.doodle };
    if (!pickedDoodle.current) next.doodle = getTheme(id).suggestedDoodle;
    onChange(next);
  }
  function pickDoodle(id) {
    pickedDoodle.current = true;
    onChange({ theme: value.theme, doodle: id });
  }

  const isDefault = value.theme === DEFAULT_THEME && value.doodle === DEFAULT_DOODLE;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p id="look-color-label" className="mb-2 text-sm font-medium text-slate-300">App color</p>
        <div role="radiogroup" aria-labelledby="look-color-label" className="grid grid-cols-4 gap-x-1 gap-y-3 min-[360px]:grid-cols-5">
          {themes.map((t) => {
            const selected = value.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickTheme(t.id)}
                className="group flex flex-col items-center gap-1.5 rounded-xl py-1 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
              >
                <span
                  className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-slate-900 transition ${
                    selected ? "scale-105 ring-brand-teal" : "ring-white/10 group-hover:ring-white/30"
                  }`}
                  style={{ background: t.swatchBg }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full shadow-md shadow-black/30"
                    style={{ background: `linear-gradient(135deg, ${t.brand.a}, ${t.brand.b})` }}
                  >
                    {selected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                  </span>
                </span>
                <span className={`px-0.5 text-center text-[11px] font-semibold leading-tight ${selected ? "text-slate-50" : "text-slate-400"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p id="look-doodle-label" className="mb-2 text-sm font-medium text-slate-300">Floating doodles</p>
        <div role="radiogroup" aria-labelledby="look-doodle-label" className="flex flex-wrap gap-2">
          {DOODLES.map((d) => {
            const selected = value.doodle === d.id;
            const Icon = DOODLE_ICON[d.id] || Ban;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickDoodle(d.id)}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60 ${
                  selected
                    ? "border-brand-teal bg-brand-teal/15 text-slate-50"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25"
                }`}
              >
                <Icon width={18} height={18} /> {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {value.doodle !== DEFAULT_DOODLE && (
        <button
          type="button"
          role="switch"
          aria-checked={still}
          onClick={() => setStill(!still)}
          className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
        >
          <span className="text-sm text-slate-200">
            Keep doodles still
            <span className="block text-xs text-slate-400">Stops the floating, on this device. Doodles also stay still if your phone is set to reduce motion.</span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${still ? "bg-brand-solid" : "bg-slate-700"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${still ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>
      )}

      <p className="text-xs text-slate-400">
        {isDefault
          ? "You're keeping the original FoundIT look. Pick a color to change the whole app."
          : "The whole app now looks like this. For the original look, choose Default and None."}
      </p>
    </div>
  );
}
