import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { geoSupported, permissionState, readPosition, watchPermission } from "../../lib/geo";
import LegalScreen from "../legal/LegalScreen";

const REFRESH_EVERY_MS = 5 * 60 * 1000;
const CHECKIN_KEY = "foundit_checkin_sent";

/**
 * Location is compulsory, like "Enable notifications" but without a "Not now": until the phone shares where it is,
 * the app shows this screen instead of its content. The location is kept for the owner's security log (see
 * lib/geo.js and the Privacy & Terms), which is explained here before anything is asked. The admin account is
 * exempt so it can never be locked out of the admin tools.
 */
export default function LocationGate({ children }) {
  const { user } = useAuth();
  const exempt = Boolean(user?.isAdmin);
  // checking | ask | working | denied | unavailable | unsupported | ok
  const [state, setState] = useState(exempt ? "ok" : "checking");
  const [showLegal, setShowLegal] = useState(false);
  const timer = useRef(null);

  const finishOk = useCallback(() => {
    setState("ok");
    // tell the server the app was opened (once per visit); the location itself rides in the request header
    try {
      if (!sessionStorage.getItem(CHECKIN_KEY)) {
        sessionStorage.setItem(CHECKIN_KEY, "1");
        api.checkin().catch(() => sessionStorage.removeItem(CHECKIN_KEY));
      }
    } catch {
      api.checkin().catch(() => {});
    }
  }, []);

  const ask = useCallback(async () => {
    setState("working");
    const result = await readPosition({ timeout: 20000, maximumAge: 0 });
    if (result.ok) finishOk();
    else if (result.reason === "denied") setState("denied");
    else if (result.reason === "unsupported") setState("unsupported");
    else setState("unavailable");
  }, [finishOk]);

  // first look: is location already allowed on this phone?
  useEffect(() => {
    if (exempt) return undefined;
    let cancelled = false;
    (async () => {
      const permission = await permissionState();
      if (cancelled) return;
      if (permission === "unsupported") setState("unsupported");
      else if (permission === "denied") setState("denied");
      else if (permission === "granted") ask(); // already allowed: read it quietly
      else setState("ask"); // not asked yet (or the browser won't say): explain first
    })();
    return () => {
      cancelled = true;
    };
  }, [exempt, ask]);

  // switching location off later in the browser settings puts the screen back
  useEffect(() => {
    if (exempt || !geoSupported()) return undefined;
    let stop = () => {};
    watchPermission((permission) => {
      if (permission === "denied") setState("denied");
      else if (permission === "granted") ask();
    }).then((fn) => {
      stop = fn;
    });
    return () => stop();
  }, [exempt, ask]);

  // while the app is open the latest position is refreshed now and then, so actions carry a recent one
  useEffect(() => {
    if (state !== "ok" || exempt) return undefined;
    const refresh = () => document.visibilityState === "visible" && readPosition({ timeout: 10000, maximumAge: 120000 });
    timer.current = setInterval(refresh, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [state, exempt]);

  if (state === "ok" || exempt) return children;
  if (state === "checking") return <div className="min-h-app" aria-busy="true" />;

  if (showLegal) {
    return (
      <div className="flex min-h-app justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <LegalScreen onBack={() => setShowLegal(false)} />
        </div>
      </div>
    );
  }

  const trouble = {
    denied: {
      title: "Location is blocked",
      steps: [
        "Android (Chrome): tap the icon at the left of the address bar, then Permissions, then Location, then Allow.",
        "iPhone: open Settings, then Privacy & Security, then Location Services, and set Safari Websites (or FoundIT) to While Using the App.",
      ],
    },
    unavailable: {
      title: "We can't find your location",
      steps: ["Make sure Location is switched on in your phone's settings, then try again. Going near a window can help."],
    },
    unsupported: {
      title: "This browser can't share location",
      steps: ["Open FoundIT in Chrome (Android) or Safari (iPhone), and make sure you are using the https:// address."],
    },
  }[state];

  return (
    <div className="flex min-h-app items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm animate-fade-up">
        <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/15 ring-2 ring-brand-teal/40">
            <MapPin className="h-8 w-8 text-brand-teal" aria-hidden="true" />
          </div>
          <h1 className="text-center text-xl font-bold text-slate-50">{trouble ? trouble.title : "Turn on your location"}</h1>
          <p className="mt-2 text-center text-sm text-slate-300">
            FoundIT needs your location to keep everyone's belongings safe and to help stop theft. You can't use the app without it.
          </p>

          {trouble && (
            <ul className="mt-4 flex flex-col gap-2 text-xs text-slate-300">
              {trouble.steps.map((step) => (
                <li key={step} className="rounded-lg border border-amber-400/25 bg-amber-500/[0.08] p-2.5">
                  {step}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <p>
              When you do things like post an item, send a message or confirm a return, FoundIT notes where your phone was. Only the FoundIT
              administrator can see this, who may also review activity and chats for security. It is never shown to other students, and it
              is deleted after 90 days.
            </p>
          </div>

          {state !== "unsupported" && (
            <button
              type="button"
              onClick={ask}
              disabled={state === "working"}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-btn font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {state === "working" ? (
                "Finding you..."
              ) : state === "ask" ? (
                <>
                  <MapPin className="h-5 w-5" aria-hidden="true" /> Turn on location
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" aria-hidden="true" /> I've turned it on, try again
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLegal(true)}
            className="mt-3 w-full min-h-11 text-xs font-semibold text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Read the Privacy &amp; Terms
          </button>
        </div>
      </main>
    </div>
  );
}
