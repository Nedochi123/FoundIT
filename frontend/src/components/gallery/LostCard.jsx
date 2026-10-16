import { useState } from "react";
import { MapPin, Rocket, CheckCircle2, Flag, Hourglass, Search, TriangleAlert } from "lucide-react";
import { getCategoryIcon } from "../../lib/itemCategories";
import { timeAgo, timeLeft } from "../../lib/boosts";
import { formatNaira } from "../../lib/rewards";
import ReportDialog from "../shared/ReportDialog";

/**
 * One lost post on the Lost board. Boosted posts (paid) are pinned first and highlighted. The poster sees
 * their own post's boost state and can mark it found; everyone else sees "I found this".
 * boostEnabled: false until the admin has set up payments, so nobody is offered a boost that can't be paid yet.
 */
export default function LostCard({ item, currentUserId, boostEnabled, onBoost, onResolve, onFound, resolving }) {
  const [reporting, setReporting] = useState(false);
  const isOwn = item.posterId === currentUserId;
  const boosted = Boolean(item.boostedUntil);
  const urgent = item.urgent; // an "Urgently need" post: { reward } while its alert is live
  const CategoryIcon = item.category ? getCategoryIcon(item.category) : Search;
  const boost = item.boost; // only present on your own posts

  return (
    <div
      className={`rounded-xl border p-3.5 transition ${
        urgent
          ? "border-red-500/60 bg-slate-900"
          : boosted
            ? "border-amber-400/50 bg-slate-900"
            : "border-white/10 bg-slate-900"
      }`}
    >
      {urgent && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-red-400">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Urgent
          </span>
          <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-amber-950">
            {formatNaira(urgent.reward)} reward
          </span>
        </div>
      )}
      {boosted && (
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Rocket className="h-3.5 w-3.5" /> Boosted <span className="font-semibold normal-case tracking-normal text-slate-400">· {timeLeft(item.boostedUntil)}</span>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-inset ring-red-500/20">
          <CategoryIcon className="h-5 w-5 text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-50">{item.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            {item.location && (
              <>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {item.location}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>
              {isOwn ? "You" : item.posterName} · {timeAgo(item.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isOwn ? (
          <>
            {!boost && boostEnabled && (
              <button
                type="button"
                onClick={() => onBoost(item)}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98]"
              >
                <Rocket className="h-4 w-4" /> Boost this post
              </button>
            )}
            {boost?.state === "awaiting_payment" && (
              <button
                type="button"
                onClick={() => onBoost(item)}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98]"
              >
                <Rocket className="h-4 w-4" /> Finish paying for your boost
              </button>
            )}
            {boost?.state === "payment_claimed" && (
              <button
                type="button"
                onClick={() => onBoost(item)}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 text-xs font-semibold text-amber-300"
              >
                <Hourglass className="h-4 w-4" /> Checking your payment...
              </button>
            )}
            <button
              type="button"
              onClick={() => onResolve(item)}
              disabled={resolving}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> Mark as found
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onFound}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-btn px-3 text-xs font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
            >
              I found this
            </button>
            <button
              type="button"
              onClick={() => setReporting(true)}
              title="Report this post"
              aria-label="Report this post"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-red-400"
            >
              <Flag className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {reporting && <ReportDialog targetType="lost_item" targetId={item.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
