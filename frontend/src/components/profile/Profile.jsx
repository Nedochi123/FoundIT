import { useState } from "react";
import { LogOut, Bell } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { enablePushNotifications, isIosNotStandalone, pushSupported } from "../../lib/push";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [idNumber, setIdNumber] = useState(user?.idNumber || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notifStatus, setNotifStatus] = useState("idle");

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateProfile({ name, idNumber: idNumber || undefined });
      setMessage("Saved.");
    } catch (err) {
      setMessage(err.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableNotifications() {
    if (isIosNotStandalone()) {
      setNotifStatus("ios-not-installed");
      return;
    }
    setNotifStatus("requesting");
    const result = await enablePushNotifications();
    setNotifStatus(result.ok ? "enabled" : result.reason);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">Profile</h1>
        <p className="mt-1 text-sm text-slate-300">{user?.email}</p>
      </div>

      <div className={cardClass}>
        <div className="mb-3 flex items-center gap-2 text-slate-100">
          <Bell className="h-4 w-4" />
          <p className="font-semibold text-sm">Notifications</p>
        </div>
        {notifStatus === "enabled" ? (
          <p className="text-sm text-emerald-400">You'll be notified when someone posts a lost or found item.</p>
        ) : notifStatus === "ios-not-installed" ? (
          <p className="text-sm text-slate-300">
            On iPhone, add FoundIT to your Home Screen first (Share → Add to Home Screen), then come back here to
            enable notifications — iOS only supports this after installing.
          </p>
        ) : notifStatus === "denied" ? (
          <p className="text-sm text-slate-300">
            Notifications are blocked. Enable them for FoundIT in your browser's site settings to turn this on.
          </p>
        ) : !pushSupported() ? (
          <p className="text-sm text-slate-300">Notifications aren't supported in this browser.</p>
        ) : (
          <button
            onClick={handleEnableNotifications}
            disabled={notifStatus === "requesting"}
            className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {notifStatus === "requesting" ? "Requesting..." : "Enable notifications"}
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className={`flex flex-col gap-4 ${cardClass}`}>
        <div>
          <label htmlFor="profile-name" className={labelClass}>
            Full name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="profile-idnumber" className={labelClass}>
            ID number
          </label>
          <input
            id="profile-idnumber"
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className={inputClass}
            placeholder="NUN/2024/001"
            pattern="[Nn][Uu][Nn]/\d{4}/\d{2,6}"
            title="Format: NUN/2024/001"
          />
          <p className="mt-1 text-xs text-slate-400">Format: NUN/2024/001</p>
        </div>
        {message && <p className="text-sm text-slate-300">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      <button
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>

      <p className="text-center text-xs text-slate-400">
        FoundIT is founded and created by Nedochi Publications.
      </p>
    </div>
  );
}
