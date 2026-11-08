import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, QrCode, Pause, Play, Trash2, MessageSquare, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import TagChat from "./TagChat";
import { ChatSkeleton, LinesSkeleton, ListSkeleton } from "../shared/Skeleton";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";

const POLL_MS = 6000;
const prettyCode = (c) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TagCard({ tag, onChanged, onOpenChat }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(tag.label || "");

  async function toggleChats() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const data = await api.getTagThreads(tag.id);
        setThreads(data.threads);
      } catch (err) {
        setError(err.message);
      }
    }
  }

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const paused = tag.status === "paused";
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api.updateTag(tag.id, { label: label.trim() });
                  setRenaming(false);
                });
              }}
            >
              <input aria-label="What is this tag on?" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className={inputClass} placeholder="e.g. Blue backpack" />
              <button type="submit" disabled={busy} className="rounded-lg bg-brand-gradient px-3 text-xs font-bold text-white">Save</button>
            </form>
          ) : (
            <p className="truncate font-bold text-slate-50">{tag.label || "Unnamed tag"}</p>
          )}
          <p className="mt-0.5 font-mono text-xs text-slate-400">{prettyCode(tag.code)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            paused ? "bg-slate-700 text-slate-300" : "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
          }`}
        >
          {paused ? "Paused" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={toggleChats} className="flex min-h-9 items-center gap-1.5 text-xs font-semibold text-brand-teal hover:text-cyan-200">
          <MessageSquare className="h-3.5 w-3.5" />
          {open ? "Hide chats" : `Chats (${tag.chatCount})`}
          {!open && tag.unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{tag.unreadCount} new</span>
          )}
        </button>
        <button type="button" disabled={busy} onClick={() => setRenaming((r) => !r)} className="min-h-9 text-xs font-medium text-slate-300 underline underline-offset-2 hover:text-slate-50">
          Rename
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => api.updateTag(tag.id, { status: paused ? "active" : "paused" }))}
          className="flex min-h-9 items-center gap-1 text-xs font-medium text-slate-300 hover:text-slate-50"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Remove this tag from your account? Anyone who scans it will no longer reach you, and its chats (and any numbers shared in them) will be deleted.")) {
              run(() => api.releaseTag(tag.id));
            }
          }}
          className="flex min-h-9 items-center gap-1 text-xs font-medium text-red-300 hover:text-red-200"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {open && (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
          {threads === null ? (
            <LinesSkeleton label="Loading chats..." lines={2} />
          ) : threads.length === 0 ? (
            <p className="text-xs text-slate-400">No one has scanned this tag yet. When they do, you can chat with them here.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenChat(tag, t.id)}
                className="flex w-full items-center gap-3 rounded-lg bg-slate-800/70 p-3 text-left transition hover:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-50">{t.finderName || "Someone who found it"}</p>
                    <p className="shrink-0 text-[11px] text-slate-400">{timeAgo(t.lastMessageAt)}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-300">{t.preview || "Shared their contact"}</p>
                </div>
                {t.unreadCount > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{t.unreadCount} new</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** One chat with a finder, from the owner's side. */
function ChatScreen({ tag, threadId, onBack }) {
  const [chat, setChat] = useState(null); // { messages, open }
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.getTagThread(tag.id, threadId);
      setChat({ messages: data.messages, open: data.open });
    } catch (err) {
      setError(err.message || "Couldn't load this chat.");
    }
  }, [tag.id, threadId]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function handleSend(text) {
    const data = await api.sendTagThreadMessage(tag.id, threadId, text);
    setChat((c) => ({ ...c, messages: data.messages }));
  }
  async function handleShare(contact) {
    const data = await api.shareTagThreadContact(tag.id, threadId, contact);
    setChat((c) => ({ ...c, messages: data.messages }));
  }
  async function handleDelete() {
    if (!window.confirm("Delete this chat? Any name or number the finder shared will be erased, and they won't be able to open it again.")) return;
    try {
      await api.deleteTagThread(tag.id, threadId);
      onBack();
    } catch (err) {
      setError(err.message || "Couldn't delete this chat.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <h1 className="text-xl font-bold text-slate-50">Chat with the finder</h1>
        <p className="mt-1 text-sm text-slate-300">
          About your <span className="font-semibold text-slate-100">{tag.label || "FoundIT tag"}</span>. You can't see who they are unless they choose to tell you, and they can't see you.
        </p>
      </div>
      <div className={cardClass}>
        {chat === null ? (
          error ? <p className="text-sm text-slate-400">{error}</p> : <ChatSkeleton label="Loading the chat..." />
        ) : (
          <TagChat
            messages={chat.messages}
            mySide="owner"
            onSend={handleSend}
            onShareContact={handleShare}
            open={chat.open}
            closedNote="This tag is paused. Resume it from the tag's page to keep chatting."
          />
        )}
      </div>
      {chat && error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" onClick={handleDelete} className="flex items-center gap-1.5 self-start text-xs font-medium text-red-300 hover:text-red-200">
        <Trash2 className="h-3.5 w-3.5" /> Delete this chat
      </button>
    </div>
  );
}

export default function TagsScreen({ onBack, initialCode = "" }) {
  const [tags, setTags] = useState(null);
  const [maxTags, setMaxTags] = useState(10);
  const [code, setCode] = useState(initialCode);
  const [label, setLabel] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [justActivated, setJustActivated] = useState(false);
  const [openChat, setOpenChat] = useState(null); // { tag, threadId }

  const load = useCallback(async () => {
    const data = await api.getMyTags();
    setTags(data.tags);
    setMaxTags(data.maxTags);
  }, []);
  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function handleClaim(e) {
    e.preventDefault();
    setClaiming(true);
    setError("");
    setJustActivated(false);
    try {
      await api.claimTag(code, label.trim());
      setCode("");
      setLabel("");
      setJustActivated(true);
      await load();
      // the link that opened this screen carried the code: tidy the address bar
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setError(err.message || "Couldn't activate the tag. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  if (openChat) {
    return (
      <ChatScreen
        tag={openChat.tag}
        threadId={openChat.threadId}
        onBack={() => {
          setOpenChat(null);
          load().catch(() => {}); // the "new" badges are cleared now
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-50">
          <QrCode className="h-5 w-5 text-brand-teal" /> My QR tags
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Stick a FoundIT tag on your laptop, bag, keys or ID holder. If someone finds it, they scan it and chat with you privately. Neither of you
          sees the other's name or number unless you choose to share it.
        </p>
      </div>

      <form onSubmit={handleClaim} className={`${cardClass} flex flex-col gap-3`}>
        <p className="text-sm font-bold text-slate-50">Activate a tag</p>
        <div>
          <label htmlFor="tag-code" className={labelClass}>Code on the sticker</label>
          <input id="tag-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="e.g. K7M2-QX4P" className={`${inputClass} font-mono tracking-wider`} />
        </div>
        <div>
          <label htmlFor="tag-label" className={labelClass}>What is it stuck on? <span className="font-normal text-slate-500">(optional)</span></label>
          <input id="tag-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Blue backpack" className={inputClass} />
          <p className="mt-1 text-[11px] text-slate-500">Finders will see this, so don't put your name or number in it.</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {justActivated && <p role="status" className="text-sm text-emerald-300">Tag activated. Anyone who scans it can now reach you.</p>}
        <button type="submit" disabled={claiming || !code.trim()} className="rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 disabled:opacity-50">
          {claiming ? "Activating..." : "Activate tag"}
        </button>
      </form>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Your tags ({tags?.length ?? 0} of {maxTags})</p>
        {tags === null ? (
          <ListSkeleton label="Loading your tags..." rows={2} />
        ) : tags.length === 0 ? (
          <p className="text-sm text-slate-400">You haven't activated a tag yet. Got a FoundIT sticker? Enter its code above.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tags.map((t) => (
              <TagCard key={t.id} tag={t} onChanged={() => load().catch(() => {})} onOpenChat={(tag, threadId) => setOpenChat({ tag, threadId })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
