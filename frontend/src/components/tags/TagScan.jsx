import { useCallback, useEffect, useRef, useState } from "react";
import { PackageCheck, CircleCheck, TriangleAlert, Loader2, MessagesSquare } from "lucide-react";
import { api } from "../../lib/api";
import TagChat from "./TagChat";
import Logo from "../theme/Logo";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const card = "rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/20 backdrop-blur";

const POLL_MS = 6000;
const storageKey = (code) => `foundit_tagchat_${String(code).toUpperCase()}`;

// The finder's secret chat token lives only in their own browser (it is how they get back into the chat).
function readToken(code) {
  try {
    return localStorage.getItem(storageKey(code)) || "";
  } catch {
    return "";
  }
}
function saveToken(code, token) {
  try {
    if (token) localStorage.setItem(storageKey(code), token);
    else localStorage.removeItem(storageKey(code));
  } catch {
    // Private browsing: the chat still works until this page is closed.
  }
}

function Shell({ children }) {
  return (
    <div className="min-h-app px-4 py-8">
      <div className="bg-glow" aria-hidden="true" />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <Logo className="h-8 w-8 rounded-[9px] shadow-md shadow-black/40" />
          <span className="text-lg font-extrabold tracking-tight text-slate-50">
            Found<span className="text-brand-teal">IT</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The page a finder lands on after scanning a "Return me" tag. No account needed: they message the owner
 * and chat privately here. Neither side sees the other's name or number unless they choose to share it.
 */
export default function TagScan({ code }) {
  const [info, setInfo] = useState(null); // { status, label }
  const [loadError, setLoadError] = useState("");
  const [token, setToken] = useState(() => readToken(code));
  const [chat, setChat] = useState(null); // { messages, open } once the finder has a chat
  const [checkingChat, setCheckingChat] = useState(() => Boolean(readToken(code)));
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState(""); // hidden field: only bots fill it in
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [botDone, setBotDone] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    let alive = true;
    api
      .getPublicTag(code)
      .then((data) => alive && setInfo(data))
      .catch((err) => {
        if (!alive) return;
        if (err.status === 404) setInfo({ status: "unknown" });
        else setLoadError("We couldn't load this tag. Please check your connection and try again.");
      });
    return () => {
      alive = false;
    };
  }, [code]);

  // Re-read the chat. A 404 means it no longer exists (the owner deleted it): forget the token.
  const refreshChat = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return;
    try {
      const data = await api.getTagChat(code, current);
      setChat({ messages: data.messages, open: data.open });
    } catch (err) {
      if (err.status === 404) {
        saveToken(code, "");
        setToken("");
        setChat(null);
      }
      // any other error (offline, server hiccup): keep what is on screen and try again on the next tick
    }
  }, [code]);

  // Coming back to a tag you already messaged: load that chat instead of the form.
  useEffect(() => {
    if (!info) return undefined; // still loading: keep showing the spinner, not the form
    if (!["active", "paused"].includes(info.status) || !token) {
      setCheckingChat(false);
      return undefined;
    }
    let alive = true;
    refreshChat().finally(() => alive && setCheckingChat(false));
    return () => {
      alive = false;
    };
  }, [info]);

  // While the chat is open, look for the owner's replies.
  const hasChat = Boolean(chat);
  useEffect(() => {
    if (!hasChat) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshChat();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [hasChat, refreshChat]);

  async function handleStart(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const data = await api.startTagChat(code, { message: message.trim(), website: trap || undefined });
      if (!data.token) {
        setBotDone(true); // only a bot gets here
        return;
      }
      saveToken(code, data.token);
      setToken(data.token);
      setChat({ messages: data.messages, open: data.open });
      setMessage("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(text) {
    const data = await api.sendTagChatMessage(code, token, text);
    setChat({ messages: data.messages, open: data.open });
  }

  async function handleShare(contact) {
    const data = await api.shareTagChatContact(code, token, contact);
    setChat({ messages: data.messages, open: data.open });
  }

  if (loadError) {
    return (
      <Shell>
        <div className={card}>
          <p className="text-sm text-slate-200">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-white">
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!info || checkingChat) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      </Shell>
    );
  }

  if (info.status === "unclaimed") {
    return (
      <Shell>
        <div className={card}>
          <h1 className="text-lg font-extrabold text-slate-50">This FoundIT tag isn't activated yet</h1>
          <p className="mt-2 text-sm text-slate-300">
            If this is your tag, sign in to FoundIT and activate it. Then anyone who finds your things can reach you without seeing your details.
          </p>
          <a
            href={`/?claim=${encodeURIComponent(code)}`}
            className="mt-4 inline-block rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-blue/20"
          >
            Activate this tag
          </a>
        </div>
      </Shell>
    );
  }

  // someone who already has a chat sees it, even if the owner has since paused the tag (they just can't write)
  if (chat) {
    return (
      <Shell>
        <div className={card}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30">
              <MessagesSquare className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight text-slate-50">Chat with the owner</h1>
              {info.label && (
                <p className="mt-1 text-sm text-slate-300">
                  Item: <span className="font-semibold text-slate-100">{info.label}</span>
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Thank you for helping! This chat is private between you and the owner, except that the FoundIT administrator can review chats for security. Keep this page open to see their replies, or scan the tag again later to come back to it.
          </p>
          <div className="mt-4">
            <TagChat
              messages={chat.messages}
              mySide="finder"
              onSend={handleSend}
              onShareContact={handleShare}
              open={chat.open}
              closedNote="The owner has paused this tag, so new messages can't be sent right now."
            />
          </div>
        </div>
      </Shell>
    );
  }

  if (info.status !== "active") {
    const unknown = info.status === "unknown";
    return (
      <Shell>
        <div className={card}>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-50">
            <TriangleAlert className="h-5 w-5 text-amber-400" />
            {unknown ? "We don't recognise this tag" : "This tag isn't taking messages right now"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {unknown
              ? "The code may be damaged or mistyped."
              : "The owner has paused it or no longer uses it."}{" "}
            If you found something that isn't yours, please hand it in to campus security.
          </p>
        </div>
      </Shell>
    );
  }

  if (botDone) {
    return (
      <Shell>
        <div className={card}>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-50">
            <CircleCheck className="h-5 w-5 text-emerald-400" /> Thank you!
          </h1>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={card}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30">
            <PackageCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-slate-50">You found something that belongs to someone!</h1>
            {info.label && <p className="mt-1 text-sm text-slate-300">Item: <span className="font-semibold text-slate-100">{info.label}</span></p>}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Send the owner a message and chat with them here to arrange getting it back. No account needed. Neither of you sees the other's name or number unless you choose to share it.
        </p>

        <form onSubmit={handleStart} className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="tag-message" className={labelClass}>Your message</label>
            <textarea id="tag-message" rows={3} required maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Where did you find it? Where can you meet them?" className={inputClass} />
          </div>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={sending || !message.trim()} className="rounded-lg bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 disabled:opacity-50">
            {sending ? "Sending..." : "Message the owner"}
          </button>
          <p className="text-xs text-slate-400">
            You never need to pay anything or give out bank details to return an item.
          </p>
        </form>
      </div>
    </Shell>
  );
}
