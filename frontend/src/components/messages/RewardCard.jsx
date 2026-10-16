import { useState } from "react";
import { Gift, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import { RewardsGuideLink } from "../rewards/RewardsGuide";

export const naira = (n) => `₦${Number(n).toLocaleString()}`;

/** The row of amount buttons. `value` is null for "No reward". */
export function RewardChips({ options, value, onChange, allowNone = true }) {
  const chip = (selected) =>
    `min-h-9 rounded-full border px-3 text-xs font-semibold transition ${
      selected
        ? "border-amber-400 bg-amber-400 text-amber-950"
        : "border-amber-400/30 bg-slate-900 text-slate-100 hover:border-amber-400/60"
    }`;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reward amount">
      {allowNone && (
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
          No reward
        </button>
      )}
      {options.map((amount) => (
        <button key={amount} type="button" aria-pressed={value === amount} onClick={() => onChange(amount)} className={chip(value === amount)}>
          {naira(amount)}
        </button>
      ))}
    </div>
  );
}

const SAFETY =
  "Never share your PIN, OTP, BVN or card details. FoundIT doesn't handle this money, so it can't refund or reverse it. Only share account details here, with this person.";

/**
 * The reward inside a chat. The owner picks an amount (at confirmation, or afterwards), the finder
 * sends their account details in the chat, the owner pays them directly and taps "I've sent it", and
 * the finder taps "I received it". FoundIT only records the amount and these steps.
 */
export default function RewardCard({ conversationId, reward, canOffer, options, isOwner, onChange }) {
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      onChange();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const box = "mb-3 flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3";
  const button =
    "self-end rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-95 disabled:opacity-60";

  if (!reward && canOffer) {
    return (
      <div className={box}>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-50">
            <Gift className="h-4 w-4 text-amber-300" /> Say thank you with a reward?
          </p>
          <p className="text-xs text-slate-300">Optional. You choose the amount and pay the finder yourself.</p>
        </div>
        <RewardChips options={options} value={choice} onChange={setChoice} allowNone={false} />
        {choice && (
          <button type="button" disabled={busy} onClick={() => run(() => api.giveReward(conversationId, choice))} className={button}>
            {busy ? "Saving..." : `Give ${naira(choice)} reward`}
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="flex items-start gap-1.5 text-xs text-slate-400">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" /> {SAFETY}
        </p>
        <RewardsGuideLink>How rewards work</RewardsGuideLink>
      </div>
    );
  }
  if (!reward) return null;

  const amount = naira(reward.amount);
  let title;
  let text;
  let action = null;
  if (reward.status === "promised") {
    title = isOwner ? `Your ${amount} thank-you reward` : `${amount} thank-you reward for you`;
    text = isOwner
      ? "Next: the finder will send you their account details in this chat. Send the money to them yourself, then tap the button."
      : "Next: send the owner your account details in this chat (bank and account number, or a phone number). They will pay you directly.";
    if (isOwner) action = ["I've sent it", () => api.markRewardSent(conversationId)];
  } else if (reward.status === "sent") {
    title = isOwner ? `You said you sent ${amount}` : `${amount} is on its way`;
    text = isOwner
      ? "Waiting for the finder to confirm it arrived."
      : "The owner says they sent it. Check your account, then tap the button.";
    if (!isOwner) action = ["I received it", () => api.markRewardReceived(conversationId)];
  } else {
    title = `✅ ${amount} reward received`;
    text = "Thank you for being so kind and honest!";
  }

  return (
    <div className={box}>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-50">
          <Gift className="h-4 w-4 text-amber-300" /> {title}
        </p>
        <p className="text-xs text-slate-300">{text}</p>
      </div>
      {action && (
        <button type="button" disabled={busy} onClick={() => run(action[1])} className={button}>
          {busy ? "Saving..." : action[0]}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {reward.status !== "received" && (
        <p className="flex items-start gap-1.5 text-xs text-slate-400">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" /> {SAFETY}
        </p>
      )}
      <RewardsGuideLink>How rewards work</RewardsGuideLink>
    </div>
  );
}
