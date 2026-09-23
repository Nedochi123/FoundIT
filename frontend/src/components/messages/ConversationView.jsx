import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, PartyPopper, Coins } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";

function formatTime(iso) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ConversationView({ conversationId, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isSeeker, setIsSeeker] = useState(false);
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const bottomRef = useRef(null);

  usePolling(
    async () => {
      const data = await api.getMessages(conversationId);
      setMessages(data.messages);
      setIsSeeker(data.isSeeker);
      setReturnConfirmed(data.returnConfirmed);
    },
    4000,
    [conversationId]
  );

  async function handleConfirmReturn() {
    setConfirming(true);
    setError("");
    try {
      await api.confirmReturn(conversationId);
      setReturnConfirmed(true);
      setJustConfirmed(true);
    } catch (err) {
      setError(err.message || "Couldn't confirm the return. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError("");
    setDraft("");
    try {
      const { message } = await api.sendMessage(conversationId, body);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err.message || "Message didn't send. Try again.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back to messages
      </button>

      {justConfirmed ? (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
          <PartyPopper className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-100">
            Return confirmed — the finder just earned <span className="font-bold text-amber-300">+2 tokens</span>.
          </p>
        </div>
      ) : isSeeker && !returnConfirmed ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-50">Got your item back?</p>
            <p className="text-xs text-slate-300">Confirming awards the finder 2 tokens.</p>
          </div>
          <button
            onClick={handleConfirmReturn}
            disabled={confirming}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            <Coins className="h-3.5 w-3.5" />
            {confirming ? "Confirming..." : "Confirm"}
          </button>
        </div>
      ) : null}

      <div className="flex-1 space-y-2 overflow-y-auto pb-3">
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-brand-gradient text-white shadow-md shadow-brand-blue/20" : "bg-slate-800 text-slate-100 border border-slate-700"
                }`}
              >
                <p>{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-cyan-100/80" : "text-slate-400"}`}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/10 pt-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
