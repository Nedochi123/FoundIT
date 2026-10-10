# FoundIT

Campus lost &amp; found for Nile University — report something lost or found, get notified campus-wide, and message another user in-app to verify and reunite items with their owners.

- `backend/` — Express 5 API (Node `node:sqlite`, JWT auth, Resend email, Web Push)
- `frontend/` — React + Vite PWA (installable, camera capture, push notifications)

See `backend/.env.example` and `frontend/.env.example` for required configuration. Deployed as backend → Railway, frontend → Vercel, matching the same pattern as the other Nedochi Publications projects.

## Thank-you rewards (voluntary, paid directly)

After the person who lost an item confirms its return, they can optionally say thank you with a reward of ₦3,000, ₦5,000, ₦7,000, ₦10,000, ₦15,000 or ₦20,000 (the list is `REWARD_AMOUNTS` in `backend/src/utils/rewards.js`). **FoundIT never handles this money and stores no bank or card details for it**: the finder shares their account details privately in the chat, the owner pays them directly and taps "I've sent it", and the finder taps "I received it". The `rewards` table records only the amount and those steps (one reward per item; only the owner whose confirmation closed the item can give it). Tests: `cd backend && npm test`.

## QR "Return me" tags

Stickers with a QR code that students put on a laptop, bag, keys or ID holder. Whoever finds the item scans it, lands on `/t/<code>` (a public page, no account) and writes a first message, which opens a **private chat** with the owner. The owner gets a push notification and an email and replies under Profile → My QR tags. Neither side sees the other's name or number unless they tap **Share my name or number** in the chat (an explicit, optional "contact" message). The finder only ever sees the label the owner gave the tag (e.g. "Blue backpack").

- **How the finder stays in the chat without an account:** the first message returns a random secret token, kept in the finder's browser (`localStorage`) and sent as the `X-Chat-Token` header; the server stores only its SHA-256 hash (`tag_threads.finder_token_hash`). Scanning the tag again in the same browser reopens the chat, and the page polls for replies every few seconds while open. The finder gets no push notification (no account), so the page says to keep it open or scan again later.

- **Making stickers (admin):** sign in as an `ADMIN_EMAILS` account → open `/?admin=1` → **Tags** tab → pick how many → **Make tags** → **Print** (A4 sticker sheet, 44×54 mm stickers). The QR codes point at the address you are on, so always make and print them from the live site. Codes are 8 characters with no look-alike letters (`0/O`, `1/I/L`). "Show the unclaimed tags again" reprints tags nobody has activated yet.
- **Activating (student):** scan the sticker (or open Profile → My QR tags and type the code), give it a label, tap **Activate tag**. A student can hold 10 tags. Pause, rename or remove a tag at any time; removing it (or deleting a single chat, or deleting the account) erases the chats and any numbers shared in them.
- **Abuse limits:** at most 5 new chats per tag per hour and 15 per day, 30 finder messages per chat per hour, 300 messages per chat, plus a hidden honeypot field and per-IP rate limits. Messages are stored and shown as plain text. Paused, removed, or deleted/suspended-owner tags tell new finders to hand the item to campus security instead (an existing chat stays readable while paused).
- **Code:** `backend/src/routes/tags.routes.js` (mounted at `/api/tags`), `backend/src/utils/tags.js`, tables `tags`, `tag_threads` and `tag_messages` in `backend/db/schema.sql`, `frontend/src/components/tags/` (`TagScan` finder page, `TagsScreen` owner screen, `TagChat` shared chat), `frontend/src/components/admin/AdminTagsScreen.jsx`. `frontend/vercel.json` rewrites `/t/:code` to the app. Tests: `backend/test/tags.test.js`.

## App look: color themes and floating doodles

