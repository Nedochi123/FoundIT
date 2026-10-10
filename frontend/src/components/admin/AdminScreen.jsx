import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import AdminCashoutScreen from "./AdminCashoutScreen";
import AdminStatsScreen from "./AdminStatsScreen";
import AdminReportsScreen from "./AdminReportsScreen";
import AdminTagsScreen from "./AdminTagsScreen";
import AdminBoostsScreen from "./AdminBoostsScreen";
import AdminActivityScreen from "./AdminActivityScreen";
import { useAuth } from "../../hooks/useAuth";

const TABS = [
  { key: "cashouts", label: "Cash-outs" },
  { key: "reports", label: "Reports" },
  { key: "impact", label: "Impact" },
  { key: "tags", label: "Tags" },
  { key: "boosts", label: "Boosts" },
];

// The security view is only offered to the monitor account (the owner), not to every admin.
const ACTIVITY_TAB = { key: "activity", label: "Activity" };

export default function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState("cashouts");
  const tabs = user?.isMonitor ? [...TABS, ACTIVITY_TAB] : TABS;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">Admin</h1>
          <p className="text-sm text-slate-300">Review cash-outs, reports, and the app's real-world impact.</p>
        </div>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Admin sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40"
                : "text-slate-400 hover:text-slate-200"
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
      ) : tab === "activity" && user?.isMonitor ? (
        <AdminActivityScreen />
      ) : (
        <AdminStatsScreen />
      )}
    </div>
  );
}
