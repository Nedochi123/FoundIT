import { useEffect, useRef, useState } from "react";
import { Send, Phone, UserRound, ShieldAlert } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";

const timeOf = (iso) =>
  new Date(iso.replace(" ", "T") + "Z").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function ContactCard({ message, mine, otherName }) {
  const who = mine ? "You shared your contact" : `${otherName[0].toUpperCase()}${otherName.slice(1)} shared their contact`;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-slate-100">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">{who}</p>
      {message.contactName && (
        <p className="mt-1.5 flex items-center gap-1.5 font-semibold">
          <UserRound className="h-4 w-4 text-emerald-300" /> {message.contactName}
        </p>
      )}
      {message.contactPhone &&
        (mine ? (
          <p className="mt-1 flex items-center gap-1.5 font-semibold">
            <Phone className="h-4 w-4 text-emerald-300" /> {message.contactPhone}
          </p>
        ) : (
          <a
            href={`tel:${message.contactPhone.replace(/[^+\d]/g, "")}`}
            className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 font-bold text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
          >
            <Phone className="h-4 w-4" /> {message.contactPhone}
          </a>
        ))}
    </div>
  );
}

/**
 * The private chat between a finder and an owner, used by both sides. Each side sees its own messages on the
 * right. Names and numbers are shared only when someone taps "Share my name or number".
 *
 * mySide: "finder" | "owner". onSend(text) and onShareContact({ name, phone }) return promises and update
 * the parent's messages; if they throw, the error text is shown here.
 */
export default function TagChat({ messages, mySide, onSend, onShareContact, open = true, closedNote = "" }) {
  const otherName = mySide === "finder" ? "the owner" : "the finder";
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareName, setShareName] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const listRef = useRef(null);

  // stay at the newest message
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(message);
      setText("");
    } catch (err) {
      setError(err.message || "Couldn't send that. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleShare(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await onShareContact({ name: shareName.trim() || undefined, phone: sharePhone.trim() || undefined });
      setShareName("");
      setSharePhone("");
      setSharing(false);
    } catch (err) {
      setError(err.message || "Couldn't share that. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={listRef} className="flex max-h-half min-h-24 flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
        {messages.map((m) => {
          const mine = m.sender === mySide;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {m.kind === "contact" ? (
                <div className="w-full max-w-[85%]">
                  <ContactCard message={m} mine={mine} otherName={otherName} />
                </div>
              ) : (
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2 text-sm ${
                    mine ? "bg-brand-btn text-white" : "border border-slate-700 bg-slate-800 text-slate-100"
                  }`}
                >
                  {m.body}
                </div>
              )}
              <span className="mt-0.5 px-1 text-xs text-slate-500">{timeOf(m.createdAt)}</span>
            </div>
          );
        })}
      </div>

      {open ? (
        <>
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              id="chat-input"
              type="text"
              value={text}
              maxLength={500}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              placeholder={`Write to ${otherName}...`}
              aria-label={`Message to ${otherName}`}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-btn text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {sharing ? (
            <form onSubmit={handleShare} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-800 p-3">
              <p className="text-sm font-semibold text-slate-100">Share your name or number</p>
              <p className="text-xs text-slate-400">
                Only {otherName} in this chat will see it. Share only what you're comfortable with. You can fill in just one.
              </p>
              <input id="chat-share-name" type="text" maxLength={60} autoComplete="name" value={shareName} onChange={(e) => setShareName(e.target.value)} placeholder="Your name" aria-label="Your name" className={inputClass} />
              <input id="chat-share-phone" type="tel" inputMode="tel" autoComplete="tel" value={sharePhone} onChange={(e) => setSharePhone(e.target.value)} placeholder="Your phone number" aria-label="Your phone number" className={inputClass} />
              <div className="flex gap-2">
                <button type="submit" disabled={sending || (!shareName.trim() && !sharePhone.trim())} className="rounded-lg bg-brand-btn px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Share
                </button>
                <button type="button" onClick={() => setSharing(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setSharing(true)} className="flex min-h-9 items-center gap-1.5 self-start text-xs font-semibold text-brand-teal underline underline-offset-2 hover:text-cyan-200">
              <UserRound className="h-3.5 w-3.5" /> Share my name or number
            </button>
          )}
        </>
      ) : (
        <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">{closedNote}</p>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        Meet in a public place on campus. Never pay anyone before you have your item back, and never share bank or card details.
      </p>
    </div>
  );
}
