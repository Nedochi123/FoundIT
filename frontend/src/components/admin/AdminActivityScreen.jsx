import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MapPin, MapPinOff, Search, MessageSquare, Users, Activity, Tag, Lock } from "lucide-react";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/boosts";

// SQLite times look like "2026-10-09 14:30:00" (UTC)
const toDate = (iso) => new Date(String(iso).replace(" ", "T") + "Z");
const when = (iso) => toDate(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const mapLink = (loc) => `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm text-slate-50 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/40";

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={inputClass} />
    </div>
  );
}

/** Where the phone was: a link to the map, or a flag when none was sent. */
function Place({ location }) {
  if (!location) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
        <MapPinOff className="h-3 w-3" aria-hidden="true" /> No location sent
      </span>
    );
  }
  return (
    <a
      href={mapLink(location)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
    >
      <MapPin className="h-3 w-3" aria-hidden="true" /> Map{location.accuracy ? ` · ±${location.accuracy} m` : ""}
    </a>
  );
}

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------- activity
function ActivityList({ personId, personName, onClearPerson, onPickPerson }) {
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (before) => {
      setLoading(true);
      try {
        const data = await api.monitorActivity({ user: personId, q: query, before });
        setItems((prev) => (before ? [...prev, ...data.items] : data.items));
        setNext(data.next);
        setError("");
      } catch (err) {
        setError(err.message || "Couldn't load the activity.");
      } finally {
        setLoading(false);
      }
    },
    [personId, query]
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search by name or action" />
      {personId && (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Showing only {personName || "one person"}
          <button type="button" onClick={onClearPerson} className="font-bold underline">
            Show everyone
          </button>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-50">{row.action}</p>
                {row.detail && <p className="mt-0.5 line-clamp-2 break-words text-xs italic text-slate-300">"{row.detail}"</p>}
              </div>
              <time dateTime={row.at} className="shrink-0 text-[11px] text-slate-400">
                {when(row.at)}
              </time>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {row.userId ? (
                <button type="button" onClick={() => onPickPerson(row.userId, row.userName)} className="text-xs font-semibold text-brand-teal underline-offset-2 hover:underline">
                  {row.userName}
                </button>
              ) : (
                <span className="text-xs text-slate-400">{row.userName}</span>
              )}
              <Place location={row.location} />
            </div>
          </li>
        ))}
      </ul>
      {!loading && items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Nothing recorded yet.</p>}
      {loading && <p className="text-sm text-slate-300">Loading...</p>}
      {next && !loading && (
        <button type="button" onClick={() => load(next)} className="min-h-11 rounded-lg border border-slate-600 text-sm font-semibold text-slate-200 hover:bg-slate-800">
          Load more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- people
function PeopleList({ onPickPerson }) {
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .monitorPeople(query)
      .then((d) => {
        setPeople(d.people);
        setError("");
      })
      .catch((err) => setError(err.message || "Couldn't load people."))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search by name, email or ID number" />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-50">
                  {p.name} {p.suspended && <span className="ml-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-300">Suspended</span>}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {p.email}
                  {p.idNumber ? ` · ID ${p.idNumber}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{p.lastActive ? timeAgo(p.lastActive) : "no activity"}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-300">
              <span>{p.actions} actions</span>
              {p.actionsWithoutLocation > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">{p.actionsWithoutLocation} with no location</span>
              )}
              {p.lastLocation ? (
                <>
                  <Place location={p.lastLocation} />
                  <span className="text-slate-500">last seen {timeAgo(p.lastLocation.at)}</span>
                </>
              ) : (
                <Place location={null} />
              )}
              <button type="button" onClick={() => onPickPerson(p.id, p.name)} className="font-semibold text-brand-teal underline-offset-2 hover:underline">
                See what they did
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!loading && people.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Nobody matches.</p>}
      {loading && <p className="text-sm text-slate-300">Loading...</p>}
    </div>
  );
}

