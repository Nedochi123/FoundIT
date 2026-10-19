import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Images, Rocket, Search, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import ItemCard from "./ItemCard";
import LostBoard from "./LostBoard";

const TAB_KEY = "foundit_gallery_tab";
const JUST_POSTED_KEY = "foundit_just_posted_lost";

// Which side to open on: the Lost board when a link or another screen asks for it (an alert about a boosted
// post, "See all lost posts" on Home), otherwise the found items as always.
function getInitialTab() {
  try {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get("lost") === "1" || sessionStorage.getItem(TAB_KEY) === "lost";
    return asked ? "lost" : "found";
  } catch {
    return "found";
  }
}

// True right after the student reported something lost (LostForm sets it). Read here, cleared in an effect below:
// React may render twice in development, so nothing is deleted while rendering.
function justPostedLost() {
  try {
    return sessionStorage.getItem(JUST_POSTED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Gallery({ onNavigate, onOpenConversation }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(getInitialTab);
  const [justPosted, setJustPosted] = useState(justPostedLost);
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messagingId, setMessagingId] = useState(null);
  const [query, setQuery] = useState("");

  // Campus-scale item counts make a full search backend overkill — a
  // simple client-side substring match over what's already loaded is
  // instant and needs no new endpoint.
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.description?.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    load();
  }, []);

  // An item leaves the gallery as soon as its owner confirms the return (the server only lists open items). Keep a
  // gallery that is already open up to date too: refresh quietly every 30 seconds while it is on screen, and whenever
  // the student comes back to the app, so a returned item disappears without them leaving and coming back.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load({ quiet: true });
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // used up: these one-time hints should not come back next time the gallery opens
  useEffect(() => {
    try {
      sessionStorage.removeItem(TAB_KEY);
      sessionStorage.removeItem(JUST_POSTED_KEY);
      if (new URLSearchParams(window.location.search).get("lost")) window.history.replaceState({}, "", window.location.pathname);
    } catch {
      // Private browsing: nothing to clear.
    }
  }, []);

  // only nudge toward a boost if boosts can actually be paid for yet
  useEffect(() => {
    if (!justPosted) return;
    api
      .getBoostPlans()
      .then((p) => setBoostEnabled(Boolean(p.enabled)))
      .catch(() => {});
  }, [justPosted]);

  // quiet: a background refresh (no "Loading...", and a failed refresh just keeps what is on screen)
  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const { items } = await api.listFoundItems("open");
      setItems(items);
    } catch (err) {
      if (!quiet) setError(err.message || "Couldn't load the gallery.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function handleMessage(foundItemId) {
    setMessagingId(foundItemId);
    try {
      const { conversation } = await api.openConversation(foundItemId);
      onOpenConversation(conversation.id);
    } catch (err) {
      setError(err.message || "Couldn't start the conversation.");
    } finally {
      setMessagingId(null);
    }
  }

  async function handleResolve(id) {
    await api.resolveFoundItem(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const onLost = tab === "lost";

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => onNavigate("home")}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-slate-50">{onLost ? "Lost items" : "Found items"}</h1>
        <p className="mt-1 text-sm text-slate-300">
          {onLost ? "Did you see something someone is looking for? Tap \"I found this\"." : "Recognize something? Message the person who found it."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-800/70 p-1" role="tablist" aria-label="Found or lost items">
        {[
          ["found", "Found"],
          ["lost", "Lost"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition ${
              tab === key ? "bg-brand-gradient text-white shadow-md shadow-brand-blue/20" : "text-slate-300 hover:text-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {onLost ? (
        <LostBoard onNavigate={onNavigate} />
      ) : (
        <>
          {justPosted && boostEnabled && (
            <div className="relative rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-4" role="status">
              <button
                type="button"
                onClick={() => setJustPosted(false)}
                aria-label="Dismiss"
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="pr-8 font-bold text-slate-50">Your lost post is up</p>
              <p className="pr-8 text-sm text-slate-300">Want more people to see it? Boost it to the top for everyone on campus.</p>
              <button
                type="button"
                onClick={() => {
                  setJustPosted(false);
                  setTab("lost");
                }}
                className="mt-2.5 flex min-h-11 items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 text-sm font-bold text-amber-950 transition hover:brightness-105 active:scale-95"
              >
                <Rocket className="h-4 w-4" /> Boost my post
              </button>
            </div>
          )}

          {items.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by description or location"
                placeholder="Search by description or location"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-11 text-sm text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-500 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-300">Loading...</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
              <Images className="h-8 w-8 text-slate-500" />
              <p className="text-sm text-slate-300">Nothing's been reported found yet.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
              <Search className="h-8 w-8 text-slate-500" />
              <p className="text-sm text-slate-300">Nothing matches "{query}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item, i) => (
                <div key={item.id} className="animate-fade-up" style={{ "--delay": `${Math.min(i, 6) * 0.05}s` }}>
                  <ItemCard
                    item={item}
                    currentUserId={user?.id}
                    onMessage={handleMessage}
                    onResolve={handleResolve}
                    messaging={messagingId === item.id}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