At sign-up (and later under Profile → App look) a student picks an **app color** (Default, Pink, Camo, Black, Blue, Red, Purple, Green, Light pink, Light purple) and a style of **floating doodles** (None, Kittens, Dogs, Aliens, Money, Microscopes). Picking a color re-colors the whole app live, so they see what they get; choosing Default + None keeps the original look exactly. The choice is saved on the account (`users.theme`, `users.doodle`) so it follows them to any device; the allowed values are in `backend/src/utils/themes.js` and are validated on sign-up and `PATCH /api/users/me`.

- **How it works:** every theme is a set of CSS variables. Tailwind's `slate` greys and the `brand` colors read those variables (`tailwind.config.js`), so every existing screen re-colors with no per-component code. `data-theme` on `<html>` selects the set (index.html applies it before the first paint so there is no flash). Most themes are dark (light text on dark cards). The two **light** themes (`neutral.tone: "light"` in `themes.js`) flip the grey scale so existing classes keep working (headings become dark ink, cards become pale), turn `border-white/10`-style highlights into ink-colored ones, and switch the red/amber/green status text to darker shades; `tailwind.config.js` does this only when a light theme sets the matching variables, so the dark themes are untouched.
- **Adding or changing a theme:** edit `frontend/src/lib/themes.js` (and add the id to `backend/src/utils/themes.js`), then run `npm run themes` in `frontend/`; this regenerates `src/themes.css` and the camouflage tile `public/themes/camo.svg` (it also runs before every build). `npm run themes:check` measures text contrast (headings, secondary and hint text, the accent color, button text, and error/warning/success text) for every theme against the card and every part of the page gradient, and fails below WCAG 4.5:1.
- **Doodles:** `components/theme/doodles.jsx` (lucide line icons plus original drawings: a kitten, puppy, alien, UFO, yarn ball, naira coin) and `DoodleField.jsx` (17 faint floating sprites behind everything, transform-only animation). They stop for anyone whose device is set to reduce motion, and a "Keep doodles still" switch (per device) freezes them. They are generic kittens, not any cartoon character.
- **Logo and welcome animation:** the in-app logo (`components/theme/Logo.jsx`), the browser-tab icon and the iPhone Home Screen icon (`lib/themedIcon.js`) take the chosen color; Default keeps the original image files. The one-time welcome animation reads each theme's `intro` colors (a dark stage, so its cream-outlined character stays visible even on the light themes), and Profile → App look has a "Watch the welcome animation" button, and it also plays once right after a student creates an account (`components/WelcomeAfterSignup.jsx`, triggered by a one-time `sessionStorage` flag that `signup()` sets; never on a normal log-in), in the colors they just picked. One-time flags like that are read while rendering and cleared in an effect, because React may render twice in development. An app already installed from Chrome on Android keeps its install icon.
- Tests: `backend/test/themes.test.js`.

## Lost board and paid boosts

Lost posts are now visible: Gallery has a **Found / Lost** switch, and the Lost board lists everyone's open lost posts (poster, description, location). The poster can **Mark as found**; everyone else sees **I found this** (opens the found-item form) and a report flag.

A student can **boost** their own open lost post (24 hours ₦300, 3 days ₦700, 7 days ₦1,200; plans and prices live in `backend/src/utils/boosts.js`). A live boost pins the post to the top of the Lost board, shows it in a "Help find" strip on everyone's Home, and sends one campus-wide alert when it goes live (people who turned off lost-item alerts don't get it).

