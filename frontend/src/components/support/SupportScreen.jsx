import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Siren } from "lucide-react";
import { api } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";

const MAX = 1000;

function formatTime(iso) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** The student's private conversation with the admin: complaints and problems go here. */
export default function SupportScreen({ onNavigate }) {
  const [messages, setMessages] = useState(null); // null while loading
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const count = useRef(0);

  async function load() {
    try {
      const data = await api.getSupportMessages();
      setMessages(data.messages);
    } catch (err) {
      setMessages((prev) => prev || []);
      setError(err.message || "Couldn't load your messages.");
    }
  }
  usePolling(load, 8000, []);

  // scroll to the newest message when one arrives
  useEffect(() => {
    if (messages && messages.length !== count.current) {
      count.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      const { message } = await api.sendSupportMessage(body);
      setMessages((prev) => [...(prev || []), message]);
      setDraft("");
    } catch (err) {
      setError(err.message || "Your message didn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => onNavigate("home")} className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-xl border border-amber-400/50 bg-slate-900 p-4">
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-50">
          <Siren className="h-6 w-6 text-amber-300" aria-hidden="true" /> Message the admin
        </h1>
        <p className="mt-2 text-base font-extrabold text-amber-200">
          In case of any complaint, send a message to the admin. It will be seen and attended to immediately.
        </p>
        <p className="mt-3 rounded-lg border border-amber-400/40 bg-slate-900 p-2.5 text-sm font-bold text-slate-50">
          Please note: we cannot help with stolen items that have no record in FoundIT. We can only help with finding items that have been published
          and not yet returned to their owner.
        </p>
        <p className="mt-2 text-xs text-slate-300">Only the admin reads this. Replies appear here, and you'll get a notification if you've turned notifications on.</p>
      </div>

      <div className="flex min-h-40 flex-col gap-2" aria-live="polite">
        {messages === null && <p className="text-sm text-slate-300">Loading...</p>}
        {messages && messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-600 py-8 text-center text-sm text-slate-300">
            No messages yet. Write your complaint below.
          </p>
        )}
        {(messages || []).map((m) => {
          const mine = m.from === "student";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm ${mine ? "bg-brand-btn text-white" : "border border-amber-400/40 bg-amber-400/10 text-slate-50"}`}>
                {!mine && <p className="text-xs font-bold uppercase tracking-wide text-amber-300">FoundIT admin</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-xs ${mine ? "text-white/70" : "text-slate-400"}`}>{formatTime(m.at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="support-body" className="sr-only">
          Your message to the admin
        </label>
        <textarea
          id="support-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          rows={4}
          placeholder="Describe your complaint or problem..."
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">{draft.length}/{MAX}</span>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-amber-400 px-5 font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" /> {sending ? "Sending..." : "Send to admin"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
