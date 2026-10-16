import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { formatNaira } from "../../lib/rewards";

const SEEN_KEY = "foundit_urgent_seen";
const CHECK_EVERY_MS = 60_000;

function readSeen() {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function markSeen(id) {
  try {
    const list = readSeen().filter((x) => x !== id);
    list.push(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // Private browsing: the alert just shows again next time the app opens.
  }
}

/**
 * The warning alert every student sees inside the app when someone urgently needs an item and is offering a
 * reward: a pop-up with the triangle alert sign, shown once per alert (and not to the person who posted it).
 * The same alert also arrives as a push notification for anyone who turned notifications on; this makes sure
 * people without them still see it.
 */
export default function UrgentAlertModal({ onNavigate }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const primaryRef = useRef(null);

  const check = useCallback(async () => {
    try {
      const { items } = await api.listUrgentItems();
      const seen = readSeen();
      setAlerts(items.filter((i) => i.posterId !== user?.id && !seen.includes(i.id)));
    } catch {
      // offline or a hiccup: try again at the next check
    }
  }, [user?.id]);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const current = alerts[0];

  const close = useCallback(() => {
    if (!current) return;
    markSeen(current.id);
    setAlerts((prev) => prev.slice(1));
  }, [current]);

  useEffect(() => {
    if (!current) return undefined;
    primaryRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, close]);

  if (!current) return null;

  function seeDetails() {
    try {
      sessionStorage.setItem("foundit_gallery_tab", "lost");
    } catch {
      // opens on the Found side instead
    }
    close();
    onNavigate("gallery");
  }
  function iFoundIt() {
    close();
    onNavigate("found");
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="urgent-alert-title"
        aria-describedby="urgent-alert-text"
        className="w-full max-w-sm rounded-xl border border-red-500/60 bg-slate-950 p-5"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 ring-2 ring-red-500/50 motion-safe:animate-pulse">
            <TriangleAlert className="h-9 w-9 text-red-400" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <p id="urgent-alert-title" className="text-xs font-extrabold uppercase tracking-[0.2em] text-red-400">
            Urgent alert
          </p>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-50">{current.posterName}</span> urgently needs:
          </p>
          <p id="urgent-alert-text" className="line-clamp-4 whitespace-pre-wrap break-words text-base font-bold text-slate-50">
            {current.description}
          </p>
          {current.location && (
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="h-3 w-3" /> {current.location}
            </p>
          )}
          <div className="mt-1 w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2">
            <p className="text-lg font-extrabold text-amber-300">{formatNaira(current.urgent.reward)} reward</p>
            <p className="text-xs text-slate-300">for whoever finds it and returns it</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={iFoundIt}
            className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            I found it
          </button>
          <button
            type="button"
            onClick={seeDetails}
            className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
          >
            See the Lost board
          </button>
          <button type="button" onClick={close} className="min-h-11 text-xs font-semibold text-slate-400 hover:text-slate-200">
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
