import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { enablePushNotifications, isIosNotStandalone, pushSupported } from "../../lib/push";

const DISMISSED_KEY = "foundit_notif_prompt_dismissed";

export default function NotificationsPrompt() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("idle");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // ignore
    }
    if (!dismissed && pushSupported()) setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function handleEnable() {
    if (isIosNotStandalone()) {
      setStatus("ios-not-installed");
      return;
    }
    setStatus("requesting");
    const result = await enablePushNotifications();
    if (result.ok) {
      dismiss();
    } else {
      setStatus(result.reason);
      setDetail(result.detail || "");
    }
  }

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-xl border border-brand-teal/30 bg-brand-teal/10 p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-50">Turn on notifications</p>
          {status === "ios-not-installed" ? (
            <p className="mt-1 text-xs text-slate-200">
              On iPhone, add FoundIT to your Home Screen first (Share → Add to Home Screen), then enable
              notifications from your Profile — iOS only supports this after installing.
            </p>
          ) : status === "denied" ? (
            <p className="mt-1 text-xs text-slate-200">
              Notifications are blocked for this site. Click the icon next to the address bar, set Notifications to
              Allow, then reload and try again.
            </p>
          ) : status === "unsupported" ? (
            <p className="mt-1 text-xs text-slate-200">Notifications aren't supported in this browser.</p>
          ) : status === "subscribe_failed" ? (
            <p className="mt-1 text-xs text-slate-200">
              Something went wrong turning this on{detail ? `: ${detail}` : ""}. Try again in a moment.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-200">
              Get notified the moment someone reports something lost or found on campus.
            </p>
          )}
          <div className="mt-2 flex gap-3">
            <button
              onClick={handleEnable}
              disabled={status === "requesting"}
              className="text-xs font-semibold text-brand-teal hover:underline disabled:opacity-60"
            >
              {status === "requesting" ? "Requesting..." : "Enable"}
            </button>
            <button onClick={dismiss} className="text-xs font-medium text-slate-300 hover:underline">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
