import { useEffect, useState } from "react";
import { PackageCheck, CircleCheck, TriangleAlert, Loader2 } from "lucide-react";
import { api } from "../../lib/api";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const card = "rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/20 backdrop-blur";

function Shell({ children }) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="bg-glow" aria-hidden="true" />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <img src="/brand/foundit-icon.png" alt="" className="h-8 w-8 rounded-[9px] shadow-md shadow-black/40" />
          <span className="text-lg font-extrabold tracking-tight text-slate-50">
            Found<span className="text-brand-teal">IT</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The page a finder lands on after scanning a "Return me" tag. No account needed: they leave a phone
 * number and a message, and only the owner ever sees it. Nothing about the owner is shown here.
 */
export default function TagScan({ code }) {
  const [info, setInfo] = useState(null); // { status, label }
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState(""); // hidden field: only bots fill it in
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getPublicTag(code)
      .then((data) => alive && setInfo(data))
      .catch((err) => {
        if (!alive) return;
        if (err.status === 404) setInfo({ status: "unknown" });
        else setLoadError("We couldn't load this tag. Please check your connection and try again.");
      });
    return () => {
      alive = false;
    };
  }, [code]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api.sendTagMessage(code, { name: name.trim() || undefined, phone: phone.trim(), message: message.trim() || undefined, website: trap || undefined });
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className={card}>
          <p className="text-sm text-slate-200">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-white">
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!info) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      </Shell>
    );
  }

  if (info.status === "unclaimed") {
    return (
      <Shell>
        <div className={card}>
          <h1 className="text-lg font-extrabold text-slate-50">This FoundIT tag isn't activated yet</h1>
          <p className="mt-2 text-sm text-slate-300">
            If this is your tag, sign in to FoundIT and activate it. Then anyone who finds your things can reach you without seeing your details.
          </p>
          <a
            href={`/?claim=${encodeURIComponent(code)}`}
            className="mt-4 inline-block rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-blue/20"
          >
            Activate this tag
          </a>
        </div>
      </Shell>
    );
  }

  if (info.status !== "active") {
    const unknown = info.status === "unknown";
    return (
      <Shell>
        <div className={card}>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-50">
            <TriangleAlert className="h-5 w-5 text-amber-400" />
            {unknown ? "We don't recognise this tag" : "This tag isn't taking messages right now"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {unknown
              ? "The code may be damaged or mistyped."
              : "The owner has paused it or no longer uses it."}{" "}
            If you found something that isn't yours, please hand it in to campus security.
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className={card}>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-50">
            <CircleCheck className="h-5 w-5 text-emerald-400" /> Thank you!
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            The owner has been told and will contact you on {phone}. Please keep the item safe until they get in touch.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            You never need to pay anything or give out bank details to return an item.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={card}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30">
            <PackageCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-slate-50">You found something that belongs to someone!</h1>
            {info.label && <p className="mt-1 text-sm text-slate-300">Item: <span className="font-semibold text-slate-100">{info.label}</span></p>}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Leave your phone number and the owner will contact you to get it back. No account needed.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="tag-phone" className={labelClass}>Your phone number</label>
            <input id="tag-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" className={inputClass} />
          </div>
          <div>
            <label htmlFor="tag-name" className={labelClass}>Your name <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="tag-name" type="text" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="tag-message" className={labelClass}>Message <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="tag-message" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Where did you find it? Where can you meet them?" className={inputClass} />
          </div>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={sending || !phone.trim()} className="rounded-lg bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 disabled:opacity-50">
            {sending ? "Sending..." : "Tell the owner"}
          </button>
          <p className="text-xs text-slate-400">
            Your number is shared only with the owner, so they can reach you. The owner's details stay private.
          </p>
        </form>
      </div>
    </Shell>
  );
}
