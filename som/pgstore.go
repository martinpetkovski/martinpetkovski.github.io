package main

// The site's data in PostgreSQL (DATABASE_URL, given by the server manager): one table each for
// the Steam accounts, the comments, the unused keys, the page's settings and the older email
// sign-ups. The site keeps a copy in memory (it is small) and writes each change to the tables
// at once: only the rows that changed, in one transaction.
//
// The first start with a database copies data/site.json and data/signups.jsonl into the tables
// and renames them to *.imported.

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const pgSchema = `
CREATE TABLE IF NOT EXISTS users (
  id        TEXT PRIMARY KEY,            -- SteamID64
  name      TEXT NOT NULL DEFAULT '',
  avatar    TEXT NOT NULL DEFAULT '',
  joined    TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_up TIMESTAMPTZ,                 -- joined the playtest
  steam_key TEXT UNIQUE,                 -- the key given to them
  key_at    TIMESTAMPTZ,
  banned    BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS comments (
  id      BIGINT PRIMARY KEY,
  parent  BIGINT,                        -- the comment it replies to
  user_id TEXT NOT NULL,
  body    TEXT NOT NULL DEFAULT '',
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false -- kept as "deleted" while it has replies
);
CREATE INDEX IF NOT EXISTS comments_at ON comments (at);
CREATE TABLE IF NOT EXISTS steam_keys (  -- not given out yet, in the order they go out
  pos       INT PRIMARY KEY,
  steam_key TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS settings (
  id           INT PRIMARY KEY CHECK (id = 1),
  youtube_id   TEXT NOT NULL DEFAULT '',
  tagline      TEXT NOT NULL DEFAULT '',
  lead         TEXT NOT NULL DEFAULT '',
  video_note   TEXT NOT NULL DEFAULT '',
  key_note     TEXT NOT NULL DEFAULT '',
  signups_open BOOLEAN NOT NULL DEFAULT true,
  comments     BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS email_signups ( -- from before Steam sign-in
  email TEXT NOT NULL,
  name  TEXT NOT NULL DEFAULT '',
  at    TIMESTAMPTZ NOT NULL
);
`

type pgStore struct {
	pool *pgxpool.Pool
	last state // what the tables hold now
}

