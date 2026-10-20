import { useEffect, useState } from "react";
import { Search, Camera, Sparkles, TriangleAlert } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import ReunionCard from "./gallery/ReunionCard";
import { RewardsIntroCard } from "./rewards/RewardsGuide";
import { TagsAlertCard, TagsPromoCard } from "./tags/HomeTagsCards";
import HomeBoostedCards from "./boost/HomeBoostedCards";
import HomeUrgentCards from "./urgent/HomeUrgentCards";
import HomeSupportCard from "./support/HomeSupportCard";
import { UniversityIdentityCard } from "./school/UniversitySpace";

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
        <p className="mt-1 text-slate-300">What's going on today?</p>
      </div>

      <UniversityIdentityCard onShowPrivacy={() => onNavigate("legal")} />

      <HomeUrgentCards items={urgentLost} currentUserId={user?.id} onFound={() => onNavigate("found")} onSeeAll={seeLostBoard} />

      <TagsAlertCard tags={tags} onOpen={() => onNavigate("tags")} />

      <button
        onClick={() => onNavigate("lost")}
        className="group flex animate-fade-up items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-left shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-red-500/40 hover:bg-slate-900 hover:shadow-xl active:scale-[0.98]"
        style={{ "--delay": "0.08s" }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 ring-1 ring-inset ring-red-500/20 transition group-hover:ring-red-500/40">
          <Search className="h-6 w-6 text-red-400" strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-bold text-slate-50">I lost something</p>
          <p className="text-sm text-slate-300">Report it — we'll notify everyone and show you what's been found.</p>
        </div>
      </button>

      <button
        onClick={() => onNavigate("urgent")}
        className="group flex animate-fade-up items-center gap-4 rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-500/10 to-slate-900/70 p-5 text-left shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-red-400/70 hover:shadow-xl active:scale-[0.98]"
        style={{ "--delay": "0.12s" }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/25 to-red-500/5 ring-1 ring-inset ring-red-500/30">
          <TriangleAlert className="h-6 w-6 text-red-400" strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-bold text-slate-50">I urgently need something</p>
          <p className="text-sm text-slate-300">Offer a reward and alert everyone on FoundIT.</p>
        </div>
      </button>

      <button
        onClick={() => onNavigate("found")}
        className="group flex animate-fade-up items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-left shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-slate-900 hover:shadow-xl active:scale-[0.98]"
        style={{ "--delay": "0.16s" }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-1 ring-inset ring-emerald-500/20 transition group-hover:ring-emerald-500/40">
          <Camera className="h-6 w-6 text-emerald-400" strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-bold text-slate-50">I found something</p>
          <p className="text-sm text-slate-300">Take a photo and help it get back to its owner.</p>
        </div>
      </button>

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
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
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
