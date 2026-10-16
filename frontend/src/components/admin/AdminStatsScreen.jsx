import { useEffect, useState } from "react";
import { Users, PackageCheck, HandHeart, Coins, Wallet2 } from "lucide-react";
import { api } from "../../lib/api";

const cardClass = "rounded-xl border border-white/10 bg-slate-900 p-4";

function monthLabel(ym) {
  if (!ym) return "";
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

// Merges up to three monthly {month, count} series onto one shared
// month axis (some months may have activity in one series but not
// another), so every series lines up under the same set of bars.
function mergeMonths(...seriesList) {
  const months = new Set();
  for (const series of seriesList) {
    for (const row of series) months.add(row.month);
  }
  return [...months].sort();
}

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className={cardClass}>
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-slate-50">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

// Hand-rolled SVG bar chart — the dataset here is small (monthly
// buckets for a campus-scale app), so a charting library would be a lot
// of weight for something this simple to draw directly.
function BarChart({ months, series, height = 140 }) {
  const max = Math.max(1, ...series.flatMap((s) => months.map((m) => s.values[m] || 0)));
  const barGroupWidth = 100 / Math.max(months.length, 1);

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {months.map((m, i) => {
          const groupX = i * barGroupWidth;
          const barWidth = barGroupWidth / (series.length + 1);
          return (
            <g key={m}>
              {series.map((s, si) => {
                const value = s.values[m] || 0;
                const barHeight = (value / max) * (height - 20);
                const x = groupX + barWidth * (si + 0.5);
                return (
                  <rect
                    key={s.label}
                    x={x}
                    y={height - 16 - barHeight}
                    width={Math.max(barWidth - 1, 0.5)}
                    height={barHeight}
                    rx="1"
                    fill={s.color}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex text-[9px] text-slate-500">
        {months.map((m) => (
          <span key={m} style={{ width: `${barGroupWidth}%` }} className="truncate text-center">
            {monthLabel(m)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminStatsScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getAdminStats()
      .then((data) => setStats(data))
      .catch((err) => setError(err.message || "Couldn't load stats."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-300">Loading...</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!stats) return null;

  const { totals, monthly } = stats;

  const activityMonths = mergeMonths(monthly.foundItems, monthly.confirmedReturns);
  const activitySeries = [
    {
      label: "Items found",
      color: "#2467e6",
      values: Object.fromEntries(monthly.foundItems.map((r) => [r.month, r.count])),
    },
    {
      label: "Confirmed returns",
      color: "#17b8ae",
      values: Object.fromEntries(monthly.confirmedReturns.map((r) => [r.month, r.count])),
    },
  ];

  const signupMonths = mergeMonths(monthly.signups);
  const signupSeries = [
    {
      label: "New signups",
      color: "#f59e0b",
      values: Object.fromEntries(monthly.signups.map((r) => [r.month, r.count])),
    },
  ];

  const returnRate =
    totals.foundItems > 0 ? Math.round((totals.confirmedReturns / totals.foundItems) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-bold text-slate-100">Community impact</h2>
        <p className="text-xs text-slate-400">
          Everything below is pulled live from real activity — nothing is tracked separately.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={Users} label="Students signed up" value={totals.users} accent="bg-blue-500/15 text-blue-300" />
        <StatTile
          icon={PackageCheck}
          label="Items reported found"
          value={totals.foundItems}
          accent="bg-brand-teal/15 text-brand-teal"
        />
        <StatTile
          icon={HandHeart}
          label="Confirmed returns"
          value={totals.confirmedReturns}
          accent="bg-emerald-500/15 text-emerald-400"
        />
        <StatTile
          icon={Coins}
          label="Tokens awarded"
          value={totals.tokensAwarded}
          accent="bg-amber-500/15 text-amber-300"
        />
      </div>

      <div className={cardClass}>
        <p className="text-xs text-slate-400">Return rate</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-50">{returnRate}%</p>
        <p className="mt-1 text-xs text-slate-400">
          of found items reported have led to a confirmed return so far.
        </p>
      </div>

      <div className={cardClass}>
        <div className="mb-3 flex items-center gap-2">
          <Wallet2 className="h-4 w-4 text-amber-300" />
          <p className="text-sm font-semibold text-slate-100">
            ₦{totals.nairaPaidOut.toLocaleString()} paid out to students
          </p>
        </div>
        <p className="text-xs text-slate-400">Total across all approved cash-out requests.</p>
      </div>

      {activityMonths.length > 0 && (
        <div className={cardClass}>
          <p className="mb-3 text-sm font-semibold text-slate-100">Found items vs. confirmed returns</p>
          <BarChart months={activityMonths} series={activitySeries} />
        </div>
      )}

      {signupMonths.length > 0 && (
        <div className={cardClass}>
          <p className="mb-3 text-sm font-semibold text-slate-100">Sign-ups by month</p>
          <BarChart months={signupMonths} series={signupSeries} />
        </div>
      )}
    </div>
  );
}
