import { useCallback, useEffect, useState } from "react";
import { Megaphone, TriangleAlert } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import LostCard from "./LostCard";
import BoostSheet from "../boost/BoostSheet";
import EditPostDialog from "./EditPostDialog";

/** The Lost tab: everything people on campus are looking for, boosted posts pinned first. */
export default function LostBoard({ onNavigate }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [boosting, setBoosting] = useState(null); // the post whose boost sheet is open
  const [resolvingId, setResolvingId] = useState(null);
  const [editing, setEditing] = useState(null); // the post whose edit dialog is open
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(""); // "Your post was updated." and the like

  const load = useCallback(async () => {
    try {
      const [{ items }, plans] = await Promise.all([api.listLostItems("open"), api.getBoostPlans().catch(() => ({ enabled: false }))]);
      setItems(items);
      setBoostEnabled(Boolean(plans.enabled));
      setError("");
    } catch (err) {
      setError(err.message || "Couldn't load lost posts.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve(item) {
    const warning = item.urgent
      ? "Mark this as found? Your urgent alert will stop. If someone returned it to you, confirm it in Messages instead, so they get their tokens and the reward you promised."
      : item.boostedUntil
        ? "Mark this as found? Your boost will end now and can't be refunded."
        : "Mark this as found? It will be taken off the Lost board.";
    if (!window.confirm(warning)) return;
    setResolvingId(item.id);
    try {
      await api.resolveLostItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err.message || "Couldn't update that post. Please try again.");
    } finally {
      setResolvingId(null);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm("Delete this post for good? It will disappear for everyone and can't be brought back.")) return;
    setDeletingId(item.id);
    setError("");
    setNotice("");
    try {
      await api.deleteLostItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setNotice("Your post was deleted.");
    } catch (err) {
      setError(err.message || "Couldn't delete that post. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-300">Loading...</p>;

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
      <button
        type="button"
        onClick={() => onNavigate("urgent")}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20 active:scale-[0.98]"
      >
        <TriangleAlert className="h-4 w-4" aria-hidden="true" /> I urgently need something
      </button>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-12 text-center">
          <Megaphone className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">Nobody is looking for anything right now.</p>
        </div>
      ) : (
        items.map((item, i) => (
          <div key={item.id} className="animate-fade-up" style={{ "--delay": `${Math.min(i, 6) * 0.05}s` }}>
            <LostCard
              item={item}
              currentUserId={user?.id}
              boostEnabled={boostEnabled}
              onBoost={setBoosting}
              onResolve={handleResolve}
              onFound={() => onNavigate("found")}
              resolving={resolvingId === item.id}
              onEdit={setEditing}
              onDelete={handleDelete}
              deleting={deletingId === item.id}
            />
          </div>
        ))
      )}

      {editing && (
        <EditPostDialog
          kind="lost"
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setItems((prev) => prev.map((i) => (i.id === saved.id ? { ...i, ...saved, boostedUntil: i.boostedUntil, urgent: i.urgent, boost: i.boost } : i)));
            setEditing(null);
            setError("");
            setNotice("Your post was updated.");
          }}
        />
      )}

      {boosting && (
        <BoostSheet
          item={boosting}
          onClose={() => {
            setBoosting(null);
            load();
          }}
          onChanged={load}
        />
      )}
    </div>
  );
}
