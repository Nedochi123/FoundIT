import { useState } from "react";
import { QrCode, X, MessagesSquare } from "lucide-react";

const PROMO_KEY = "foundit_tags_promo_v1";

/**
 * Shown at the top of Home when someone has scanned one of the student's tags and written to them: the
 * moment that matters most, so it comes first. `tags` is the student's tags from the API (null while loading).
 */
export function TagsAlertCard({ tags, onOpen }) {
  const waiting = (tags || []).filter((t) => t.unreadCount > 0);
  if (waiting.length === 0) return null;

  const unread = waiting.reduce((sum, t) => sum + t.unreadCount, 0);
  const about = waiting.length === 1 ? waiting[0].label || "FoundIT tag" : "tags";

  return (
    <div
      role="status"
      className="animate-fade-up rounded-2xl border border-brand-teal/50 bg-gradient-to-br from-brand-teal/20 to-transparent p-4 shadow-lg shadow-black/20"
      style={{ "--delay": "0.04s" }}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/20 ring-1 ring-inset ring-brand-teal/40">
          <MessagesSquare className="h-5 w-5 text-brand-teal" />
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-bar-bottom">
            {unread > 9 ? "9+" : unread}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-teal">Someone found your item</p>
          <p className="font-bold text-slate-50">
            {unread === 1 ? "1 new message" : `${unread} new messages`} about your {about}
          </p>
          <p className="text-sm text-slate-300">They are waiting for your reply. Chats are private: you only share your number if you choose to.</p>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2.5 min-h-11 rounded-lg bg-brand-gradient px-4 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-95"
          >
            Open chat
          </button>
        </div>
      </div>
    </div>
  );
}

/** Home: tells students who have no tag yet what a FoundIT QR tag is. Dismissible; Profile keeps a link to it. */
export function TagsPromoCard({ tags, onOpen }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(PROMO_KEY) === "1";
    } catch {
      return false;
    }
  });
  // only for students who have loaded and have no tags: anyone with a tag already knows
  if (hidden || !tags || tags.length > 0) return null;

  function dismiss() {
    try {
      localStorage.setItem(PROMO_KEY, "1");
    } catch {
      /* private browsing: it just shows again next visit */
    }
    setHidden(true);
  }

  return (
    <div
      className="relative animate-fade-up rounded-2xl border border-brand-teal/25 bg-gradient-to-br from-brand-teal/10 to-transparent p-4"
      style={{ "--delay": "0.2s" }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/15 ring-1 ring-inset ring-brand-teal/30">
          <QrCode className="h-5 w-5 text-brand-teal" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-teal">Protect your things</p>
          <p className="font-bold text-slate-50">Put a FoundIT tag on your laptop or bag</p>
          <p className="text-sm text-slate-300">
            If someone finds it, they scan the sticker and chat with you privately. You never share your number unless you want to.
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2.5 min-h-11 rounded-lg bg-brand-gradient px-4 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-95"
          >
            Set up a tag
          </button>
        </div>
      </div>
    </div>
  );
}
