import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Images, Search, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import ItemCard from "./ItemCard";

export default function Gallery({ onNavigate, onOpenConversation }) {
  const { user } = useAuth();
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

  async function load() {
    setLoading(true);
    try {
      const { items } = await api.listFoundItems("open");
      setItems(items);
    } catch (err) {
      setError(err.message || "Couldn't load the gallery.");
    } finally {
      setLoading(false);
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

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => onNavigate("home")}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-slate-50">Found items</h1>
        <p className="mt-1 text-sm text-slate-300">Recognize something? Message the person who found it.</p>
      </div>

      {items.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by description or location"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-9 pr-9 text-sm text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
    </div>
  );
}
