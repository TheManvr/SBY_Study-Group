## Purpose
Short, concrete guidance for AI coding assistants working in this repository.

## Quick start (local dev)
- Start the backend server: `node server.js` (no npm script present).
- Open the site at: http://localhost:3000 — `express` serves static HTML from the repo root.

## High-level architecture
- Frontend: static HTML/CSS/JS files in project root (e.g., `profile.html`, `main.html`, `feed.html`). Files use vanilla JS and CDN libraries (SweetAlert2, FontAwesome, Google Fonts).
- Backend: single-process Node/Express app in `server.js` that serves static files and provides a small JSON-file-backed API.
- Persistence: simple JSON files in repo root: `database.json`, `study_posts.json`, `chat.json`, `notifications.json`, `registrations.json`.

## Key runtime details & conventions
- Server binds to port `3000` (see `server.js`) — many front-end files use `const BASE_URL = 'http://localhost:3000'` (update when relocating backend).
- `body-parser` configured with a 50MB limit to allow image uploads as base64 (`server.js`).
- IDs are generated with `Date.now().toString()`; `userId` may be used as a username string.
- Avatars: front-end may send base64 images; server will accept and store avatar strings if length > 50.
- Authentication is very lightweight: login endpoint returns the user object and front-end stores it in `localStorage.currentUser` (plain text passwords in `database.json`).

## Important API endpoints (examples found across HTML files + `server.js`)
- `POST /api/register-user` — register new user.
- `POST /api/login` — login; returns `{ user }` on success.
- `GET /api/users/:userId` — fetch user (front-end uses e.g. `fetch(BASE_URL + '/api/users/' + currentUser.userId)`).
- `PUT /api/users/:userId` — update user (name, bio, role, avatar).
- `GET /api/study-posts`, `POST /api/study-posts`, `DELETE /api/study-posts/:id` — study posts CRUD.
- `GET /api/chat`, `POST /api/chat` — chat messages; front-end polls every 3s in `profile.html`.
- `POST /api/register-course` — records registration and creates a notification; also write to `registrations.json`.
- `GET /api/registrations` and `POST /api/registrations` — query and create registrations.

## Patterns & project-specific practices
- Frontend offline behavior: many pages fall back to `localStorage` if fetch fails (e.g., profile load). See `profile.html` for `loadProfile()` and local fallback.
- UI uses SweetAlert2 for confirmations and small flows (logout, edit, create-class notice).
- Chat uses simple polling (`setInterval(loadMessages, 3000)`) rather than websockets.
- Data enrichment: `server.js` joins user info into posts when returning `/api/study-posts` (owner_name, owner_avatar).
- File writes use synchronous `fs.writeFileSync` for simplicity; expect race conditions if many concurrent requests — treat this as a dev/test server.

## Where to make common changes
- Add or change API routes and JSON behavior in `server.js`.
- Update front-end queries and BASE_URLs inside HTML files (example: `profile.html` uses `${BASE_URL}/api/...`).
- Static assets: `images/` and `Public/` hold frontend resources.

## Safety & caveats (must-know)
- Passwords are stored in plaintext in `database.json`. There is no JWT/session middleware. Any production changes must add real auth and secure storage.
- JSON file DB has no concurrency control. Expect possible data loss or corruption under concurrent writes.

## Useful troubleshooting tips
- If data is missing, check that the JSON files exist in the repo root. `server.js` creates empty `[]` files on startup if absent.
- Server logs actions to console (e.g., registrations, new posts, server start) — use these when debugging behavior.
- To reset test data: stop server, delete the JSON files, restart server to recreate empty ones.

## Files to inspect for examples
- `server.js` — main Express app and all APIs.
- `package.json` — shows dependencies but has no `scripts` (run with `node server.js`).
- `profile.html` — examples of `BASE_URL`, `localStorage.currentUser`, avatar base64 upload, chat polling, and usage of `/api/users/:id` and `/api/chat`.

If anything above is unclear or you want more examples (e.g., walk-through of `/api/register-course` flow), tell me which area to expand.