// openPG connects, makes the tables, imports the old files once and loads everything.
func openPG(ctx context.Context, url, dir, youtube string) (*db, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database: %w", err)
	}
	if _, err := pool.Exec(ctx, pgSchema); err != nil {
		return nil, fmt.Errorf("database tables: %w", err)
	}
	if _, err := pool.Exec(ctx, matchSchema+eventSchema); err != nil { // the game's matches (matches.go) and events (events.go)
		return nil, fmt.Errorf("match tables: %w", err)
	}
	p := &pgStore{pool: pool}
	d := &db{pg: p}
	var hasSettings bool
	pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM settings)`).Scan(&hasSettings)
	if !hasSettings { // a new database: what the site had in its files, or a fresh start
		file, err := openDB(dir, youtube)
		if err != nil {
			return nil, err
		}
		p.last = state{} // nothing in the tables yet
		if err := p.save(&file.s); err != nil {
			return nil, fmt.Errorf("copying data/site.json into the database: %w", err)
		}
		if _, err := os.Stat(file.path); err == nil {
			os.Rename(file.path, file.path+".imported")
			log.Printf("data/site.json copied into the database (%d accounts, %d comments, %d keys); the file is now site.json.imported",
				len(file.s.Users), len(file.s.Comments), len(file.s.Keys))
		}
		if err := p.importEmails(ctx, filepath.Join(dir, "signups.jsonl")); err != nil {
			return nil, err
		}
	}
	if err := p.load(ctx, &d.s); err != nil {
		return nil, err
	}
	d.normalize()
	p.last = copyState(&d.s)
	go p.pruneLoop() // old match reports: only the host's are kept whole (prune.go)
	return d, nil
}

func (p *pgStore) load(ctx context.Context, s *state) error {
	*s = state{Users: map[string]*user{}}
	rows, err := p.pool.Query(ctx, `SELECT id, name, avatar, joined, signed_up, coalesce(steam_key, ''), key_at, banned FROM users`)
	if err != nil {
		return err
	}
	for rows.Next() {
		u := &user{}
		var su, ka *time.Time
		if err := rows.Scan(&u.ID, &u.Name, &u.Avatar, &u.Joined, &su, &u.Key, &ka, &u.Banned); err != nil {
			rows.Close()
			return err
		}
		u.SignedUp, u.KeyAt = tval(su), tval(ka)
		s.Users[u.ID] = u
	}
	rows.Close()
	rows, err = p.pool.Query(ctx, `SELECT id, coalesce(parent, 0), user_id, body, at, deleted FROM comments ORDER BY id`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var c comment
		if err := rows.Scan(&c.ID, &c.Parent, &c.User, &c.Text, &c.At, &c.Deleted); err != nil {
			rows.Close()
			return err
		}
		s.Comments = append(s.Comments, c)
		if c.ID > s.NextID {
			s.NextID = c.ID
		}
	}
	rows.Close()
	rows, err = p.pool.Query(ctx, `SELECT steam_key FROM steam_keys ORDER BY pos`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var k string
		rows.Scan(&k)
		s.Keys = append(s.Keys, k)
	}
	rows.Close()
	st := &s.Settings
	err = p.pool.QueryRow(ctx, `SELECT youtube_id, tagline, lead, video_note, key_note, signups_open, comments FROM settings WHERE id = 1`).
		Scan(&st.YouTubeID, &st.Tagline, &st.Lead, &st.VideoNote, &st.KeyNote, &st.SignupsOpen, &st.Comments)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	}
	return err
}

// save writes what changed since the last save, in one transaction. If it fails, the copy
// in memory is put back to what the tables hold, so the two never drift apart.
func (p *pgStore) save(s *state) error {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	err := p.write(ctx, s)
	if err != nil {
		log.Printf("database: %v", err)
		*s = copyState(&p.last)
		return err
	}
	p.last = copyState(s)
	return nil
}

func (p *pgStore) write(ctx context.Context, s *state) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	old := &p.last
	var b pgx.Batch

	// keys first: a key moving from the pool to a person stays unique
	if !sameStrings(old.Keys, s.Keys) {
		b.Queue(`DELETE FROM steam_keys`)
		for i, k := range s.Keys {
			b.Queue(`INSERT INTO steam_keys (pos, steam_key) VALUES ($1, $2)`, i, k)
		}
	}
	for id := range old.Users {
		if s.Users[id] == nil {
			b.Queue(`DELETE FROM users WHERE id = $1`, id)
		}
	}
	for id, u := range s.Users {
		if o := old.Users[id]; o != nil && *o == *u {
			continue
		}
		b.Queue(`INSERT INTO users (id, name, avatar, joined, signed_up, steam_key, key_at, banned) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET name = $2, avatar = $3, joined = $4, signed_up = $5, steam_key = $6, key_at = $7, banned = $8`,
			u.ID, u.Name, u.Avatar, u.Joined, tptr(u.SignedUp), sptr(u.Key), tptr(u.KeyAt), u.Banned)
	}
	was := map[int64]comment{}
	for _, c := range old.Comments {
		was[c.ID] = c
	}
	for _, c := range s.Comments {
		if o, ok := was[c.ID]; ok {
			delete(was, c.ID)
			if o == c {
				continue
			}
		}
		var parent *int64
		if c.Parent != 0 {
			parent = &c.Parent
		}
		b.Queue(`INSERT INTO comments (id, parent, user_id, body, at, deleted) VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET parent = $2, user_id = $3, body = $4, at = $5, deleted = $6`, c.ID, parent, c.User, c.Text, c.At, c.Deleted)
	}
	for id := range was {
		b.Queue(`DELETE FROM comments WHERE id = $1`, id)
	}
	if st := s.Settings; st != old.Settings || old.Users == nil {
		b.Queue(`INSERT INTO settings (id, youtube_id, tagline, lead, video_note, key_note, signups_open, comments) VALUES (1, $1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (id) DO UPDATE SET youtube_id = $1, tagline = $2, lead = $3, video_note = $4, key_note = $5, signups_open = $6, comments = $7`,
			st.YouTubeID, st.Tagline, st.Lead, st.VideoNote, st.KeyNote, st.SignupsOpen, st.Comments)
	}
	if b.Len() == 0 {
		return nil
	}
	if err := tx.SendBatch(ctx, &b).Close(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *pgStore) importEmails(ctx context.Context, path string) error {
	list, err := emailSignupsFile(path)
	if err != nil || len(list) == 0 {
		return err
	}
	var b pgx.Batch
	for _, e := range list {
		b.Queue(`INSERT INTO email_signups (email, name, at) VALUES ($1, $2, $3)`, e.Email, e.Name, e.At)
	}
	if err := p.pool.SendBatch(ctx, &b).Close(); err != nil {
		return fmt.Errorf("copying %s into the database: %w", path, err)
	}
	os.Rename(path, path+".imported")
	log.Printf("%d email sign-up(s) copied into the database; the file is now signups.jsonl.imported", len(list))
	return nil
}

func (p *pgStore) emailSignups(ctx context.Context) ([]emailSignup, error) {
	rows, err := p.pool.Query(ctx, `SELECT email, name, at FROM email_signups ORDER BY at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []emailSignup
	for rows.Next() {
		var e emailSignup
		if err := rows.Scan(&e.Email, &e.Name, &e.At); err != nil {
			return nil, err
		}
		e.At = e.At.UTC()
		out = append(out, e)
	}
	return out, rows.Err()
}

// emailSignups: the older email sign-ups, from the database or the file.
func (a *app) emailSignups() ([]emailSignup, error) {
	if a.db.pg != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return a.db.pg.emailSignups(ctx)
	}
	return emailSignupsFile(filepath.Join(a.cfg.DataDir, "signups.jsonl"))
}

func copyState(s *state) state {
	c := *s
	c.Users = make(map[string]*user, len(s.Users))
	for k, u := range s.Users {
		x := *u
		c.Users[k] = &x
	}
	c.Comments = append([]comment(nil), s.Comments...)
	c.Keys = append([]string(nil), s.Keys...)
	return c
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func tval(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return t.UTC()
}

func tptr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func sptr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
