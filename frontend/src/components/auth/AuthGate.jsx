import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("login");

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
      <div className="bg-glow" aria-hidden="true" />
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-20 w-20 rounded-full opacity-50 blur-2xl"
              style={{ background: "radial-gradient(circle, #17b8ae 0%, #2467e6 70%, transparent 100%)" }}
              aria-hidden="true"
            />
            <img
              src="/brand/foundit-icon.png"
              alt="FoundIT"
              className="relative h-16 w-16 rounded-2xl shadow-xl shadow-black/50 ring-1 ring-white/10"
            />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Nile University
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Found<span className="text-brand-teal">IT</span>
            </h1>
            <p className="text-sm text-slate-400">Reuniting campus, one item at a time.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          {mode === "login" ? (
            <LoginForm onSwitchToSignup={() => setMode("signup")} />
          ) : (
            <SignupForm onSwitchToLogin={() => setMode("login")} />
          )}
        </div>
      </div>
    </div>
  );
}
