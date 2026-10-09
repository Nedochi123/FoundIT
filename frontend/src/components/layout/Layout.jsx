import { Coins } from "lucide-react";
import NavBar from "./NavBar";
import { useAuth } from "../../hooks/useAuth";

export default function Layout({ view, onNavigate, unreadCount, children }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-glow" aria-hidden="true" />
      <header className="sticky top-0 z-10 border-b border-white/5 bg-bar-top/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <img src="/brand/foundit-icon.png" alt="" className="h-7 w-7 rounded-[8px] shadow-md shadow-black/40" />
          <span className="text-[15px] font-extrabold tracking-tight text-slate-50">
            Found<span className="text-brand-teal">IT</span>
          </span>
          <button
            onClick={() => onNavigate("tokens")}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 transition hover:bg-amber-500/15 active:scale-95"
          >
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">{user?.tokens ?? 0}</span>
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 pt-6">{children}</div>
      <NavBar view={view} onNavigate={onNavigate} unreadCount={unreadCount} />
    </div>
  );
}
