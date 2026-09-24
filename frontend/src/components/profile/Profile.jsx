import { useEffect, useState } from "react";
import { LogOut, Bell, MailCheck, Award, MessageSquareHeart } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { enablePushNotifications, isIosNotStandalone, pushSupported } from "../../lib/push";
import { api } from "../../lib/api";
import ChangePasswordForm from "./ChangePasswordForm";
import DeleteAccountForm from "./DeleteAccountForm";

function PreferenceToggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1.5"
    >
      <span className="text-sm text-slate-200">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-brand-teal" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";

export default function Profile({ onNavigate }) {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [idNumber, setIdNumber] = useState(user?.idNumber || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notifStatus, setNotifStatus] = useState("idle");
  const [notifDetail, setNotifDetail] = useState("");
  const [resendStatus, setResendStatus] = useState("idle");
  const [prefs, setPrefs] = useState(null);
  const [badges, setBadges] = useState([]);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    api
      .getPushPreferences()
      .then(setPrefs)
      .catch(() => {});
    api
      .getMyBadges()
      .then((data) => setBadges(data.badges))
      .catch(() => {});
    api
      .getMyNotes()
      .then((data) => setNotes(data.notes))
      .catch(() => {});
  }, []);

  async function handlePrefChange(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await api.updatePushPreferences({ notifyLost: next.notifyLost, notifyFound: next.notifyFound });
    } catch {
      setPrefs(prefs);
    }
  }

  async function handleResendVerification() {
    setResendStatus("sending");
    try {
      await api.resendVerification();
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
    }
  }

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
    setNotifDetail(result.detail || "");
    if (result.ok) {
      api
        .getPushPreferences()
        .then(setPrefs)
        .catch(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-50">Profile</h1>
        <p className="mt-1 text-sm text-slate-300">{user?.email}</p>
      </div>

      {(badges.length > 0 || notes.length > 0) && (
        <div className={cardClass}>
          {badges.length > 0 && (
            <div className={notes.length > 0 ? "mb-4" : ""}>
              <div className="mb-2 flex items-center gap-2 text-slate-100">
                <Award className="h-4 w-4 text-amber-400" />
                <p className="text-sm font-semibold">Badges</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {notes.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-slate-100">
                <MessageSquareHeart className="h-4 w-4 text-brand-teal" />
                <p className="text-sm font-semibold">Notes you've received</p>
              </div>
              <div className="flex flex-col gap-2">
                {notes.map((n, i) => (
                  <div key={i} className="rounded-lg bg-slate-800/50 px-3 py-2">
                    <p className="text-sm text-slate-200">"{n.note}"</p>
                    <p className="mt-0.5 text-xs text-slate-400">— {n.fromName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!user?.emailVerified && (
        <div className={cardClass}>
          <div className="mb-2 flex items-center gap-2 text-slate-100">
            <MailCheck className="h-4 w-4" />
            <p className="text-sm font-semibold">Verify your email</p>
          </div>
          {resendStatus === "sent" ? (
            <p className="text-sm text-emerald-400">
              Sent — check {user?.email} (and your spam folder) for the link.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-300">
                We emailed you a verification link when you signed up. Didn't get it?
              </p>
              <button
                onClick={handleResendVerification}
                disabled={resendStatus === "sending"}
                className="self-start rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
              >
                {resendStatus === "sending" ? "Sending..." : "Resend verification email"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className={cardClass}>
        <div className="mb-3 flex items-center gap-2 text-slate-100">
          <Bell className="h-4 w-4" />
          <p className="font-semibold text-sm">Notifications</p>
        </div>
        {notifStatus === "enabled" || prefs?.hasSubscription ? (
          <div className="flex flex-col gap-1 divide-y divide-white/5">
            <PreferenceToggle
              label="Lost item alerts"
              checked={prefs?.notifyLost ?? true}
              onChange={(v) => handlePrefChange("notifyLost", v)}
            />
            <PreferenceToggle
              label="Found item alerts"
              checked={prefs?.notifyFound ?? true}
              onChange={(v) => handlePrefChange("notifyFound", v)}
            />
          </div>
        ) : notifStatus === "ios-not-installed" ? (
          <p className="text-sm text-slate-300">
            On iPhone, add FoundIT to your Home Screen first (Share → Add to Home Screen), then come back here to
            enable notifications — iOS only supports this after installing.
          </p>
        ) : notifStatus === "denied" ? (
          <p className="text-sm text-slate-300">
            Notifications are blocked. Enable them for FoundIT in your browser's site settings to turn this on.
          </p>
        ) : notifStatus === "subscribe_failed" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-300">
              Something went wrong turning this on{notifDetail ? `: ${notifDetail}` : ""}.
            </p>
            <button
              onClick={handleEnableNotifications}
              className="self-start rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
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
            inputMode="numeric"
            maxLength={9}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className={inputClass}
            placeholder="123456789"
            pattern="\d{9}"
            title="Format: 9 digits, e.g. 123456789"
          />
          <p className="mt-1 text-xs text-slate-400">Format: 9 digits, e.g. 123456789</p>
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

      <ChangePasswordForm />

      <button
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>

      <button
        onClick={() => onNavigate?.("legal")}
        className="text-center text-xs text-slate-400 underline hover:text-slate-200"
      >
        Privacy &amp; Terms
      </button>

      <DeleteAccountForm />

      <p className="text-center text-xs text-slate-400">
        FoundIT is founded and created by Nedochi Publications.
      </p>
    </div>
  );
}
