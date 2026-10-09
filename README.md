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
- Tests: `backend/test/themes.test.js`.
