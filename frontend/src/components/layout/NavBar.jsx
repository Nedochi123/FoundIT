import { Home, Images, MessageCircle, User, Coins, ShieldCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const TABS = [
  { key: "home", label: "Home", Icon: Home },
  { key: "gallery", label: "Gallery", Icon: Images },
  { key: "tokens", label: "Tokens", Icon: Coins, accent: "amber" },
  { key: "conversations", label: "Messages", Icon: MessageCircle },
  { key: "profile", label: "Profile", Icon: User },
];

const ADMIN_TAB = { key: "admin", label: "Admin", Icon: ShieldCheck, accent: "amber" };

export default function NavBar({ view, onNavigate, unreadCount = 0 }) {
  const { user } = useAuth();
  const tabs = user?.isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-bar-bottom/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-md gap-1 px-2 py-2">
        {tabs.map(({ key, label, Icon, accent }) => {
          const active = view === key;
          const activeColor = accent === "amber" ? "text-amber-400" : "text-brand-teal";
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition active:scale-95 ${
                active ? `bg-white/[0.06] ${activeColor}` : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {key === "conversations" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-bar-bottom">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
