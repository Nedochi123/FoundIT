# AI Usage Report

FoundIT was built with an AI coding assistant doing most of the typing, while I decided what to build, reviewed what it
produced, tested it, and decided what to keep, change or undo. This report is an honest account of that.

## 1. AI tools used

| Tool | What I used it for |
| --- | --- |
| **Claude Code** (Anthropic), in the Claude desktop app | Planning features, writing the backend and frontend code, writing automated tests, debugging, security reviews, deployment (Railway and Vercel), Git commits and pull requests, and explaining code I did not understand |
| Browser developer tools | Checking requests and errors myself (Network and Console tabs) |
| GitHub Actions | Running the tests automatically on every push |

## 2. Important prompts

These are real requests I gave (some shortened), with what they produced.

| Prompt | What it produced |
| --- | --- |
| Asked for voluntary cash rewards from owners to finders, then set the amounts (₦3k, 5k, 7k, 10k, 15k, 20k) and said FoundIT must not handle the money | A rewards feature where the owner promises a fixed reward after confirming the return, and the two students settle it privately; no bank details are stored for rewards |
| "The admin section should not be built in the app, remove it from there if it is" | Admin screens taken out of the student app |
| "Build a new section that is NOT the app where I can view all the activities on my browser" | A separate owner page served by the backend, protected by login |
| "Last finishing touches, secure it, crosscheck it" | A security pass that found the found-items gallery could be read without signing in on the live server, and fixed it with a test |
| "On the console it keeps saying failed to load resource, fix that" | Found the real cause (expired login tokens and two renewals at once) and fixed it |
| "Add other databases in the app for other schools…" | One separate database per university, with checks that one campus can never see another's posts |
| "Once an item is confirmed found, it will be deleted from the gallery automatically" | The AI checked first and showed the server already did this, then made the open gallery update itself as well |
| Asked to add **Edit** and **Delete** for posts (for this assessment) | `PATCH` and `DELETE` routes for lost and found posts, owner-only checks, an Edit dialog, Delete with confirmation, and 6 new tests |

**A prompt that did not work well:** "make sure it does not look like an AI application". It was too vague: the
assistant flattened the whole design (removed gradients and glows), I did not like the result, and I asked for the
original design back ("FoundIT design how it was before this recent change"). Lesson: say exactly what to change.

## 3. Features or code generated with AI

Most of the code was written by the AI from my requests, including: sign-up and login (JWT sessions), lost and found posts
(create, list, edit, delete, mark resolved), photo uploads, the gallery and search, private chat between finder and
owner, confirming returns, tokens and cash-out requests, the leaderboard, thank-you notes and rewards, reports and admin
review, push notifications, colour themes, QR "return me" tags, paid boosts, the owner page with activity and revenue,
per-university databases, and the automated tests.

## 4. Changes I made to AI-generated code

- **Undid a redesign** I did not like and asked for the original look back.
- **Moved the admin tools out of the student app** into a separate owner page.
- **Chose the rules** the AI then implemented: fixed reward amounts, no money handled by FoundIT, which universities to
  open, each university's colours, and that posts with paid boosts or confirmed returns must not be deletable.
- **Asked for changes after testing it myself**, for example the complaints section's wording and the delete rules above.

*(Add any lines you changed yourself, in your own words.)*

## 5. Errors and how I resolved them

| Problem | How it was investigated | Fix |
| --- | --- | --- |
| Railway emailed "crashed" on every deploy | Read the Railway logs: the server ignored Railway's stop signal (SIGTERM) | The server now shuts down cleanly on SIGTERM (`backend/src/utils/shutdown.js`, test `shutdown.test.js`) |
| Red "Failed to load resource" lines in the console | Looked at the Network tab: requests were sent with an expired login token, and two renewals at once broke the login | Renew the token just before it expires, and share one renewal between requests (`frontend/src/lib/refreshGate.js`, `tokenExpiry.js`, with tests) |
| The gallery could be read without signing in | Tested the live API with `curl` | Added `requireAuth` to the route, with a test in `finishing-touches.test.js` |
| Vercel deployments stuck as "Blocked" | Read the deployment's status through Vercel's API: the commit author was not the account owner | Commits are now made with my own GitHub identity |
| A new test for editing a found post failed (`400`) | Read the error: I sent the category "Other", but categories are stored as lowercase ids | Fixed the test to use `bottle`; the server's validation was correct |

## 6. How I tested and verified AI-generated code

- **Automated tests:** `cd backend && npm test` (158 tests, the API end to end on throwaway databases) and
  `cd frontend && npm test` (78 tests). `backend/test/crud.test.js` checks create, read, edit and delete, and that other
  students, bad input and missing posts are refused.
- **GitHub Actions** runs every test on each push; a pull request is only merged when the checks are green.
- **By hand on the live app:** creating, editing and deleting posts, refreshing to check the data stayed, empty and
  invalid input, a phone-sized screen and a private window.
- **Reading the code:** I asked the AI to explain parts I did not understand before accepting them.

## 7. What I learned

*(Write this in your own words. Points you might cover:)*

- How a request travels from a button in React, through the Express API and its checks, to the SQLite database and back.
- Why validation must happen on the server, not only in the form.
- That clear, specific prompts work better than vague ones, and that AI output has to be tested, not trusted.
- How Git branches, commits and pull requests keep a record of every change, and how deployment and environment
  variables work on Railway and Vercel.
