import { Siren, ChevronRight } from "lucide-react";

/** Home: the bold "complaints" card. Shows how many replies from the admin are waiting. */
export default function HomeSupportCard({ unread, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group animate-fade-up rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-400/15 to-slate-900/70 p-5 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-amber-300 active:scale-[0.98]"
      style={{ "--delay": "0.2s" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 ring-1 ring-inset ring-amber-400/40">
          <Siren className="h-6 w-6 text-amber-300" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">Complaints</p>
          <p className="mt-0.5 text-base font-extrabold leading-snug text-slate-50">
            In case of any complaint, send a message to the admin. It will be seen and attended to immediately.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-200">
            Please note: we cannot help with stolen items that have no record in FoundIT. We can only help with finding items that have been published
            and not yet returned to their owner.
          </p>
          <span className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 text-sm font-bold text-amber-950">
            Message the admin <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
          {unread > 0 && (
            <p role="status" className="mt-2 text-sm font-bold text-emerald-300">
              {unread === 1 ? "You have 1 new reply from the admin" : `You have ${unread} new replies from the admin`}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
