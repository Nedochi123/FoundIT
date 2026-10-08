# FoundIT

Campus lost &amp; found for Nile University — report something lost or found, get notified campus-wide, and message another user in-app to verify and reunite items with their owners.

- `backend/` — Express 5 API (Node `node:sqlite`, JWT auth, Resend email, Web Push)
- `frontend/` — React + Vite PWA (installable, camera capture, push notifications)

See `backend/.env.example` and `frontend/.env.example` for required configuration. Deployed as backend → Railway, frontend → Vercel, matching the same pattern as the other Nedochi Publications projects.

## Thank-you rewards (voluntary, paid directly)

After the person who lost an item confirms its return, they can optionally say thank you with a reward of ₦3,000, ₦5,000, ₦7,000, ₦10,000, ₦15,000 or ₦20,000 (the list is `REWARD_AMOUNTS` in `backend/src/utils/rewards.js`). **FoundIT never handles this money and stores no bank or card details for it**: the finder shares their account details privately in the chat, the owner pays them directly and taps "I've sent it", and the finder taps "I received it". The `rewards` table records only the amount and those steps (one reward per item; only the owner whose confirmation closed the item can give it). Tests: `cd backend && npm test`.
