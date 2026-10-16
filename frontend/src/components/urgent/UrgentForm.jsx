import { useState } from "react";
import { ArrowLeft, TriangleAlert, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { REWARD_AMOUNTS, formatNaira } from "../../lib/rewards";
import CategoryPicker from "../shared/CategoryPicker";
import LocationChips from "../shared/LocationChips";
import { RewardChips } from "../messages/RewardCard";
import { RewardsGuideLink } from "../rewards/RewardsGuide";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-red-400/60 focus:border-red-400";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";

/**
 * "I urgently need something": a lost post with a compulsory reward the student agrees to give whoever finds it.
 * The amount is shown to everyone, the money is paid privately, and publishing alerts every student.
 */
export default function UrgentForm({ onNavigate }) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [reward, setReward] = useState(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsIdNumber = !user?.idNumber;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (needsIdNumber && !idNumber.trim()) {
      setError("Your ID number is required so we know who's reporting this.");
      return;
    }
    if (!reward) {
      setError("Choose the reward you will give. It is required for an urgent request.");
      return;
    }
    if (!agree) {
      setError("Please tick the box to agree to give the reward.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createUrgentItem({
        description,
        location: location || undefined,
        category: category || undefined,
        idNumber: needsIdNumber ? idNumber : undefined,
        reward,
        agree: true,
      });
      try {
        sessionStorage.setItem("foundit_gallery_tab", "lost"); // open the Lost board, where the new alert is pinned first
      } catch {
        // Private browsing: it opens on the Found side instead.
      }
      onNavigate("gallery");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => onNavigate("home")} className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-500/15 to-transparent p-4">
        <TriangleAlert className="mt-0.5 h-7 w-7 shrink-0 text-red-400" strokeWidth={2.2} aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">I urgently need something</h1>
          <p className="mt-1 text-sm text-slate-300">
            For things you really can't do without. Everyone on FoundIT gets a warning alert with the reward you're offering,
            so the person who finds it knows it's worth taking back fast.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="urgent-description" className={labelClass}>
            What do you urgently need?
          </label>
          <textarea
            id="urgent-description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="e.g. My black laptop bag with my project in it. It has a red keychain on the zipper."
          />
        </div>
        <div>
          <label className={labelClass}>
            What kind of item? <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div>
          <label htmlFor="urgent-location" className={labelClass}>
            Where did you last have it? <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <LocationChips onPick={setLocation} />
          <input
            id="urgent-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
            placeholder="e.g. Faculty of Engineering, Room 204"
          />
        </div>

        {needsIdNumber && (
          <div>
            <label htmlFor="urgent-idnumber" className={labelClass}>
              Your ID number
            </label>
            <input
              id="urgent-idnumber"
              type="text"
              inputMode="numeric"
              maxLength={9}
              required
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              className={inputClass}
              placeholder="123456789"
              pattern="\d{9}"
              title="Format: 9 digits, e.g. 123456789"
            />
            <p className="mt-1 text-xs text-slate-400">Format: 9 digits. We'll remember this, so you won't be asked again.</p>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] p-3.5">
          <p className="text-sm font-semibold text-slate-50">
            Reward for whoever finds it <span className="font-normal text-red-300">(required)</span>
          </p>
          <RewardChips
            options={REWARD_AMOUNTS}
            value={reward}
            onChange={(amount) => {
              setReward(amount);
              setError("");
            }}
            allowNone={false}
          />
          <p className="text-xs text-slate-300">
            The amount is shown publicly on your alert. The money itself is sent privately: you pay the finder directly, and FoundIT
            never handles it.
          </p>
          <RewardsGuideLink>How rewards work</RewardsGuideLink>
        </div>

        <label htmlFor="urgent-agree" className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3.5">
          <input
            id="urgent-agree"
            type="checkbox"
            checked={agree}
            onChange={(e) => {
              setAgree(e.target.checked);
              setError("");
            }}
            className="mt-0.5 h-5 w-5 shrink-0 accent-red-500"
          />
          <span className="text-sm text-slate-200">
            I agree that if someone finds my item and returns it to me, I will give them{" "}
            <span className="font-bold text-amber-300">{reward ? formatNaira(reward) : "the reward I chose"}</span>. I will pay them myself,
            directly, once I have my item back. I understand the amount is shown to everyone and that everyone on FoundIT will be alerted.
          </span>
        </label>

        <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" /> Only people who return your item should get the reward. Never share your PIN,
          OTP or card details with anyone.
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 py-3 font-semibold text-white shadow-lg shadow-red-950/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          <TriangleAlert className="h-5 w-5" />
          {submitting ? "Publishing..." : "Publish urgent alert"}
        </button>
      </form>
    </div>
  );
}
