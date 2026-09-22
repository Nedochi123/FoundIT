import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
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
  const bottomRef = useRef(null);

  usePolling(
    async () => {
      const { messages } = await api.getMessages(conversationId);
      setMessages(messages);
    },
    4000,
    [conversationId]
  );

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
