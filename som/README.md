# Static Over Midtown site (Go)

Run: `go run .` from this folder, then open http://localhost:8080

- Visitors sign in with Steam, join the playtest, and see their Steam key on the page once it is given out.
- Signed-in Steam users can comment.
- `/admin`: only for the Steam accounts in `ADMIN_STEAM_ID` (sign in and open /admin to see your Steam ID). Two sections:
  - Game (`/admin/game/...`): matches, players (ban / hide from ladders / note), provisional player and country ladders (Elo), servers (hosts, block flag).
  - Test enlistment (`/admin/test`): the page's texts and trailer, playtest keys, testers, blocking commenters.

Env vars: `ADMIN_STEAM_ID`, `PORT`, `DATA_DIR`, `SITE_URL`, `YOUTUBE_ID` (first start only; then the admin panel).

Standing (`standing.go`): `GET /api/game/standing?who=..&who=..[&event=ID]` answers where up to ten players stand right now - the provisional ladder by SteamID64 (ladders no older than 5 s), or an event's score and achievement ladders by nickname. The game asks before and after a match and shows the difference on its results screen.

Online events (`events.go`): `/admin/game/events` creates an event (name, start in UTC, length); the game lists the running and coming ones (`GET /api/game/events`), claims nicknames under a Steam ticket (`POST /api/game/event/nickname`: the first account to claim one owns it in that event) and shows the event's ladder (`GET /api/game/event/ladder`: total score per nickname, and each of the ten achievements as a ladder of its own in `boards`). Event matches are ordinary reports carrying the event id and nicknames; they never count for the global ladder.

Match reports: the game posts every finished online match to `POST /api/game/match` with a Steam ticket; the reports of a match are cross-checked (`crosscheck.go`: verified when two confirmed reports agree, disputed when they differ, single for a one-human match; only verified, single and admin-accepted matches count for the ladders, and `/admin/game/matches?q=disputed` lists the ones to review); `/admin/game/matches` lists them. `GET /api/game/ladder?me=STEAMID&country=CC` serves the in-game ladder (top 50 players and countries).
Needs the database, and `STEAM_WEB_API_KEY` (a Steamworks publisher key; `STEAM_APP_ID` if not 5466920) to check the tickets;
without the key, reports are stored as unverified.

Data is kept in `data/` (git-ignored): `site.json` (accounts, testers, keys, comments, settings) and `session.key`.
The old email sign-ups (`data/signups.jsonl`) can be downloaded from the admin panel.
