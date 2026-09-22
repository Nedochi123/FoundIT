import { useEffect, useState } from "react";
import { ArrowLeft, Images } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import ItemCard from "./ItemCard";

export default function Gallery({ onNavigate, onOpenConversation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messagingId, setMessagingId] = useState(null);

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

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-300">Loading...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
          <Images className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">Nothing's been reported found yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item, i) => (
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
