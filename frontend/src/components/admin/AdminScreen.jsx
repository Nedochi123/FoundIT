import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import AdminCashoutScreen from "./AdminCashoutScreen";
import AdminStatsScreen from "./AdminStatsScreen";
import AdminReportsScreen from "./AdminReportsScreen";
import AdminTagsScreen from "./AdminTagsScreen";
import AdminBoostsScreen from "./AdminBoostsScreen";

const TABS = [
  { key: "cashouts", label: "Cash-outs" },
  { key: "reports", label: "Reports" },
  { key: "impact", label: "Impact" },
  { key: "tags", label: "Tags" },
  { key: "boosts", label: "Boosts" },
];

// A link can open a section directly: /?admin=1&tab=boosts
function initialTab() {
  try {
    return new URLSearchParams(window.location.search).get("tab") || "cashouts";
  } catch {
    return "cashouts";
  }
}

export default function AdminScreen() {
  const [chosen, setTab] = useState(initialTab);
  // an unknown section name in the link falls back to the first one
  const tab = TABS.some((t) => t.key === chosen) ? chosen : "cashouts";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">Admin</h1>
          <p className="text-sm text-slate-300">Review cash-outs, reports, and the app's real-world impact.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40"
                : "bg-slate-800/50 text-slate-300 hover:text-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cashouts" ? (
        <AdminCashoutScreen />
      ) : tab === "reports" ? (
        <AdminReportsScreen />
      ) : tab === "tags" ? (
        <AdminTagsScreen />
      ) : tab === "boosts" ? (
        <AdminBoostsScreen />
      ) : (
        <AdminStatsScreen />
      )}
    </div>
  );
}