- **Payment is manual, like cash-outs:** the student picks a plan, the app shows the bank details and a unique reference (`BST-XXXXXX`) to put in the transfer description, and they tap "I've paid". Statuses: `awaiting_payment` → `payment_claimed` → `active` (admin approves) or `rejected`; `cancelled` if they back out or it sits unpaid for 2 days. An `active` boost past its `expires_at` is simply ended. No payment provider is involved, and the app never sees card details.
- **Admin → Boosts tab:** the admin types in the bank account students pay into (stored in `app_settings`, key `boost_payment`; **boosts stay switched off until this is set**), sees revenue (this month / all time / count), and approves or rejects each payment after checking their bank. Admins also get a push when someone says they've paid. Approving needs the post to still be open, and notifies the student.
- **Limits:** one boost at a time per post, at most 3 unpaid/unchecked boosts per student, and only the owner can see their boost's reference and the bank details.
- **Code:** `backend/src/routes/boosts.routes.js` (`/api/boosts`), `backend/src/utils/boosts.js`, tables `boosts` and `app_settings` in `schema.sql`, `lost-items.routes.js` (boosted first, `boostedUntil`, the owner's own `boost`); frontend `components/boost/` (`BoostSheet`, `HomeBoostedCards`), `components/gallery/` (`LostBoard`, `LostCard`), `components/admin/AdminBoostsScreen.jsx`. Tests: `backend/test/boosts.test.js`.

## Security view: compulsory location, activity log and chats (owner only)

To investigate theft, the owner has a private security view, and students must keep their phone's location on. Both are disclosed to students (the location screen, a note in every chat, and the Privacy & Terms), because secretly watching private chats and locations would break the app's own promises and data-protection law.

- **Compulsory location.** After sign-in, `components/location/LocationGate.jsx` shows a full screen (no "Not now") until the phone shares its location, explains why and who sees it, and gives Android and iPhone steps if it is blocked. Admin accounts are exempt so they can't be locked out. The app keeps the latest position in memory and sends it as an `X-Geo` header (`lib/geo.js`, `lib/api.js`) with each request that *changes* something, plus one "Opened the app" check-in per visit. There is no background tracking. **The server does not refuse requests that arrive without a location** (old app versions and direct API calls would break); instead the monitor flags every action that has none. A location is a phone-reported value and can be faked, so treat it as a lead, not proof.
- **Activity log** (`activity_log`, `utils/monitor.js`): one row per successful change (who, what, when, a short public detail such as a posted item's description, and the location rounded to about 11 m). Never passwords or message text. Deleted after 90 days (`RETENTION_DAYS`) and when the account is deleted.
- **The monitor** (Admin → **Activity**, `routes/monitor.routes.js`, `components/admin/AdminActivityScreen.jsx`): **Activity** (filter by person or search), **Chats** (item chats and QR tag chats, full text, searchable) and **People** (last seen place, actions with no location). Read only: opening a chat never marks messages as read. Only the monitor account can use it: `MONITOR_EMAILS` (comma separated) or, if unset, the *first* address in `ADMIN_EMAILS`; everyone else, other admins included, gets a plain 404. Every chat the owner opens is recorded (`monitor_access_log`). Long digit runs (bank account, card and phone numbers) are hidden down to their last 4 digits in what the monitor shows; `MONITOR_SHOW_NUMBERS=1` turns that off.
- Tests: `backend/test/monitor.test.js`, `frontend/test/geo.test.mjs`.

## Checks and tests

```bash
cd backend  && npm test          # the server, end to end, on throwaway databases
cd frontend && npm test          # the website's helpers, plus a check that its lists match the server's
cd frontend && npm run themes:check   # every color theme keeps text readable (WCAG contrast)
cd frontend && npm run build     # the website compiles
```

- `frontend/test/consistency.test.mjs` fails if the website's and the server's copies of the color themes, doodle styles, reward amounts or item types drift apart.
- GitHub Actions (`.github/workflows/ci.yml`) runs all of this, regenerates the theme CSS to make sure the committed copy is current, and audits dependencies on every push. Pushing to GitHub **does** deploy the website (Vercel is linked to `master`), so a red check means do not merge.
- **Known, accepted warnings:** `npm audit` reports 3 *moderate* findings in the frontend (`uuid` ← `xcode` ← `@capacitor/cli`). That chain is the Android build tool and never runs in the browser or on the server; the only "fix" npm offers is downgrading Capacitor, which is worse. CI fails only on *high* or *critical* findings.
