import NavBar from "./NavBar";

export default function Layout({ view, onNavigate, unreadCount, children }) {
  return (
    <div className="min-h-screen pb-20">
      <div className="bg-glow" aria-hidden="true" />
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#05070dcc] backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <img src="/brand/foundit-icon.png" alt="" className="h-7 w-7 rounded-[8px] shadow-md shadow-black/40" />
          <span className="text-[15px] font-extrabold tracking-tight text-slate-50">
            Found<span className="text-brand-teal">IT</span>
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 pt-6">{children}</div>
      <NavBar view={view} onNavigate={onNavigate} unreadCount={unreadCount} />
    </div>
  );
}
