# Static Over Midtown site (Go)

Run: `go run .` from this folder, then open http://localhost:8080

Env vars: `YOUTUBE_ID` (trailer id, placeholder for now), `ADMIN_PASSWORD` (enables /admin/signups.csv, user `admin`), `PORT`, `DATA_DIR`, `SITE_URL`.

Sign-ups are stored in `data/signups.jsonl` (git-ignored).
GitHub Pages can't run Go, so host this on a VPS / Fly.io / Render.
