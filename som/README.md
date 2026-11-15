# Static Over Midtown site (Go)

Run: `go run .` from this folder, then open http://localhost:8080

- Visitors sign in with Steam, join the playtest, and see their Steam key on the page once it is given out.
- Signed-in Steam users can comment.
- `/admin`: the page's texts and trailer, playtest keys, testers, blocking commenters. Only for the Steam accounts in `ADMIN_STEAM_ID`
  (sign in and open /admin to see your Steam ID).

Env vars: `ADMIN_STEAM_ID`, `PORT`, `DATA_DIR`, `SITE_URL`, `YOUTUBE_ID` (first start only; then the admin panel).

Data is kept in `data/` (git-ignored): `site.json` (accounts, testers, keys, comments, settings) and `session.key`.
The old email sign-ups (`data/signups.jsonl`) can be downloaded from the admin panel.
