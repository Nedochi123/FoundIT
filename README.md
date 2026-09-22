# FoundIT

Campus lost &amp; found for Nile University — report something lost or found, get notified campus-wide, and message another user in-app to verify and reunite items with their owners.

- `backend/` — Express 5 API (Node `node:sqlite`, JWT auth, Resend email, Web Push)
- `frontend/` — React + Vite PWA (installable, camera capture, push notifications)

See `backend/.env.example` and `frontend/.env.example` for required configuration. Deployed as backend → Railway, frontend → Vercel, matching the same pattern as the other Nedochi Publications projects.
