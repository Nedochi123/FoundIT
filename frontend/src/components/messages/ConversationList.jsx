import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { api, resolvePhotoUrl } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ConversationList({ onOpenConversation, onUnreadChange }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  usePolling(
    async () => {
      try {
        const { conversations } = await api.listConversations();
        setConversations(conversations);
        onUnreadChange?.(conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
      } finally {
        setLoading(false);
      }
    },
    25000
  );

  if (loading) return <p className="text-sm text-slate-300">Loading...</p>;

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
        <MessageCircle className="h-8 w-8 text-slate-500" />
        <p className="text-sm text-slate-300">No conversations yet.</p>
        <p className="text-xs text-slate-400">Message someone from the Gallery to start one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpenConversation(c.id)}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/85 p-3 text-left shadow-lg shadow-black/20 transition hover:border-brand-teal/40"
        >
          <img
            src={resolvePhotoUrl(c.itemPhotoUrl)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold text-slate-50">{c.otherUserName}</p>
              <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.lastMessageAt)}</span>
            </div>
            <p className="truncate text-sm text-slate-300">{c.lastMessage || "No messages yet"}</p>
          </div>
          {c.unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand-gradient px-1.5 text-[11px] font-bold text-white">
              {c.unreadCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
