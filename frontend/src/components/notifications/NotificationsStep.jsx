import { useEffect, useState } from "react";
import { BellRing, BellOff, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import { enablePushNotifications, isIosNotStandalone, pushSupported } from "../../lib/push";

/**
 * "Turn on notifications", with a one-tap button, for use inside guides. It works out where the student
 * stands (already on, needs the iPhone Home Screen step, blocked, or just not asked yet) and says what to do
 * next in plain words. The same switch lives under Profile -> Notifications.
 */
export default function NotificationsStep({ reason = "So you hear straight away when someone messages you about your item, replies in a chat, or sends a reward." }) {
  // checking | off | requesting | on | ios | denied | failed | unsupported
  const [status, setStatus] = useState("checking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let alive = true;
    const set = (s) => alive && setStatus(s);
    if (isIosNotStandalone()) set("ios"); // an iPhone only allows this once FoundIT is on the Home Screen
    else if (!pushSupported()) set("unsupported");
    else if (Notification.permission === "denied") set("denied");
    else {
      api
        .getPushPreferences()
        .then((p) => set(p.hasSubscription && Notification.permission === "granted" ? "on" : "off"))
        .catch(() => set("off"));
    }
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setStatus("requesting");
    const result = await enablePushNotifications();
    setDetail(result.detail || "");
    if (result.ok) setStatus("on");
    else if (result.reason === "denied") setStatus("denied");
    else if (result.reason === "unsupported") setStatus("unsupported");
    else setStatus("failed");
  }

  const on = status === "on";
  return (
    <div
      className={`mt-4 rounded-xl border p-3.5 ${
        on ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-brand-teal/40 bg-brand-teal/[0.08]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-emerald-500/15" : "bg-brand-teal/15"}`}>
          {on ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : status === "denied" ? <BellOff className="h-5 w-5 text-brand-teal" /> : <BellRing className="h-5 w-5 text-brand-teal" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-50">{on ? "Notifications are on" : "First, turn on notifications"}</p>
          <p className="mt-0.5 text-sm text-slate-300">
            {on ? "You'll hear about replies and rewards straight away. Nothing more to do." : reason}
          </p>

          {(status === "off" || status === "requesting") && (
            <button
              type="button"
              onClick={turnOn}
              disabled={status === "requesting"}
              className="mt-2.5 min-h-11 rounded-lg bg-brand-gradient px-4 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {status === "requesting" ? "Asking your phone..." : "Turn on notifications"}
            </button>
          )}
          {status === "ios" && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
              <li>Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.</li>
              <li>Open FoundIT from the new icon on your Home Screen.</li>
              <li>Come back to this guide and tap <strong>Turn on notifications</strong>.</li>
            </ol>
          )}
          {status === "denied" && (
            <p className="mt-2 text-sm text-slate-200">
              Notifications are blocked for FoundIT. Open your browser's settings for this site (the lock or the menu next to the address),
              set <strong>Notifications</strong> to <strong>Allow</strong>, then reopen this guide.
            </p>
          )}
          {status === "failed" && (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p className="text-sm text-slate-200">Something went wrong turning this on{detail ? `: ${detail}` : ""}.</p>
              <button
                type="button"
                onClick={turnOn}
                className="min-h-11 rounded-lg bg-brand-gradient px-4 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
              >
                Try again
              </button>
            </div>
          )}
          {status === "unsupported" && (
            <p className="mt-2 text-sm text-slate-200">
              This browser can't send notifications. On Android, use Chrome. On iPhone, add FoundIT to your Home Screen first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