// ---------------------------------------------------------------- chats
function ChatView({ chat, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .monitorChat(chat.kind, chat.id)
      .then(setData)
      .catch((err) => setError(err.message || "Couldn't open that chat."));
  }, [chat.kind, chat.id]);

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50">
        <ArrowLeft className="h-4 w-4" /> All chats
      </button>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-300">Loading...</p>}
      {data && (
        <>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300">
            {data.kind === "item" ? (
              <>
                <p className="text-sm font-semibold text-slate-50">{data.item.description || "Found item"}</p>
                {data.item.location && <p className="text-slate-400">Found at: {data.item.location}</p>}
                <p className="mt-1">
                  Finder: <span className="font-semibold text-slate-100">{data.finder.name}</span> ({data.finder.email})
                </p>
                <p>
                  Looking for it: <span className="font-semibold text-slate-100">{data.seeker.name}</span> ({data.seeker.email})
                </p>
                {data.item.returnConfirmedAt && <p className="mt-1 text-emerald-300">Return confirmed {when(data.item.returnConfirmedAt)}</p>}
                {data.reward && (
                  <p className="text-amber-300">
                    Reward ₦{Number(data.reward.amount).toLocaleString()} · {data.reward.status}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-50">
                  QR tag {data.tag.code}
                  {data.tag.label ? ` (${data.tag.label})` : ""}
                </p>
                <p className="mt-1">
                  Owner: <span className="font-semibold text-slate-100">{data.owner ? `${data.owner.name} (${data.owner.email})` : "released tag"}</span>
                </p>
                <p>The other person scanned the tag and has no account.</p>
              </>
            )}
            <p className="mt-2 flex items-center gap-1 text-slate-500">
              <Lock className="h-3 w-3" aria-hidden="true" /> Read only. Long numbers are hidden down to their last 4 digits.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {data.messages.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No messages.</p>}
            {data.messages.map((m) => {
              const name = data.kind === "item" ? m.senderName : m.sender === "owner" ? data.owner?.name || "Owner" : "Finder (no account)";
              const second = data.kind === "item" ? m.senderId === data.seeker.id : m.sender === "owner";
              return (
                <div key={m.id} className={`flex ${second ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${second ? "bg-brand-teal/20 text-slate-50" : "bg-slate-800 text-slate-100"}`}>
                    <p className="text-[11px] font-semibold text-slate-400">{name}</p>
                    {m.kind === "contact" ? (
                      <p className="italic">
                        Shared contact: {m.contactName || "(no name)"} {m.contactPhone || ""}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                    <p className="mt-0.5 text-right text-[10px] text-slate-500">{when(m.at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ChatList({ onOpen }) {
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .monitorChats(query)
      .then((d) => {
        setChats(d.chats);
        setError("");
      })
      .catch((err) => setError(err.message || "Couldn't load chats."))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search names, items or message text" />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <ul className="flex flex-col gap-2">
        {chats.map((c) => (
          <li key={`${c.kind}-${c.id}`}>
            <button type="button" onClick={() => onOpen(c)} className="w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 text-left transition hover:border-amber-400/40">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-50">
                  {c.kind === "tag" ? <Tag className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-brand-teal" aria-hidden="true" />}
                  <span className="truncate">{c.title}</span>
                </p>
                <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(c.lastAt)}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-400">{c.people}</p>
              <p className="mt-1 line-clamp-2 break-words text-xs text-slate-300">
                {c.lastMessage || "No messages yet"} <span className="text-slate-500">· {c.messageCount} messages</span>
              </p>
            </button>
          </li>
        ))}
      </ul>
      {!loading && chats.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No chats.</p>}
      {loading && <p className="text-sm text-slate-300">Loading...</p>}
    </div>
  );
}

// ---------------------------------------------------------------- the section
const SECTIONS = [
  { key: "activity", label: "Activity", icon: Activity },
  { key: "chats", label: "Chats", icon: MessageSquare },
  { key: "people", label: "People", icon: Users },
];

/** The owner's security view (Admin → Activity). Only the monitor account is ever shown this tab. */
export default function AdminActivityScreen() {
  const [section, setSection] = useState("activity");
  const [person, setPerson] = useState(null); // { id, name } the activity list is narrowed to
  const [openChat, setOpenChat] = useState(null);

  function pickPerson(id, name) {
    setPerson({ id, name });
    setSection("activity");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-1.5 rounded-lg bg-slate-800/60 p-3 text-xs text-slate-300">
        <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
        Only your account can see this. It is read only, every chat you open is recorded, and records are deleted after 90 days. Students are told in
        the location screen, the chats and the Privacy &amp; Terms.
      </p>
      <div className="flex gap-1.5" role="tablist" aria-label="Security views">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={section === key}
            onClick={() => {
              setSection(key);
              setOpenChat(null);
            }}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              section === key ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40" : "bg-slate-800/50 text-slate-300 hover:text-slate-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {section === "activity" && (
        <ActivityList personId={person?.id} personName={person?.name} onClearPerson={() => setPerson(null)} onPickPerson={pickPerson} />
      )}
      {section === "people" && <PeopleList onPickPerson={pickPerson} />}
      {section === "chats" && (openChat ? <ChatView chat={openChat} onBack={() => setOpenChat(null)} /> : <ChatList onOpen={setOpenChat} />)}
    </div>
  );
}
