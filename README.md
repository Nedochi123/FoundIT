# FoundIT

Campus lost &amp; found for Nile University — report something lost or found, get notified campus-wide, and message another user in-app to verify and reunite items with their owners.

- `backend/` — Express 5 API (Node `node:sqlite`, JWT auth, Resend email, Web Push)
- `frontend/` — React + Vite PWA (installable, camera capture, push notifications)

See `backend/.env.example` and `frontend/.env.example` for required configuration. Deployed as backend → Railway, frontend → Vercel, matching the same pattern as the other Nedochi Publications projects.

## Thank-you rewards (voluntary, paid directly)

After the person who lost an item confirms its return, they can optionally say thank you with a reward of ₦3,000, ₦5,000, ₦7,000, ₦10,000, ₦15,000 or ₦20,000 (the list is `REWARD_AMOUNTS` in `backend/src/utils/rewards.js`). **FoundIT never handles this money and stores no bank or card details for it**: the finder shares their account details privately in the chat, the owner pays them directly and taps "I've sent it", and the finder taps "I received it". The `rewards` table records only the amount and those steps (one reward per item; only the owner whose confirmation closed the item can give it). Tests: `cd backend && npm test`.

## QR "Return me" tags

Stickers with a QR code that students put on a laptop, bag, keys or ID holder. Whoever finds the item scans it, lands on `/t/<code>` (a public page, no account), and leaves a phone number and an optional message; the owner gets a push notification and an email and sees the message under Profile → My QR tags. The finder never sees the owner's name, number or email, only the label the owner gave the tag (e.g. "Blue backpack").

- **Making stickers (admin):** sign in as an `ADMIN_EMAILS` account → open `/?admin=1` → **Tags** tab → pick how many → **Make tags** → **Print** (A4 sticker sheet, 44×54 mm stickers). The QR codes point at the address you are on, so always make and print them from the live site. Codes are 8 characters with no look-alike letters (`0/O`, `1/I/L`). "Show the unclaimed tags again" reprints tags nobody has activated yet.
- **Activating (student):** scan the sticker (or open Profile → My QR tags and type the code), give it a label, tap **Activate tag**. A student can hold 10 tags. Pause, rename or remove a tag at any time; removing it deletes its messages (and the finders' numbers).
- **Abuse limits:** a finder can leave 5 messages per tag per hour and 15 per day, plus a hidden honeypot field and an IP rate limit. Paused, removed, or deleted/suspended-owner tags tell the finder to hand the item to campus security instead.
- **Code:** `backend/src/routes/tags.routes.js` (mounted at `/api/tags`), `backend/src/utils/tags.js`, tables `tags` and `tag_messages` in `backend/db/schema.sql`, `frontend/src/components/tags/`, `frontend/src/components/admin/AdminTagsScreen.jsx`. `frontend/vercel.json` rewrites `/t/:code` to the app. Tests: `backend/test/tags.test.js`.
