import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { SCHOOLS, isOpen } from "../../lib/schools";
import { useSchool } from "../school/SchoolProvider";
import SchoolMark from "../school/SchoolMark";
import SchoolLogoField from "../school/SchoolLogoField";
import Logo from "../theme/Logo";
import AboutFoundIT from "./AboutFoundIT";

/**
 * The first page anyone sees: pick your school. Every school's logo floats softly behind it. A school that
 * is open takes the student to its sign-in; one that is not open yet answers on the spot with a short note
 * (the button stays tappable, so it never feels broken).
 */
export default function Welcome({ onShowLegal }) {
  const { choose } = useSchool();
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

  // Search by name, short name or email ending: part of any of them is enough. An empty search lists every school.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return SCHOOLS;
    return SCHOOLS.filter((s) => [s.name, s.short, s.emailDomain].some((v) => v && v.toLowerCase().includes(q)));
  }, [query]);

  function pick(school) {
    if (isOpen(school)) {
      setNotice("");
      choose(school.id);
    } else {
      setNotice(`${school.name} isn't open on FoundIT yet. It will be announced here when it is.`);
    }
  }

  return (
    <div className="flex min-h-app items-center justify-center px-4 py-10">
      <div className="bg-glow" aria-hidden="true" />
      <SchoolLogoField />
      <main className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-20 w-20 rounded-full opacity-50 blur-2xl"
              style={{ background: "radial-gradient(circle, var(--brand-a) 0%, var(--brand-b) 70%, transparent 100%)" }}
              aria-hidden="true"
            />
            <Logo label="FoundIT" className="relative h-16 w-16 rounded-2xl shadow-xl shadow-black/50 ring-1 ring-white/10" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
            Found<span className="text-brand-teal">IT</span>
          </h1>
          <p className="text-center text-sm text-slate-300">Lost something? Found something? Start with your school.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Choose your school</h2>
          <div className="relative mb-3">
            <label htmlFor="school-search" className="sr-only">
              Search for your university
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="school-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for your university"
              autoComplete="off"
              aria-controls="school-list"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-11 text-base text-slate-50 placeholder:text-slate-400 transition focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/60 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {matches.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-600 px-3 py-4 text-center text-sm text-slate-300">
              No university matches &ldquo;{query.trim()}&rdquo;. FoundIT is coming to more universities soon.
            </p>
          )}
          <ul id="school-list" className="flex flex-col gap-2">
            {matches.map((school) => (
              <li key={school.id}>
                <button
                  type="button"
                  onClick={() => pick(school)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-brand-teal/50 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
                >
                  <SchoolMark school={school} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-slate-50">{school.name}</span>
                    {!isOpen(school) && <span className="text-xs text-slate-400">Opening soon</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p role="status" className="mt-3 min-h-[1.25rem] text-xs text-slate-300">
            {notice}
          </p>
        </div>

        <AboutFoundIT />

        <button type="button" onClick={onShowLegal} className="mt-6 w-full text-center text-xs text-slate-300 underline hover:text-slate-100">
          Privacy &amp; Terms
        </button>
      </main>
    </div>
  );
}
