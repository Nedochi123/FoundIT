import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import LegalScreen from "../legal/LegalScreen";
import Logo from "../theme/Logo";

function getResetTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("resetToken");
}

export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [resetToken, setResetToken] = useState(getResetTokenFromUrl);
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [showLegal, setShowLegal] = useState(false);

  if (showLegal) {
    return (
      <div className="flex min-h-screen justify-center px-4 py-10">
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
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex flex-col items-center gap-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Found<span className="text-brand-teal">IT</span>
            </h1>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
            <ResetPasswordForm token={resetToken} onDone={clearResetToken} />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (user) return children;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo label="FoundIT" className="h-16 w-16 rounded-xl" />
          <div className="flex flex-col items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Nile University
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Found<span className="text-brand-teal">IT</span>
            </h1>
            <p className="text-sm text-slate-400">Lost and found for Nile University students.</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
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
      </div>
    </div>
  );
}
