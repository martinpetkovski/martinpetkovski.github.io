# Static Over Midtown site (Go)

Run: `go run .` from this folder, then open http://localhost:8080

- Visitors sign in with Steam, join the playtest, and see their Steam key on the page once it is given out.
- Signed-in Steam users can comment.
- `/admin`: only for the Steam accounts in `ADMIN_STEAM_ID` (sign in and open /admin to see your Steam ID). Two sections:
  - Game (`/admin/game/...`): matches, players (ban / hide from ladders / note), provisional player and country ladders (Elo), servers (hosts, block flag).
  - Test enlistment (`/admin/test`): the page's texts and trailer, playtest keys, testers, blocking commenters.

Env vars: `ADMIN_STEAM_ID`, `PORT`, `DATA_DIR`, `SITE_URL`, `YOUTUBE_ID` (first start only; then the admin panel).

Match reports: the game posts every finished online match to `POST /api/game/match` with a Steam ticket; `/admin/game/matches` lists them.
Needs the database, and `STEAM_WEB_API_KEY` (a Steamworks publisher key; `STEAM_APP_ID` if not 5466920) to check the tickets;
without the key, reports are stored as unverified.

Data is kept in `data/` (git-ignored): `site.json` (accounts, testers, keys, comments, settings) and `session.key`.
The old email sign-ups (`data/signups.jsonl`) can be downloaded from the admin panel.
