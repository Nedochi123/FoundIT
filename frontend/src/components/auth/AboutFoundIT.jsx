import { ArrowUp, BellRing, Camera, Coins, Lock, MessageCircle, QrCode, TriangleAlert } from "lucide-react";
import { SCHOOLS, isOpen } from "../../lib/schools";

// Every open school by name ("A, B and C"), from the one school list.
function openSchoolNames() {
  const names = SCHOOLS.filter(isOpen).map((s) => s.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "";
}

// The three steps of a return, in the order they happen.
const STEPS = [
  {
    Icon: BellRing,
    title: "Lost something? Report it",
    text: "Describe it and where you last had it. Everyone at your university who has alerts on is told straight away.",
  },
  {
    Icon: Camera,
    title: "Found something? Post a photo",
    text: "It goes into Items found, so the owner can recognise it. You don't have to carry it around looking for them.",
  },
  {
    Icon: MessageCircle,
    title: "Chat, meet, return it",
    text: "The owner messages the finder in a private chat. Once the owner confirms the return, the finder earns tokens.",
  },
];

const EXTRAS = [
  { Icon: QrCode, text: 'QR "Return me" tags for your laptop, bag or keys: whoever finds it can message you without seeing your name or number.' },
  { Icon: TriangleAlert, text: "Urgently need something back? Offer a reward and alert everyone at your university." },
  { Icon: Coins, text: "Finders earn tokens for every confirmed return." },
];

/**
 * The Welcome page's second half: what FoundIT is and how it works, in plain words, for a student who has never heard
 * of it, and for search engines, which read this page as rendered (the text in index.html is replaced when the app
 * starts). Everything here must be true of the app today (frontend/test/crawlable.test.mjs).
 */
export default function AboutFoundIT() {
  function chooseSchool() {
    const box = document.getElementById("school-search");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    box?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    box?.focus({ preventScroll: true });
  }

  return (
    // the same solid panel as the school list: the floating logos behind the page must never cross the text
    <section
      aria-labelledby="about-foundit"
      className="mt-6 flex flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/85 p-5 text-slate-300 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div className="flex flex-col gap-2">
        <h2 id="about-foundit" className="text-xl font-extrabold tracking-tight text-slate-50 [text-wrap:balance]">
          Lost something on campus? FoundIT helps you get it back
        </h2>
        <p className="text-sm leading-relaxed">
          FoundIT is a free lost-and-found app for students, lecturers and staff at {openSchoolNames()}. Report what you
          lost, post what you found, and the two of you are connected in a private chat.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">How it works</h3>
        <ol className="flex flex-col gap-3">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="flex gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 ring-1 ring-inset ring-brand-teal/25">
                <Icon className="h-5 w-5 text-brand-teal" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-200 ring-1 ring-white/10">
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-100">{title}</span>
                <span className="block text-sm leading-relaxed">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Also on FoundIT</h3>
        <ul className="flex flex-col gap-2.5">
          {EXTRAS.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-white/10 pt-5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
          <Lock className="h-4 w-4 text-brand-teal" aria-hidden="true" /> Each university has its own private space
        </h3>
        <p className="text-sm leading-relaxed">
          You join with your university email address, and students at other universities can&apos;t see your posts,
          photos or chats. FoundIT&apos;s administrators can review chats to keep everyone safe, and the app asks for
          your phone&apos;s location while you use it, for security. Free to use; built by Nedochi Publications, not an
          official university service.
        </p>
      </div>

      <button
        type="button"
        onClick={chooseSchool}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" /> Choose your school to get started
      </button>
    </section>
  );
}
