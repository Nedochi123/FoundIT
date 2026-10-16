import { useEffect, useState } from "react";
import { Search, Camera, ChevronRight, PackageCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import ReunionCard from "./gallery/ReunionCard";
import { RewardsIntroCard } from "./rewards/RewardsGuide";
import { TagsAlertCard, TagsPromoCard } from "./tags/HomeTagsCards";
import HomeBoostedCards from "./boost/HomeBoostedCards";
import HomeUrgentCards from "./urgent/HomeUrgentCards";
import HomeSupportCard from "./support/HomeSupportCard";

// The three things a student comes here to do. `key` is also the screen it opens.
const ACTIONS = [
  { key: "lost", title: "I lost something", note: "Report it. We alert students and show you what has been found.", Icon: Search, tone: "text-red-400" },
  { key: "found", title: "I found something", note: "Take a photo so its owner can find it.", Icon: Camera, tone: "text-emerald-400" },
  { key: "urgent", title: "I urgently need something", note: "Offer a reward and alert every student now.", Icon: TriangleAlert, tone: "text-red-400" },
];

export default function Home({ onNavigate }) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";
  const [reunions, setReunions] = useState([]);
  const [tags, setTags] = useState(null); // the student's QR tags (null until loaded)
  const [boostedLost, setBoostedLost] = useState([]); // other people's boosted lost posts
  const [supportUnread, setSupportUnread] = useState(0); // replies from the admin the student hasn't opened
  const [urgentLost, setUrgentLost] = useState([]); // open "Urgently need" alerts (the server lists them first)

  useEffect(() => {
    api
      .getReunitedItems()
      .then((data) => setReunions(data.items))
      .catch(() => {});
    api
      .getSupportUnread()
      .then((data) => setSupportUnread(data.unread))
      .catch(() => {});
    api
      .getMyTags()
      .then((data) => setTags(data.tags))
      .catch(() => {});
    api
      .listLostItems("open")
      .then((data) => {
        setUrgentLost(data.items.filter((i) => i.urgent));
        setBoostedLost(data.items.filter((i) => i.boostedUntil && !i.urgent && i.posterId !== user?.id).slice(0, 2));
      })
      .catch(() => {});
  }, []);

  function seeLostBoard() {
    try {
      sessionStorage.setItem("foundit_gallery_tab", "lost");
    } catch {
      // Private browsing: it opens on the Found side instead.
    }
    onNavigate("gallery");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-up" style={{ "--delay": "0s" }}>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Hi, {firstName}</h1>
        <p className="mt-1 text-slate-300">Lost something? Found something? Start here.</p>
      </div>

      <HomeUrgentCards items={urgentLost} currentUserId={user?.id} onFound={() => onNavigate("found")} onSeeAll={seeLostBoard} />

      <TagsAlertCard tags={tags} onOpen={() => onNavigate("tags")} />

      <div className="animate-fade-up divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-slate-900" style={{ "--delay": "0.08s" }}>
        {ACTIONS.map(({ key, title, note, Icon, tone }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] active:bg-white/[0.07]"
          >
            <Icon className={`h-5 w-5 shrink-0 ${tone}`} strokeWidth={2.2} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-slate-50">{title}</span>
              <span className="block text-sm text-slate-300">{note}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
          </button>
        ))}
      </div>

      <HomeSupportCard unread={supportUnread} onOpen={() => onNavigate("support")} />

      <HomeBoostedCards
        items={boostedLost}
        onFound={() => onNavigate("found")}
        onSeeAll={seeLostBoard}
      />

      <TagsPromoCard tags={tags} onOpen={() => onNavigate("tags")} />

      <RewardsIntroCard />

      {reunions.length > 0 && (
        <div className="animate-fade-up" style={{ "--delay": "0.24s" }}>
          <div className="mb-2.5 flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recently reunited</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {reunions.slice(0, 4).map((item) => (
              <ReunionCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
