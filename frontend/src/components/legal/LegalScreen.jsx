import { ArrowLeft } from "lucide-react";

const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-sm font-bold text-slate-100">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

// Plain-language privacy notice + terms, specific to what FoundIT
// actually collects and does today — not a generic template. Update
// this alongside any change to what data is collected or how the
// token/cash-out system works.
export default function LegalScreen({ onBack }) {
  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-slate-50">Privacy &amp; Terms</h1>
        <p className="mt-1 text-sm text-slate-400">Last updated 8 October 2026</p>
      </div>

      <div className={`flex flex-col gap-5 ${cardClass}`}>
        <Section title="What FoundIT is">
          <p>
            FoundIT is a lost-and-found service for the Nile University community, built and run by
            Nedochi Publications. It is not an official Nile University system.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            <span className="font-semibold text-slate-200">Account details:</span> your name, university
            email, password (stored as a one-way hash, never in readable form), and an optional ID number.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Item reports:</span> descriptions, locations,
            and photos you post for lost or found items.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Messages:</span> conversations between a finder
            and a seeker about a specific item.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Cash-out requests:</span> if you request a token
            cash-out, your bank name, account number, and account name — used only to pay that request.
          </p>
          <p>
            <span className="font-semibold text-slate-200">Notifications:</span> if you enable push
            notifications, a device subscription used to alert you about new reports.
          </p>
        </Section>

        <Section title="Who can see what">
          <p>
            A found item's description, location, photo, and your name are visible to everyone signed in,
            so a seeker can recognize and message you. Messages inside a conversation are private between
            its two participants — no one else, including other students, can read them.
          </p>
          <p>
            Your ID number and any bank details you submit for a cash-out are visible only to FoundIT
            admins reviewing that request, never to other students.
          </p>
        </Section>

        <Section title="The token and cash-out system">
          <p>
            Tokens are awarded automatically (2 per confirmed find) only when the person who lost an item
            confirms in-app that it was returned to them — a finder cannot award themselves tokens.
          </p>
          <p>
            Cashing out is a request, not an automatic payment: an admin manually reviews it and pays out
            by real bank transfer. Submitting a request does not guarantee approval or a payout timeline.
            Misuse of the system (for example, fake found-item posts or colluding to confirm a return that
            didn't happen) can result in a rejected request, forfeited tokens, or account suspension.
          </p>
        </Section>

        <Section title="Thank-you rewards">
          <p>
            After the person who lost an item confirms it was returned, they may choose to say thank you
            with a voluntary cash reward (₦3,000 to ₦20,000). It is always optional and entirely between
            the two students: the owner pays the finder directly, for example by bank transfer, after the
            finder shares their account details in that private chat.
          </p>
          <p>
            FoundIT does not collect, hold or send this money, does not store bank or card details for
            rewards, and cannot refund, reverse or settle a dispute about one. We only record the amount
            chosen and whether it was marked sent and received. Anything you type in a chat, including
            account details you choose to share, stays in that conversation like any message, so only share
            them with the person you are paying or being paid by, and never share a PIN, OTP, BVN or card
            details with anyone. Never pay anyone a reward before you have your item back. Asking for money
            before returning an item, or pressuring someone for a reward, can lead to a suspended account.
          </p>
        </Section>

        <Section title="Paid boosts">
          <p>
            If you reported something lost, you may choose to boost your post for a fee shown before you pay.
            A boosted post is pinned to the top of the Lost board and shown on the Home screen for the time you
            chose, and everyone on campus gets one alert when it goes live. Boosts are always optional, and
            reporting and finding items stay free.
          </p>
          <p>
            You pay by bank transfer to the account shown in the app, with the reference we give you in the
            transfer description. A FoundIT admin checks each payment by hand, so a boost goes live once the
            payment is confirmed, not instantly. If we can&apos;t match a payment we will reject the boost and say
            why, and you can try again. A boost ends at the stated time, or as soon as you mark your item found.
            Once a boost is live it cannot be refunded. We store the amount, the reference and the optional
            name you give us on the transfer. We never ask for, and never see, your card details, PIN or OTP.
            Posts or boosts that mislead people or break these terms can be removed without a refund.
          </p>
        </Section>

        <Section title="Other services we use">
          <p>
            Emails (verification, password reset) are sent via Resend. Push notifications are delivered
            through your browser or device's own push service (for example Google's or Apple's). Errors
            are monitored via Sentry to help us fix bugs — this captures technical error details, not the
            content of your messages. Uptime is monitored via UptimeRobot, which only pings a health-check
            endpoint and never touches your data.
          </p>
        </Section>

        <Section title="Account deletion">
          <p>
            You can delete your account yourself from Profile at any time. Your name, email, password,
            and ID number are permanently removed. Items you've posted and messages you've sent stay
            visible to others (attributed to "Deleted User") so conversations and open item reports
            other people are relying on aren't broken by your deletion.
          </p>
          <p>
            Questions about this, or need something else removed, email{" "}
            <a href="mailto:nedochipublications@gmail.com" className="text-brand-teal underline">
              nedochipublications@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="Using FoundIT responsibly">
          <p>
            Only post items you've genuinely lost or found, and only claim an item that's actually yours.
            When meeting to exchange an item, do so in a safe, public campus location. FoundIT and Nedochi
            Publications aren't liable for the condition of returned items or for disputes between users,
            and don't guarantee a lost item will be found or a cash-out request approved.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Reach us any time at{" "}
            <a href="mailto:nedochipublications@gmail.com" className="text-brand-teal underline">
              nedochipublications@gmail.com
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
