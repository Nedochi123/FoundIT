import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import LegalScreen from "../legal/LegalScreen";
import Logo from "../theme/Logo";
import Welcome from "./Welcome";
import { useSchool } from "../school/SchoolProvider";
import { DEFAULT_SCHOOL_ID } from "../../lib/schools";

function getResetTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("resetToken");
}

export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const { school, chosen, choose, forget } = useSchool();
  const [resetToken, setResetToken] = useState(getResetTokenFromUrl);
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [showLegal, setShowLegal] = useState(false);

  // Someone already signed in has, by definition, picked a school: remember it, so that after they log out they land on
  // their school's sign-in and not the Welcome page again.
  useEffect(() => {
    if (user && !chosen) choose(DEFAULT_SCHOOL_ID);
  }, [user, chosen, choose]);

  if (showLegal) {
    return (
      <div className="flex min-h-app justify-center px-4 py-10">
        <div className="bg-glow" aria-hidden="true" />
        <div className="w-full max-w-sm">
          <LegalScreen onBack={() => setShowLegal(false)} />
        </div>
      </div>
    );
  }

  function clearResetToken() {
    setResetToken(null);
    setMode("login");
    const url = new URL(window.location.href);
    url.searchParams.delete("resetToken");
    window.history.replaceState({}, "", url);
  }

  // A password-reset link should work even if the browser still has an
  // old session logged in — take priority over the "already logged in"
  // shortcut below.
  if (resetToken) {
    return (
      <div className="flex min-h-app items-center justify-center px-4 py-10">
        <div className="bg-glow" aria-hidden="true" />
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex flex-col items-center gap-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Found<span className="text-brand-teal">IT</span>
            </h1>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <ResetPasswordForm token={resetToken} onDone={clearResetToken} />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-app items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (user) return children;

  // First visit on this device: everyone starts by picking their school.
  if (!chosen) return <Welcome onShowLegal={() => setShowLegal(true)} />;

  return (
    <div className="flex min-h-app items-center justify-center px-4 py-10">
      <div className="bg-glow" aria-hidden="true" />
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-20 w-20 rounded-full opacity-50 blur-2xl"
              style={{ background: "radial-gradient(circle, var(--brand-a) 0%, var(--brand-b) 70%, transparent 100%)" }}
              aria-hidden="true"
            />
            <Logo label="FoundIT" className="relative h-16 w-16 rounded-2xl shadow-xl shadow-black/50 ring-1 ring-white/10" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {school.name}
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Found<span className="text-brand-teal">IT</span>
            </h1>
            <p className="text-sm text-slate-400">Reuniting campus, one item at a time.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          {mode === "login" ? (
            <LoginForm onSwitchToSignup={() => setMode("signup")} onForgotPassword={() => setMode("forgot")} />
          ) : mode === "forgot" ? (
            <ForgotPasswordForm onSwitchToLogin={() => setMode("login")} />
          ) : (
            <SignupForm onSwitchToLogin={() => setMode("login")} onShowLegal={() => setShowLegal(true)} />
          )}
        </div>
        <button
          onClick={() => setShowLegal(true)}
          className="mt-4 w-full text-center text-xs text-slate-400 underline hover:text-slate-200"
        >
          Privacy &amp; Terms
        </button>
        <button type="button" onClick={forget} className="mt-1 w-full text-center text-xs text-slate-400 underline hover:text-slate-200">
          Not your school? Change school
        </button>
      </div>
    </div>
  );
}
