import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Rocket, X, Copy, Check, ShieldAlert, Loader2, Clock, PartyPopper } from "lucide-react";
import { api } from "../../lib/api";
import { formatNaira } from "../../lib/rewards";
import { formatWhen, timeLeft } from "../../lib/boosts";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";

function CopyRow({ label, value, copied, onCopy, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`break-words font-bold text-slate-50 ${mono ? "font-mono tracking-wider" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-brand-teal hover:bg-white/5"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * Boost a lost post, as a sheet over the screen. The student picks how long, sees the bank details and a
 * reference to put on the transfer, then taps "I've paid"; the admin checks the payment and approves it.
 * item is a lost post (with item.boost if it already has one); onChanged() tells the page behind to refresh.
 */
export default function BoostSheet({ item, onClose, onChanged }) {
  const [plans, setPlans] = useState(null);
  const [boost, setBoost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("3d");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const [{ plans }, existing] = await Promise.all([api.getBoostPlans(), item.boost?.id ? api.getBoost(item.boost.id) : null]);
      setPlans(plans);
      if (existing) setBoost(existing.boost);
    } catch (err) {
      setError(err.message || "Couldn't load boosts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [item.boost?.id]);
  useEffect(() => {
    load();
  }, [load]);

  // Escape closes, and the page behind doesn't scroll while the sheet is open.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged?.();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(key, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800);
    } catch {
      // Copying isn't available here: the details are on screen to read out or type.
    }
  }

  const state = boost?.state;
  const chosen = plans?.find((p) => p.id === plan);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boost-title"
        className="relative grid max-h-[92vh] w-full max-w-md content-start gap-4 overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-900 p-5 sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/25 ring-1 ring-inset ring-amber-400/30">
              <Rocket className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h2 id="boost-title" className="text-lg font-extrabold text-slate-50">Boost your post</h2>
              <p className="text-xs text-slate-400">Get it seen by everyone on campus.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="line-clamp-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200">{item.description}</p>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
        ) : !boost ? (
          <>
            <ul className="flex flex-col gap-1.5 text-sm text-slate-300">
              <li>• Your post sits at the top of the Lost board and on everyone's Home screen.</li>
              <li>• One alert goes to everyone on campus when it goes live.</li>
              <li>• It ends by itself, or as soon as you mark the item found.</li>
            </ul>
            <div role="radiogroup" aria-label="How long" className="grid gap-2">
              {(plans || []).map((p) => {
                const selected = p.id === plan;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlan(p.id)}
                    className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition active:scale-[0.99] ${
                      selected ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <span className="font-bold text-slate-50">{p.label}</span>
                    <span className="text-lg font-extrabold text-amber-300">{formatNaira(p.amount)}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={busy || !chosen}
              onClick={() =>
                run(async () => {
                  const { boost: created } = await api.createBoost(item.id, plan);
                  setBoost(created);
                })
              }
              className="min-h-12 rounded-xl bg-amber-400 px-4 text-sm font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "One moment..." : chosen ? `Continue to pay ${formatNaira(chosen.amount)}` : "Continue"}
            </button>
          </>
        ) : state === "awaiting_payment" ? (
          <>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Send exactly</p>
              <p className="text-4xl font-extrabold text-amber-300">{formatNaira(boost.amount)}</p>
              <p className="text-xs text-slate-400">for {boost.hours === 24 ? "24 hours" : `${boost.hours / 24} days`} of boost</p>
            </div>
            {boost.paymentDetails ? (
              <div className="flex flex-col gap-2">
                <CopyRow label="Bank" value={boost.paymentDetails.bank} copied={copied === "bank"} onCopy={() => copy("bank", boost.paymentDetails.bank)} />
                <CopyRow label="Account number" value={boost.paymentDetails.accountNumber} mono copied={copied === "acct"} onCopy={() => copy("acct", boost.paymentDetails.accountNumber)} />
                <CopyRow label="Account name" value={boost.paymentDetails.accountName} copied={copied === "name"} onCopy={() => copy("name", boost.paymentDetails.accountName)} />
                <CopyRow label="Put this in the transfer description" value={boost.reference} mono copied={copied === "ref"} onCopy={() => copy("ref", boost.reference)} />
              </div>
            ) : (
              <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">The payment details aren't available right now. Please try again shortly.</p>
            )}
            <div>
              <label htmlFor="boost-note" className="mb-1 block text-sm font-medium text-slate-300">
                Your name on the transfer <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input id="boost-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="So we can find your payment faster" className={inputClass} />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(async () => setBoost((await api.claimBoostPaid(boost.id, note.trim())).boost))}
              className="min-h-12 rounded-xl bg-brand-btn px-4 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "One moment..." : "I've paid"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.cancelBoost(boost.id);
                  onClose();
                })
              }
              className="min-h-11 text-sm font-medium text-slate-400 underline underline-offset-2 hover:text-slate-200 disabled:opacity-60"
            >
              Cancel this boost
            </button>
            <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
              <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              Only pay into the account shown here. FoundIT never asks for your PIN, OTP or card details. Once a boost is live it can't be refunded.
            </p>
          </>
        ) : state === "payment_claimed" ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <Clock className="h-9 w-9 text-amber-300" />
            <p className="text-lg font-extrabold text-slate-50">Thanks. We are checking your payment</p>
            <p className="text-sm text-slate-300">
              As soon as it's confirmed, your post goes to the top and everyone on campus gets an alert. You'll get a notification too.
            </p>
            <p className="font-mono text-xs tracking-wider text-slate-400">Reference {boost.reference}</p>
            <button type="button" onClick={onClose} className="mt-2 min-h-11 rounded-xl bg-white/10 px-5 text-sm font-bold text-slate-50 hover:bg-white/15">Close</button>
          </div>
        ) : state === "live" ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <PartyPopper className="h-9 w-9 text-amber-300" />
            <p className="text-lg font-extrabold text-slate-50">Your post is boosted</p>
            <p className="text-sm text-slate-300">It's at the top until {formatWhen(boost.expiresAt)} ({timeLeft(boost.expiresAt)}).</p>
            <button type="button" onClick={onClose} className="mt-2 min-h-11 rounded-xl bg-white/10 px-5 text-sm font-bold text-slate-50 hover:bg-white/15">Close</button>
          </div>
        ) : (
          <p className="text-sm text-slate-300">This boost can't be changed any more.</p>
        )}

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>
    </div>,
    document.body
  );
}
