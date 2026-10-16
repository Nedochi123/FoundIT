import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, PartyPopper, Coins, Flag, TriangleAlert } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import ReportDialog from "../shared/ReportDialog";
import Confetti from "../shared/Confetti";
import RewardCard, { RewardChips, naira } from "./RewardCard";
import { RewardsGuideLink } from "../rewards/RewardsGuide";

function formatTime(iso) {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ConversationView({ conversationId, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isSeeker, setIsSeeker] = useState(false);
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [otherUserId, setOtherUserId] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [thankYouNote, setThankYouNote] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [reward, setReward] = useState(null); // the voluntary thank-you reward, if one was chosen
  const [canOfferReward, setCanOfferReward] = useState(false);
  const [rewardOptions, setRewardOptions] = useState([]);
  const [rewardChoice, setRewardChoice] = useState(null); // chosen while confirming the return (null = no reward)
  // the owner's open "Urgently need" post, if they have one: confirming this return can settle its promised reward
  const [urgentOffer, setUrgentOffer] = useState(null);
  const [thisIsUrgent, setThisIsUrgent] = useState(true);
  const bottomRef = useRef(null);

  async function load() {
    const data = await api.getMessages(conversationId);
    setMessages(data.messages);
    setIsSeeker(data.isSeeker);
    setReturnConfirmed(data.returnConfirmed);
    setOtherUserId(data.otherUserId);
    setReward(data.reward || null);
    setCanOfferReward(!!data.canOfferReward);
    setRewardOptions(data.rewardOptions || []);
    setUrgentOffer(data.urgentOffer || null);
  }

  usePolling(load, 4000, [conversationId]);

  const usingUrgent = Boolean(urgentOffer) && thisIsUrgent;

  async function handleConfirmReturn() {
    setConfirming(true);
    setError("");
    try {
      await api.confirmReturn(
        conversationId,
        thankYouNote.trim(),
        usingUrgent ? null : rewardChoice,
        usingUrgent ? urgentOffer.lostItemId : null
      );
      setReturnConfirmed(true);
      setJustConfirmed(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      load().catch(() => {}); // show the reward card (and the chat message) straight away
    } catch (err) {
      setError(err.message || "Couldn't confirm the return. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError("");
    setDraft("");
    try {
      const { message } = await api.sendMessage(conversationId, body);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err.message || "Message didn't send. Try again.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-chat flex-col">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to messages
        </button>
        {otherUserId && (
          <button
            onClick={() => setReporting(true)}
            title="Report this user"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-400"
          >
            <Flag className="h-3.5 w-3.5" /> Report
          </button>
        )}
      </div>

      {showConfetti && <Confetti />}

      <p className="mb-2 text-[11px] text-slate-500">Private between you two. For everyone's safety, the FoundIT administrator can review chats.</p>

      {justConfirmed ? (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
          <PartyPopper className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-100">
            Return confirmed — the finder just earned <span className="font-bold text-amber-300">+2 tokens</span>.
          </p>
        </div>
      ) : isSeeker && !returnConfirmed ? (
        <div className="mb-3 flex flex-col gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-50">Got your item back?</p>
            <p className="text-xs text-slate-300">Confirming awards the finder 2 tokens.</p>
          </div>
          <input
            type="text"
            value={thankYouNote}
            onChange={(e) => setThankYouNote(e.target.value)}
            maxLength={280}
            aria-label="Thank-you note (optional)"
            placeholder="Leave a thank-you note for them (optional)"
            className="w-full rounded-lg border border-amber-400/20 bg-slate-900/50 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
          {urgentOffer && (
            <label
              htmlFor="this-is-urgent"
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5"
            >
              <input
                id="this-is-urgent"
                type="checkbox"
                checked={thisIsUrgent}
                onChange={(e) => setThisIsUrgent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-red-500"
              />
              <span className="text-xs text-slate-200">
                <span className="flex items-center gap-1 font-bold text-slate-50">
                  <TriangleAlert className="h-3.5 w-3.5 text-red-400" aria-hidden="true" /> This is what I urgently needed
                </span>
                You promised <span className="font-bold text-amber-300">{naira(urgentOffer.reward)}</span> for "
                {urgentOffer.description.length > 50 ? urgentOffer.description.slice(0, 50) + "…" : urgentOffer.description}". Confirming
                gives the finder that reward and ends your alert.
              </span>
            </label>
          )}
          {!usingUrgent && rewardOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-slate-100">
                Say thanks with a reward? <span className="font-normal text-slate-400">(optional)</span>
              </p>
              <RewardChips options={rewardOptions} value={rewardChoice} onChange={setRewardChoice} />
              <p className="text-[11px] text-slate-400">
                A voluntary thank-you. You would pay the finder yourself, directly; FoundIT never handles the money.
              </p>
              <RewardsGuideLink>How rewards work</RewardsGuideLink>
            </div>
          )}
          <button
            onClick={handleConfirmReturn}
            disabled={confirming}
            className="flex items-center justify-center gap-1.5 self-end rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2 text-xs font-bold text-amber-950 transition hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            <Coins className="h-3.5 w-3.5" />
            {confirming
              ? "Confirming..."
              : usingUrgent
                ? `Confirm + ${naira(urgentOffer.reward)} reward`
                : rewardChoice
                  ? `Confirm + ${naira(rewardChoice)} reward`
                  : "Confirm"}
          </button>
        </div>
      ) : null}

      <RewardCard
        conversationId={conversationId}
        reward={reward}
        canOffer={canOfferReward && isSeeker}
        options={rewardOptions}
        isOwner={isSeeker}
        onChange={() => load().catch(() => {})}
      />

      <div className="flex-1 space-y-2 overflow-y-auto pb-3">
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-brand-gradient text-white shadow-md shadow-brand-blue/20" : "bg-slate-800 text-slate-100 border border-slate-700"
                }`}
              >
                <p>{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-cyan-100/80" : "text-slate-400"}`}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/10 pt-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Message"
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {reporting && otherUserId && (
        <ReportDialog targetType="user" targetId={otherUserId} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}
