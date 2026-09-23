import { useState, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import IntroAnimation from "./components/IntroAnimation";
import AuthGate from "./components/auth/AuthGate";
import Layout from "./components/layout/Layout";
import Home from "./components/Home";
import LostForm from "./components/lost/LostForm";
import FoundForm from "./components/found/FoundForm";
import Gallery from "./components/gallery/Gallery";
import ConversationList from "./components/messages/ConversationList";
import ConversationView from "./components/messages/ConversationView";
import Profile from "./components/profile/Profile";
import NotificationsPrompt from "./components/notifications/NotificationsPrompt";
import TokensScreen from "./components/tokens/TokensScreen";
import LegalScreen from "./components/legal/LegalScreen";

// Split out of the main bundle — the admin cash-out review screen is only
// ever loaded by one account, so every other visitor's initial load
// shouldn't pay to parse and ship its JS.
const AdminCashoutScreen = lazy(() => import("./components/admin/AdminCashoutScreen"));

// Supports a direct link into the Admin screen (?admin=1) — read once on
// mount so it still works after logging in, since the query string
// survives the login flow (no page navigation happens, just React state).
function getInitialView() {
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "1" ? "admin" : "home";
}

function Screens() {
  const { user } = useAuth();
  const [view, setView] = useState(getInitialView);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  function navigate(nextView) {
    setActiveConversationId(null);
    setView(nextView);
  }

  function openConversation(id) {
    setActiveConversationId(id);
    setView("conversation");
  }

  let content;
  if (view === "conversation" && activeConversationId) {
    content = (
      <ConversationView conversationId={activeConversationId} onBack={() => navigate("conversations")} />
    );
  } else if (view === "conversations") {
    content = <ConversationList onOpenConversation={openConversation} onUnreadChange={setUnreadCount} />;
  } else if (view === "gallery") {
    content = <Gallery onNavigate={navigate} onOpenConversation={openConversation} />;
  } else if (view === "lost") {
    content = <LostForm onNavigate={navigate} />;
  } else if (view === "found") {
    content = <FoundForm onNavigate={navigate} />;
  } else if (view === "profile") {
    content = <Profile onNavigate={navigate} />;
  } else if (view === "legal") {
    content = <LegalScreen onBack={() => navigate("profile")} />;
  } else if (view === "tokens") {
    content = <TokensScreen />;
  } else if (view === "admin") {
    content = user?.isAdmin ? (
      <Suspense fallback={<p className="text-sm text-slate-300">Loading...</p>}>
        <AdminCashoutScreen />
      </Suspense>
    ) : (
      <Home onNavigate={navigate} />
    );
  } else {
    content = (
      <>
        <NotificationsPrompt />
        <Home onNavigate={navigate} />
      </>
    );
  }

  // The bottom nav highlights "conversations" while viewing a single
  // thread too, since that's still the Messages tab conceptually.
  const activeTab = view === "conversation" ? "conversations" : view;

  return (
    <Layout view={activeTab} onNavigate={navigate} unreadCount={unreadCount}>
      {content}
    </Layout>
  );
}

const INTRO_SEEN_KEY = "foundit_intro_seen";

// The 2.8s animated intro is a nice first-impression moment, but it's
// pure unnecessary delay on every return visit for someone who already
// knows what FoundIT is — play it once per device, not on every open.
function getInitialShowIntro() {
  try {
    return !localStorage.getItem(INTRO_SEEN_KEY);
  } catch {
    return true;
  }
}

export default function App() {
  const [showIntro, setShowIntro] = useState(getInitialShowIntro);

  function handleIntroDone() {
    setShowIntro(false);
    try {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // Private browsing / storage quota — the intro just replays next
      // time, which is a harmless fallback, not a broken feature.
    }
  }

  return (
    <AuthProvider>
      {showIntro && <IntroAnimation onDone={handleIntroDone} />}
      <AuthGate>
        <Screens />
      </AuthGate>
    </AuthProvider>
  );
}
