import { useState } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getSchool } from "../../lib/schools";
import { useSchool } from "./SchoolProvider";
import SchoolMark from "./SchoolMark";

/**
 * The university the signed-in student belongs to. The server decides it (the account's own school, sent with the user
 * as user.school); this device's saved choice is only used for the moment before the server has answered (an older
 * saved user has no school yet). Logo and colors come from lib/schools.js.
 */
export function useUniversity() {
  const { user } = useAuth();
  const { school } = useSchool();
  const fromServer = user?.school;
  return {
    ...(fromServer ? getSchool(fromServer.id) : school),
    ...(fromServer ? { name: fromServer.name, emailDomain: fromServer.emailDomain } : {}),
  };
}

const PRIVACY_SEEN_KEY = "foundit_privacy_seen";

function privacySeen() {
  try {
    return localStorage.getItem(PRIVACY_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Home: whose space this is, and what "private" honestly means here. It must never promise more than the app does:
 * other universities cannot see it, chats are between the two students, accounts are made with the university's email
 * address (not proof of enrolment), and FoundIT's administrators can review reports, activity and chats for safety
 * (Privacy & Terms says exactly what). The full message shows until the student taps "Got it"; after that it folds
 * into one line that opens it again, so Home's main buttons stay near the top.
 */
export function UniversityIdentityCard({ onShowPrivacy }) {
  const university = useUniversity();
  const [open, setOpen] = useState(() => !privacySeen());

  function gotIt() {
    try {
      localStorage.setItem(PRIVACY_SEEN_KEY, "1");
    } catch {
      // Private browsing: it simply shows in full again next time.
    }
    setOpen(false);
  }

  const identity = (
    <>
      <SchoolMark school={university} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-tight text-slate-50">{university.name}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-brand-teal">
          <Lock className="h-3 w-3" aria-hidden="true" /> Private university workspace
        </span>
      </span>
    </>
  );

  return (
    <section
      aria-labelledby="university-space-title"
      className="animate-fade-up overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-lg shadow-black/20 backdrop-blur"
      style={{ "--delay": "0.04s" }}
    >
      {open ? (
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">{identity}</div>
      ) : (
        // folded: the whole row opens the message again
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded="false"
          aria-controls="university-space-details"
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal/60"
        >
          {identity}
          <span className="sr-only">Show what private means here</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      )}
      {open && (
        <div id="university-space-details" className="flex flex-col gap-1.5 px-4 py-3">
          <h2 id="university-space-title" className="text-sm font-bold text-slate-100">
            Your university space is private
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Found items, lost posts and their photos are shown only to people signed in to {university.name}&apos;s
            space, and your chats stay between you and the other student. Students at other universities can&apos;t see
            any of it.
          </p>
          <p className="text-xs leading-relaxed text-slate-400">
            Accounts here are made with {university.emailDomain ? `an @${university.emailDomain}` : "a university"} email
            address. FoundIT&apos;s administrators can review reports, activity and chats to keep everyone safe.
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4">
            <button
              type="button"
              onClick={onShowPrivacy}
              className="-mx-1 flex min-h-11 items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
            >
              How privacy works <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={gotIt}
              className="-mx-1 min-h-11 rounded-lg px-1 text-sm font-semibold text-slate-300 hover:text-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {!open && (
        <h2 id="university-space-title" className="sr-only">
          Your university space is private
        </h2>
      )}
    </section>
  );
}

/** One quiet line on a private screen, saying who can see what is on it. */
export function PrivateSpaceNote({ children }) {
  const university = useUniversity();
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-brand-teal" aria-hidden="true" />
      <span>{children || `Only people signed in to ${university.name}'s space can see this.`}</span>
    </p>
  );
}

/** The university in the top bar, so every screen shows whose space it is. */
export function UniversityChip() {
  const university = useUniversity();
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-0.5 pl-0.5 pr-2.5"
      title={`${university.name}: private university workspace`}
    >
      <SchoolMark school={university} size={20} />
      <span className="truncate text-xs font-semibold text-slate-200">{university.short || university.name}</span>
      <span className="sr-only">, private university workspace</span>
    </span>
  );
}
