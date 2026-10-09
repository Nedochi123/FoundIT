import { useEffect, useState } from "react";
import { ArrowLeft, QrCode, Phone, Pause, Play, Trash2, MessageSquare, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";

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

function TagCard({ tag, onChanged }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(tag.label || "");

  async function toggleMessages() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const data = await api.getTagMessages(tag.id);
        setMessages(data.messages);
        onChanged(); // they are now marked read
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
        <button type="button" onClick={toggleMessages} className="flex min-h-9 items-center gap-1.5 text-xs font-semibold text-brand-teal hover:text-cyan-200">
          <MessageSquare className="h-3.5 w-3.5" />
          {open ? "Hide messages" : `Messages (${tag.messageCount})`}
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
            if (window.confirm("Remove this tag from your account? Anyone who scans it will no longer reach you, and its messages (with finders' numbers) will be deleted.")) {
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
          {messages === null ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-slate-400">No one has scanned this tag yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="rounded-lg bg-slate-800/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-50">{m.finderName || "Someone"}</p>
                  <p className="text-[11px] text-slate-400">{timeAgo(m.createdAt)}</p>
                </div>
                {m.message && <p className="mt-1 text-sm text-slate-200">{m.message}</p>}
                <a
                  href={`tel:${m.finderPhone.replace(/[^+\d]/g, "")}`}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 text-sm font-bold text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
                >
                  <Phone className="h-4 w-4" /> {m.finderPhone}
                </a>
              </div>
            ))
          )}
          {messages && messages.length > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
              <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" /> Meet in a public place on campus. Never pay anyone before you have your item back.
            </p>
          )}
        </div>
      )}
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

  async function load() {
    const data = await api.getMyTags();
    setTags(data.tags);
    setMaxTags(data.maxTags);
  }
  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

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
          Stick a FoundIT tag on your laptop, bag, keys or ID holder. If someone finds it, they scan it and leave you a message, without
          ever seeing your number.
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
          <p className="text-sm text-slate-400">Loading...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-slate-400">You haven't activated a tag yet. Got a FoundIT sticker? Enter its code above.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tags.map((t) => (
              <TagCard key={t.id} tag={t} onChanged={() => load().catch(() => {})} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
