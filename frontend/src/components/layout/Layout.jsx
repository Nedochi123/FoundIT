import { Coins } from "lucide-react";
import NavBar from "./NavBar";
import Logo from "../theme/Logo";
import { useAuth } from "../../hooks/useAuth";

export default function Layout({ view, onNavigate, unreadCount, children }) {
  const { user } = useAuth();

  return (
    <div className="min-h-app" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
      <header className="sticky top-0 z-10 border-b border-white/5 bg-bar-top" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-1.5">
          <Logo className="h-7 w-7 rounded-[8px]" />
          <span className="text-[15px] font-extrabold tracking-tight text-slate-50">
            Found<span className="text-brand-teal">IT</span>
          </span>
          <button
            onClick={() => onNavigate("tokens")}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-4 py-1 transition hover:bg-amber-500/15 active:scale-95"
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
