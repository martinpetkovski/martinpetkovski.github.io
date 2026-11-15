package main

// Everything the site remembers, in one JSON file (data/site.json): the Steam accounts that
// signed in, who joined the playtest and which key they got, the comments, the unused keys
// and the settings the admin panel changes. Small enough to keep in memory; every change is
// written straight away (to a temporary file first, so a crash never leaves half a file).

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type user struct {
	ID       string    `json:"id"` // SteamID64
	Name     string    `json:"name"`
	Avatar   string    `json:"avatar,omitempty"`
	Joined   time.Time `json:"joined"`             // first sign-in
	SignedUp time.Time `json:"signedUp,omitempty"` // joined the playtest (zero: not)
	Key      string    `json:"key,omitempty"`      // the Steam key given to them
	KeyAt    time.Time `json:"keyAt,omitempty"`
	Banned   bool      `json:"banned,omitempty"` // may not comment
}

func (u *user) tester() bool { return u != nil && !u.SignedUp.IsZero() }

type comment struct {
	ID   int64     `json:"id"`
	User string    `json:"user"`
	Text string    `json:"text"`
	At   time.Time `json:"at"`
}

type settings struct {
	YouTubeID   string `json:"youtubeId"`
	Tagline     string `json:"tagline"`
	Lead        string `json:"lead"`      // the line under "The council wants you"
	VideoNote   string `json:"videoNote"` // the line under the trailer
	KeyNote     string `json:"keyNote"`   // shown with a tester's key
	SignupsOpen bool   `json:"signupsOpen"`
	Comments    bool   `json:"comments"` // the comment section is shown
}

type state struct {
	Users    map[string]*user `json:"users"`
	Comments []comment        `json:"comments"`
	Keys     []string         `json:"keys"` // not given out yet
	Settings settings         `json:"settings"`
	NextID   int64            `json:"nextId"`
}

type db struct {
	mu   sync.Mutex
	path string
	s    state
}

func defaultSettings(youtube string) settings {
	return settings{
		YouTubeID:   youtube,
		Tagline:     "A multiplayer retro futuristic flying car combat game",
		Lead:        "Sign in with Steam to join the playtest. When a test opens, your Steam key appears right here.",
		VideoNote:   "All footage captured in engine",
		KeyNote:     "Redeem it on Steam, then find Static Over Midtown in your library.",
		SignupsOpen: true,
		Comments:    true,
	}
}

func openDB(dir, youtube string) (*db, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	d := &db{path: filepath.Join(dir, "site.json")}
	b, err := os.ReadFile(d.path)
	switch {
	case errors.Is(err, os.ErrNotExist):
		d.s.Settings = defaultSettings(youtube)
	case err != nil:
		return nil, err
	default:
		if err := json.Unmarshal(b, &d.s); err != nil {
			return nil, err
		}
	}
	if d.s.Users == nil {
		d.s.Users = map[string]*user{}
	}
	return d, nil
}

// do runs f with the data locked and saves when f says it changed something.
func (d *db) do(f func(s *state) bool) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !f(&d.s) {
		return nil
	}
	b, err := json.MarshalIndent(d.s, "", " ")
	if err != nil {
		return err
	}
	tmp := d.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, d.path)
}

// view runs f with the data locked, for reading.
func (d *db) view(f func(s *state)) { d.do(func(s *state) bool { f(s); return false }) }

func (s *state) testers() []*user {
	var out []*user
	for _, u := range s.Users {
		if u.tester() {
			out = append(out, u)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].SignedUp.Before(out[j].SignedUp) })
	return out
}

// giveKey hands the next unused key to u (false: none left, or u already has one).
func (s *state) giveKey(u *user) bool {
	if u.Key != "" || len(s.Keys) == 0 {
		return false
	}
	u.Key, s.Keys = s.Keys[0], s.Keys[1:]
	u.KeyAt = time.Now().UTC()
	return true
}

func (s *state) keyUsed(k string) bool {
	for _, x := range s.Keys {
		if x == k {
			return true
		}
	}
	for _, u := range s.Users {
		if u.Key == k {
			return true
		}
	}
	return false
}
