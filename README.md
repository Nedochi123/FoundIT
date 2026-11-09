# FoundIT

**Campus lost and found for universities.** Students post what they have lost and what they have found, chat privately to
check an item really is theirs, and confirm the return. Each university (Nile, Baze and Cosmopolitan today) is its own
private space.

- **Live app:** https://founditapp.nedochipublications.com
- **API health check:** https://foundit-backend-production-e380.up.railway.app/api/health
- **Built by:** Nedochi Eluke, with Claude Code as an AI coding assistant (see [AI usage](#ai-usage))

## Contents

1. [Project overview](#project-overview)
2. [Problem being solved](#problem-being-solved)
3. [Features](#features)
4. [Technology stack](#technology-stack)
5. [Setup and installation](#setup-and-installation)
6. [Environment variables](#environment-variables)
7. [Database setup](#database-setup)
8. [Testing instructions](#testing-instructions)
9. [Deployment](#deployment)
10. [Screenshots](#screenshots)
11. [AI usage](#ai-usage)
12. [Project structure](#project-structure)
13. [More about the features](#more-about-the-features)

## Project overview

FoundIT is a full-stack web app that can be installed on a phone like an app. A student signs up with their university
email address and can then:

- post something they have **lost**, or something they have **found** (with a photo);
- browse every lost and found post from their own campus;
- message the other student privately to check the item is really theirs;
- confirm the return, which closes the post and rewards the finder with tokens.

The main record is the **Item Post**: either a Lost post or a Found post, with a description, a place, a category, a
status (open or resolved) and, for found items, a photo.

## Problem being solved

Students lose phones, ID cards, bottles, keys and books every day, and other students find them. Notices on walls and
messages in group chats are easily missed, so lost and found items rarely meet. FoundIT gives each campus one place where
lost and found posts meet, and a safe, private way to arrange the return without sharing phone numbers up front.

## Features

### CRUD on the Item Post

Every operation goes through the API and is stored in the database.

| Operation | In the app | API endpoint |
| --- | --- | --- |
| **Create** | "I lost something" form; "I found something" form (with a photo) | `POST /api/lost-items`, `POST /api/found-items` |
| **Read** | The Lost board and the "Items found" gallery (search, category icons) | `GET /api/lost-items`, `GET /api/found-items` |
| **Update** | **Edit** on your own post (description, place, category); **Mark as found / resolved** changes the status | `PATCH /api/lost-items/:id`, `PATCH /api/found-items/:id`, `PATCH /api/…/:id/resolve` |
| **Delete** | **Delete** on your own post, after "Are you sure?" (a found post's photo is deleted too) | `DELETE /api/lost-items/:id`, `DELETE /api/found-items/:id` |

Rules the server enforces:

- Only the student who made a post can edit or delete it. Anyone else gets `403`, and a post that does not exist gets `404`.
- Bad input (for example an empty description) gets `400` with a clear message, and nothing is saved.
- Two kinds of post are kept as a record instead of being deleted: a lost post someone paid to boost (mark it resolved
  instead), and a found post whose return was confirmed (tokens and the Wall of Reunions depend on it).

### Everything else

- **Accounts:** sign-up with a university email address, login sessions that renew themselves, password reset by email.
- **Private chat** between finder and owner, and **confirming a return** (the post leaves the gallery automatically).
- **Tokens** for finders, a **leaderboard**, **thank-you notes** and optional **thank-you rewards** paid directly between
  students (FoundIT never handles the money).
- **QR "Return me" tags:** a sticker on a bag or laptop that a finder scans to message the owner, without an account.
- **Urgently need:** a lost post with a promised reward that alerts the whole campus.
- **Paid boosts** that pin a lost post to the top for a few days.
- **Push notifications**, **colour themes and floating doodles**, and a **separate private space for each university**.
- **Safety:** reporting posts, an admin area, and a complaints chat with the admin.

How each one works is in the [feature guide](docs/FEATURES.md).

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, installable PWA (service worker) |
| Backend / API | Node.js 24+, Express 5, Zod (input validation), JWT (login sessions), Multer (photo uploads) |
| Database | SQLite through Node's built-in `node:sqlite` (one database file per university) |
| Email and notifications | Resend (email), Web Push (notifications) |
| Hosting | Frontend on Vercel, backend on Railway, database files and photos on a Railway persistent volume |
| Tools | VS Code, Git and GitHub (pull requests, GitHub Actions), browser developer tools, Claude Code (see [AI usage](#ai-usage)) |

## Setup and installation

To run it on your own computer:

1. Install **Node.js 24 or newer** and Git.
2. Clone the repository:

   ```bash
   git clone https://github.com/Nedochi123/FoundIT.git
   cd FoundIT
   ```

3. **Backend** (first terminal):

   ```bash
   cd backend
   npm install
   cp .env.example .env    # the defaults work on your computer
   npm run dev
   ```

   The API runs on http://localhost:4000. Check http://localhost:4000/api/health.

4. **Frontend** (second terminal):

   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```

   Open http://localhost:5173.

5. Sign up with an email address that ends in the university's domain. On your computer the default is
   `@nileuniversity.edu.ng` (set `ALLOWED_EMAIL_DOMAIN` to change it). Use made-up details only.

## Environment variables

Only the names are listed here, never real values. The full lists with comments are in `backend/.env.example` and
`frontend/.env.example`, with a summary in the root `.env.example`.

- **Backend, required:** `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `CLIENT_ORIGIN`,
  `ALLOWED_EMAIL_DOMAIN`, `UPLOAD_ROOT` (a persistent folder in production)
- **Backend, optional:** `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `NODE_ENV`, `ADMIN_EMAILS`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_DSN`
- **Frontend:** `VITE_API_BASE_URL` (the live backend address in production), `VITE_SENTRY_DSN`, `VITE_GA_MEASUREMENT_ID`

In production they are set in Railway's **Variables** (backend) and Vercel's **Environment Variables** (frontend), never
in the repository.

## Database setup

There is nothing to install: SQLite is built into Node.

- On start-up the server creates the database file named in `DATABASE_URL` and runs `backend/db/schema.sql` (every table
  is `CREATE TABLE IF NOT EXISTS`). It then applies small in-place upgrades for older databases.
- The main tables are `users`, `lost_items` and `found_items`, plus chats, tokens and the extras.
- Each other university gets its own file next to the main one (for example `dev-baze.db`), so one campus can never see
  another's data.
- In production `DATABASE_URL` points at a file on a Railway **persistent volume**, so data survives restarts and redeploys.

## Testing instructions

### Automated tests

```bash
cd backend  && npm test           # 158 tests: the API end to end, on throwaway databases
cd frontend && npm test           # 82 tests: the website's logic and rules
cd frontend && npm run themes:check   # every colour theme keeps text readable
cd frontend && npm run build      # the website compiles
```

- `backend/test/crud.test.js` covers create, read, edit and delete, and every refusal (another student, bad input, a
  missing post).
- GitHub Actions runs all of these on every push, and a pull request is merged only when they pass.

### By hand

Do these on your computer first, then on the live app, also on a phone and in a private window:

1. Create a lost post and a found post: a success message shows, and each appears in its list.
2. Refresh the page: both are still there (they were read back from the database).
3. Edit a post's description: the change shows, and stays after a refresh.
4. Delete a post and confirm: it disappears, and stays gone after a refresh.
5. Submit a lost post with an empty description: a clear error shows, and nothing is saved.
6. Stop the backend (or use a wrong post id): the app shows a helpful message instead of crashing.

## Deployment

| Part | Where | How it updates |
| --- | --- | --- |
| Website | Vercel (project `foundit-frontend`, folder `frontend`) | Automatically on every merge to `master` |
| API | Railway (service `foundit-backend`, folder `backend`) | Automatically on every merge to `master` |
| Data | A Railway persistent volume (database files and photos) | Kept across deploys |

The server stops cleanly when Railway restarts it (`backend/src/utils/shutdown.js`), so a deploy never cuts off a request
halfway.

## Screenshots

Taken on a phone-sized screen with sample data only (made-up students and posts). The live app looks the same; sign-up
needs a university email ending, so use made-up details.

| Home | Lost board (Read) | Your own post |
| --- | --- | --- |
| <img src="docs/screenshots/1-home.png" alt="Home: Hi, Amaka, with I lost something, I urgently need something and I found something" width="240"> | <img src="docs/screenshots/2-lost-board.png" alt="Lost board listing lost posts from other students, each with I found this" width="240"> | <img src="docs/screenshots/3-your-post.png" alt="The student's own post with Mark as found, Edit and Delete buttons" width="240"> |

| Edit a post (Update) | Saved, with a success message |
| --- | --- |
| <img src="docs/screenshots/4-edit-post.png" alt="Edit your lost post dialog with description, where and category" width="240"> | <img src="docs/screenshots/5-post-updated.png" alt="Lost board showing Your post was updated and the edited description" width="240"> |

Delete asks "Delete this post for good?" first, then shows "Your post was deleted."

## AI usage

FoundIT was built with an AI coding assistant doing most of the typing. I decided what to build, reviewed what it
produced, tested it, and decided what to keep, change or undo. The full, honest account is in **[AI_USAGE.md](AI_USAGE.md)**.
In short:

**Tools**

| Tool | What I used it for |
| --- | --- |
| **Claude Code** (Anthropic), in the Claude desktop app | Planning features, writing backend and frontend code, writing tests, debugging, security reviews, deploying, Git commits and pull requests, and explaining code I did not understand |
| Browser developer tools | Checking requests and errors myself (Network and Console tabs) |
| GitHub Actions | Running every test automatically on each push |

**What the AI wrote:** most of the code, from my requests. That includes accounts and logins, lost and found posts
(create, list, edit, delete, resolve), photo uploads, the gallery, private chat, confirming returns, tokens and cash-outs,
rewards, QR tags, boosts, the owner page, the separate database per university, and the automated tests.

**What I decided and changed:**

- The rules: fixed reward amounts, FoundIT never handles money, which universities to open, each university's colours,
  and which posts may not be deleted.
- I undid a redesign I did not like and asked for the original look back.
- I moved the admin tools out of the student app into a separate owner page.
- I asked for changes after testing things myself, such as the complaints wording and the delete rules.

**How the AI's code was checked:**

- 240 automated tests (158 backend, 82 frontend), run by GitHub Actions on every push.
- Testing by hand on the live app, on a phone and in a private window.
- Asking the AI to explain any part I did not understand before accepting it.

**Lesson:** specific prompts work far better than vague ones. "Make sure it does not look like an AI application" was too
vague: it flattened the whole design, and I had to ask for the original back.

[AI_USAGE.md](AI_USAGE.md) also lists the important prompts I used, the errors we hit and how each was fixed, and what I
learned.

## Project structure

```text
FoundIT/
├── backend/            Express API
│   ├── db/             schema.sql, seed and the database connection (one file per university)
│   ├── src/routes/     one file per area: auth, lost-items, found-items, conversations, tags, boosts ...
│   ├── src/utils/      shared rules (rewards, tokens, photo links, shutdown ...)
│   ├── owner-page/     the owner's private page (plain HTML, CSS and JS)
│   └── test/           backend tests (node:test)
├── frontend/           React website (PWA)
│   ├── src/components/ screens and parts, grouped by feature
│   ├── src/lib/        API calls, themes, universities, helpers
│   └── test/           frontend tests
├── docs/               feature guide and screenshots
├── AI_USAGE.md         how AI was used to build FoundIT
└── .env.example        summary of the settings (no real values)
```

## More about the features

The [feature guide](docs/FEATURES.md) explains each bigger feature in detail: decisions, rules, limits, where the code is,
and its tests.

- University workspaces (each university is a private space)
- Thank-you rewards
- QR "Return me" tags
- Colour themes and floating doodles
- Lost board and paid boosts
- Security record and the owner page
- Messages to the admin (complaints)
- Revenue on the owner page
- Checks and tests
- Urgently need
