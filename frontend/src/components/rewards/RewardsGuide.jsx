import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, X, ShieldCheck, CircleHelp, Sparkles } from "lucide-react";
import { REWARD_AMOUNTS, formatNaira } from "../../lib/rewards";

// Plain, short steps for each side of a return. Update with any change to how rewards work.
const TABS = [
  {
    id: "lost",
    label: "I lost something",
    steps: [
      ["Get your item back", "Meet the person who found it and check that it is really yours."],
      ["Tap Confirm in the chat", "The finder earns 2 tokens. This is also when you can choose a thank-you reward."],
      ["Pick a reward (optional)", `Choose ${REWARD_AMOUNTS.map(formatNaira).join(", ")}, or no reward at all.`],
      ["Pay them yourself", "They send you their account details in the chat. You send the money, then tap \"I've sent it\"."],
    ],
  },
  {
    id: "found",
    label: "I found something",
    steps: [
      ["Post it with a photo", "Wait for the owner to message you. Ask a question only the real owner could answer."],
      ["Hand it back", "When the owner taps Confirm, you earn 2 tokens."],
      ["See your reward", "If the owner chose one, a gift card appears in the chat. Rewards are a bonus, so never ask for one."],
      ["Share your account, only in the chat", "The owner pays you directly. When the money arrives, tap \"I received it\"."],
    ],
  },
];

const SAFETY = [
  "Rewards are a voluntary thank-you, never a requirement. Never ask for money before you return an item.",
  "Never pay anyone before you have your item back.",
  "FoundIT does not handle this money, so it cannot refund or reverse it. You pay each other directly.",
  "Only share your account number in the chat with that one person. Never share a PIN, OTP, BVN or card details. FoundIT will never ask for them.",
  "If someone pressures you or asks for money first, use the Report button in the chat.",
];

/** The "How thank-you rewards work" guide, as a sheet over the screen. */
export default function RewardsGuide({ open, onClose, startTab = "lost" }) {
  const [tab, setTab] = useState(startTab);

  // Start on the right tab each time it opens (not on every refresh of the screen behind it).
  useEffect(() => {
    if (open) setTab(startTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes, and the page behind doesn't scroll while the guide is open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const current = TABS.find((t) => t.id === tab) || TABS[0];

  // Rendered at the top level of the page: a card with an entrance animation would otherwise trap
  // and clip a full-screen sheet drawn inside it.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewards-guide-title"
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/25 to-amber-400/5 ring-1 ring-inset ring-amber-400/30">
              <Gift className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h2 id="rewards-guide-title" className="text-lg font-extrabold text-slate-50">
                How thank-you rewards work
              </h2>
              <p className="text-xs text-slate-400">A voluntary way to say thanks, paid directly between students.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-800/70 p-1" role="tablist" aria-label="Choose your situation">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              onClick={() => setTab(t.id)}
              className={`min-h-10 rounded-lg px-2 text-sm font-semibold transition ${
                t.id === tab ? "bg-amber-400 text-amber-950" : "text-slate-300 hover:text-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ol className="mt-4 flex flex-col gap-3" role="tabpanel">
          {current.steps.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-sm font-bold text-amber-300 ring-1 ring-inset ring-amber-400/30">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-50">{title}</p>
                <p className="text-sm text-slate-300">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-800/50 p-3 text-xs text-slate-300">
          <p className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Good to know
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Only the person who got their item back can give a reward, and only after they confirm the return.</li>
            <li>One reward per item. The amounts are fixed: {REWARD_AMOUNTS.map(formatNaira).join(", ")}.</li>
            <li>Tokens still work as before, with or without a reward.</li>
          </ul>
        </div>

        <div className="mt-3 rounded-xl border border-red-400/25 bg-red-500/[0.07] p-3 text-xs text-slate-200">
          <p className="flex items-center gap-1.5 font-semibold text-red-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Stay safe
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {SAFETY.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-11 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 text-sm font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
}

/** A small link-style button that opens the guide, for use anywhere. */
export function RewardsGuideLink({ children = "How rewards work", className = "", startTab }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200"
        }
      >
        <CircleHelp className="h-3.5 w-3.5" /> {children}
      </button>
      <RewardsGuide open={open} onClose={() => setOpen(false)} startTab={startTab} />
    </>
  );
}

const INTRO_KEY = "foundit_rewards_intro_v1";

/** The "New: thank-you rewards" card on the home screen. Dismissible; the guide stays reachable elsewhere. */
export function RewardsIntroCard() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(INTRO_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);
  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private browsing: it just shows again next visit */
    }
    setHidden(true);
  }

  return (
    <div className="relative animate-fade-up rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-4" style={{ "--delay": "0.2s" }}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-7">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 ring-1 ring-inset ring-amber-400/30">
          <Gift className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">New</p>
          <p className="font-bold text-slate-50">Say thank you with a reward</p>
          <p className="text-sm text-slate-300">
            Got your item back? You can now thank the finder with {formatNaira(REWARD_AMOUNTS[0])} to{" "}
            {formatNaira(REWARD_AMOUNTS[REWARD_AMOUNTS.length - 1])}. It's optional and paid directly.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2.5 min-h-10 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-3.5 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-95"
          >
            See how it works
          </button>
        </div>
      </div>
      <RewardsGuide open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
