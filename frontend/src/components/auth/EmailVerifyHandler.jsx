import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

function getVerifyTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("verifyToken");
}

function clearVerifyTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("verifyToken");
  window.history.replaceState({}, "", url);
}

// The welcome/resend-verification emails link to ?verifyToken=... on
// the site root. This has to work whether the student is currently
// logged in, logged out, or clicking it from a different device than
// the one they signed up on — so it's handled at the top level, above
// both the logged-out auth screens and the logged-in app.
export default function EmailVerifyHandler() {
  const { user, refreshMe } = useAuth();
  const [token] = useState(getVerifyTokenFromUrl);
  const [status, setStatus] = useState(token ? "verifying" : "idle");
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!token || submittedRef.current) return;
    // The token is single-use, so React 18 StrictMode's dev-only double
    // effect invocation would otherwise submit it twice — the first
    // call verifies successfully, the second then fails as "already
    // used" and clobbers the success state. A ref (not state) survives
    // both invocations of the same mount to prevent that.
    submittedRef.current = true;
    clearVerifyTokenFromUrl();
    api
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        // Refreshes the cached emailVerified flag if the link was
        // clicked on the same device/session that's already signed in
        // — a no-op if not, since refreshMe() just leaves a logged-out
        // state as it was.
        if (user) refreshMe();
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-950/95 px-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-2xl shadow-black/40">
        {status === "verifying" && <p className="text-sm text-slate-300">Verifying your email...</p>}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="mt-3 text-lg font-bold text-slate-50">Email verified</h2>
            <p className="mt-1 text-sm text-slate-300">Thanks — your FoundIT account is confirmed.</p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-5 w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              Continue
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
            <h2 className="mt-3 text-lg font-bold text-slate-50">Link expired or invalid</h2>
            <p className="mt-1 text-sm text-slate-300">
              This verification link no longer works. You can request a fresh one from your Profile once
              you're signed in.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-5 w-full rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
