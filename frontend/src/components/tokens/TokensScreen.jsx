import { useEffect, useState } from "react";
import { Coins, ArrowUpRight, ArrowDownRight, Sparkles, Trophy } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import CashoutForm from "./CashoutForm";
import { RewardsGuideLink } from "../rewards/RewardsGuide";

const MEDALS = ["🥇", "🥈", "🥉"];

const TIERS = [
  { tokens: 50, naira: 5000 },
  { tokens: 100, naira: 10000 },
];

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TokensScreen() {
  const { user, refreshMe } = useAuth();
  const [tokens, setTokens] = useState(null);
  const [entries, setEntries] = useState([]);
  const [cashoutRequests, setCashoutRequests] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashoutTier, setCashoutTier] = useState(null);

  async function load() {
    const [ledger, requests, board] = await Promise.all([
      api.getTokenLedger(),
      api.getCashoutRequests(),
      api.getLeaderboard(),
    ]);
    setTokens(ledger.tokens);
    setEntries(ledger.entries);
    setCashoutRequests(requests.requests);
    setLeaderboard(board.leaderboard);
  }

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCashoutDone() {
    setCashoutTier(null);
    await load();
    await refreshMe();
  }

  if (loading) return <p className="text-sm text-slate-300">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">Tokens</h1>
        <p className="mt-1 text-sm text-slate-300">
          Earn 2 tokens every time someone confirms you returned their item.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-slate-900/70 to-slate-900/70 p-6 text-center shadow-lg shadow-black/30">
        <div
          className="pointer-events-none absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #f2b73d 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 shadow-lg shadow-amber-900/50 ring-2 ring-amber-200/40">
            <Coins className="h-7 w-7 text-amber-950" strokeWidth={2.2} />
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br [--tw-gradient-from:rgb(var(--tokens-from,253_230_138))] [--tw-gradient-to:rgb(var(--tokens-to,234_179_8))] [--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)]">
            {tokens}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-200 opacity-80">tokens earned</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TIERS.map((tier) => {
          const progress = Math.min(100, Math.round(((tokens || 0) / tier.tokens) * 100));
          const eligible = (tokens || 0) >= tier.tokens;
          return (
            <div
              key={tier.tokens}
              className={`rounded-xl border p-4 ${
                eligible ? "border-amber-400/40 bg-amber-500/[0.06]" : "border-white/10 bg-slate-900/70"
              }`}
            >
              <p className="text-sm font-bold text-slate-50">{tier.tokens} tokens</p>
              <p className="text-xs text-slate-300">₦{tier.naira.toLocaleString()}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                onClick={() => setCashoutTier(tier.tokens)}
                disabled={!eligible}
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 py-2 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Cash out
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3">
        <p className="text-sm text-slate-200">Got your item back? You can say thanks with a reward.</p>
        <RewardsGuideLink>How it works</RewardsGuideLink>
      </div>

      {leaderboard.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Top finders</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 divide-y divide-white/5">
            {leaderboard.map((row, i) => (
              <div
                key={`${row.name}-${i}`}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  row.name === user?.name ? "bg-amber-500/[0.06]" : ""
                }`}
              >
                <span className="w-6 shrink-0 text-center text-sm">
                  {MEDALS[i] || <span className="text-xs font-semibold text-slate-500">{i + 1}</span>}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-slate-100">{row.name}</p>
                <p className="shrink-0 text-xs font-semibold text-slate-400">
                  {row.finds} {row.finds === 1 ? "find" : "finds"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {cashoutTier && (
        <CashoutForm tier={cashoutTier} maxNaira={TIERS.find((t) => t.tokens === cashoutTier).naira} onCancel={() => setCashoutTier(null)} onDone={handleCashoutDone} />
      )}

      {cashoutRequests.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Cash-out requests</p>
          <div className="flex flex-col gap-2">
            {cashoutRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-50">₦{r.amountNaira.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{timeAgo(r.createdAt)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    r.status === "paid"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : r.status === "rejected"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">History</p>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 py-10 text-center">
            <Sparkles className="h-7 w-7 text-slate-500" />
            <p className="text-sm text-slate-300">No token activity yet.</p>
            <p className="text-xs text-slate-400">Post a found item and get it confirmed returned to earn some.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    e.delta > 0 ? "bg-emerald-500/15" : "bg-slate-700/50"
                  }`}
                >
                  {e.delta > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-100">{e.note}</p>
                  <p className="text-xs text-slate-400">{timeAgo(e.createdAt)}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold ${e.delta > 0 ? "text-emerald-400" : "text-slate-300"}`}>
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
