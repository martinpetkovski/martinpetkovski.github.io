package main

// Online matches, reported by the game (POST /api/game/match). Every human in a match sends its
// own report with a Steam ticket; the ticket is checked with Steam (STEAM_WEB_API_KEY, a
// publisher key), so a report can only be filed under the account that played. All reports are
// kept (match_reports); the match's own rows (matches, match_players) come from the host's
// report, or from the first one until the host's arrives. The reports are then compared with each
// other (crosscheck.go), which sets the match's status. Needs the database (DATABASE_URL).
//
// The admin's pages: /admin/game/matches (the list) and /admin/game/matches/{id} (one match).

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

const matchSchema = `
CREATE TABLE IF NOT EXISTS game_players (  -- everyone seen in a reported match
  steam_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',   -- the profile name, from their own report
  country       TEXT NOT NULL DEFAULT '',
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  upload_banned BOOLEAN NOT NULL DEFAULT false,  -- their reports are refused
  ladder_hidden BOOLEAN NOT NULL DEFAULT false,
  host_blocked  BOOLEAN NOT NULL DEFAULT false,
  note          TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS matches (
  id        BIGSERIAL PRIMARY KEY,
  match_key TEXT NOT NULL UNIQUE,           -- <Steam lobby id>-<round>: the same from every player
  host_id   TEXT NOT NULL DEFAULT '',
  ended     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when the first report arrived
  seconds   INTEGER NOT NULL DEFAULT 0,
  winner    INTEGER NOT NULL DEFAULT 0,      -- the team: 1 Volts, 0 Specters
  score0    INTEGER NOT NULL DEFAULT 0,
  score1    INTEGER NOT NULL DEFAULT 0,
  towers0   INTEGER NOT NULL DEFAULT 0,
  towers1   INTEGER NOT NULL DEFAULT 0,
  capacity  INTEGER NOT NULL DEFAULT 0,
  humans    INTEGER NOT NULL DEFAULT 0,
  locked    BOOLEAN NOT NULL DEFAULT false,  -- a password room
  protocol  BIGINT NOT NULL DEFAULT 0,
  content   BIGINT NOT NULL DEFAULT 0,       -- the game data's hash
  from_host BOOLEAN NOT NULL DEFAULT false,  -- the rows below come from the host's report
  status    TEXT NOT NULL DEFAULT 'unverified',
  voided    BOOLEAN NOT NULL DEFAULT false,
  note      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS matches_ended ON matches (ended DESC);
CREATE TABLE IF NOT EXISTS match_players (
  match_id  BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  slot      INTEGER NOT NULL,
  team      INTEGER NOT NULL,
  ai        BOOLEAN NOT NULL,
  steam_id  TEXT NOT NULL DEFAULT '',
  name      TEXT NOT NULL DEFAULT '',
  country   TEXT NOT NULL DEFAULT '',
  vehicle   TEXT NOT NULL DEFAULT '',
  level     INTEGER NOT NULL DEFAULT 0,
  kills     INTEGER NOT NULL DEFAULT 0,
  deaths    INTEGER NOT NULL DEFAULT 0,
  assists   INTEGER NOT NULL DEFAULT 0,
  score     DOUBLE PRECISION NOT NULL DEFAULT 0,
  damage    DOUBLE PRECISION NOT NULL DEFAULT 0,
  abilities JSONB NOT NULL DEFAULT '[]',
  passives  JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (match_id, slot)
);
CREATE INDEX IF NOT EXISTS match_players_steam ON match_players (steam_id);
CREATE TABLE IF NOT EXISTS match_reports (  -- every report as it came, one per player per match
  match_id  BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  reporter  TEXT NOT NULL,                   -- SteamID64
  verified  BOOLEAN NOT NULL,                -- Steam confirmed the ticket
  is_host   BOOLEAN NOT NULL,
  received  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip        TEXT NOT NULL DEFAULT '',
  body      JSONB NOT NULL,
  PRIMARY KEY (match_id, reporter)
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS abandoned BOOLEAN NOT NULL DEFAULT false;        -- never finished: the last host left (winner: ahead on points, -1 level)
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS left_match BOOLEAN NOT NULL DEFAULT false;  -- left mid-match (a bot drove on)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS crosscheck BOOLEAN NOT NULL DEFAULT false;       -- its status comes from the cross-check (crosscheck.go); false: stored before it
`

type reportAbility struct {
	ID    string  `json:"id"`
	Score float64 `json:"score"`
}

type reportPassive struct {
	ID   string `json:"id"`
	Rank int    `json:"rank"`
}

type reportPlayer struct {
	Slot      int             `json:"slot"`
	Team      int             `json:"team"`
	AI        bool            `json:"ai"`
	Left      bool            `json:"left"` // left mid-match: still counted as themselves
	Steam     string          `json:"steam"`
	Name      string          `json:"name"`
	Country   string          `json:"country"`
	Vehicle   string          `json:"vehicle"`
	Level     int             `json:"level"`
	Kills     int             `json:"kills"`
	Deaths    int             `json:"deaths"`
	Assists   int             `json:"assists"`
	Score     float64         `json:"score"`
	Damage    float64         `json:"damage"`
	Abilities []reportAbility `json:"abilities"`
	Passives  []reportPassive `json:"passives"`
	// an event's match (events.go), and what its achievements count
	Nickname    string  `json:"nickname"`
	Casts       int     `json:"casts"`
	TowerDamage float64 `json:"towerDamage"`
	TowerKills  int     `json:"towerKills"`
	Filmed      float64 `json:"filmed"`
	Streak      int     `json:"streak"`
}

type matchReport struct {
	Version      int            `json:"version"`
	Key          string         `json:"key"`
	Protocol     float64        `json:"protocol"`
	Content      float64        `json:"content"`
	Seconds      float64        `json:"seconds"`
	Winner       int            `json:"winner"`
	Abandoned    bool           `json:"abandoned"` // the last host left before the end
	Scores       [2]int         `json:"scores"`
	Towers       [2]int         `json:"towers"`
	Capacity     int            `json:"capacity"`
	Locked       bool           `json:"locked"`
	ReporterSlot int            `json:"reporterSlot"`
	HostSlot     int            `json:"hostSlot"`
	Event        int64          `json:"event"` // the online event it was played in (0 none)
	Players      []reportPlayer `json:"players"`
}

var (
	matchKeyRe = regexp.MustCompile(`^\d{5,20}-\d{1,10}$`)
	steam64Re  = regexp.MustCompile(`^\d{17}$`)
	hexRe      = regexp.MustCompile(`^[0-9a-fA-F]+$`) // length checked apart: Go allows repeats up to {,1000}
	countryRe  = regexp.MustCompile(`^[A-Z]{2}$`)
)

func finite(v float64, max float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0 && v <= max
}

// check makes sure a report is one the game could have written (shape and bounds only).
func (m *matchReport) check() error {
	if m.Version != 1 {
		return errors.New("unknown report version")
	}
	if !matchKeyRe.MatchString(m.Key) {
		return errors.New("bad match key")
	}
	if m.Capacity < 2 || m.Capacity > 10 || m.Capacity%2 != 0 || len(m.Players) != m.Capacity {
		return errors.New("bad player count")
	}
	if m.Winner < -1 || m.Winner > 1 || (m.Winner < 0 && !m.Abandoned) || !finite(m.Seconds, 86400) || !finite(m.Protocol, 1e12) || !finite(m.Content, 1e12) {
		return errors.New("bad result")
	}
	for _, v := range []int{m.Scores[0], m.Scores[1], m.Towers[0], m.Towers[1]} {
		if v < 0 || v > 1000000 {
			return errors.New("bad score")
		}
	}
	if m.ReporterSlot < 0 || m.ReporterSlot >= m.Capacity || m.HostSlot < 0 || m.HostSlot >= m.Capacity || m.Event < 0 {
		return errors.New("bad slot")
	}
	seen := map[int]bool{}
	ids := map[string]bool{}
	for i := range m.Players {
		p := &m.Players[i]
		if p.Slot < 0 || p.Slot >= m.Capacity || seen[p.Slot] || p.Team < 0 || p.Team > 1 {
			return errors.New("bad player slot")
		}
		seen[p.Slot] = true
		if p.AI {
			p.Steam, p.Country = "", ""
		} else if !steam64Re.MatchString(p.Steam) || ids[p.Steam] {
			return errors.New("bad Steam id")
		}
		ids[p.Steam] = true
		if p.Country != "" && !countryRe.MatchString(p.Country) {
			p.Country = ""
		}
		p.Name, p.Vehicle = clip(strings.TrimSpace(p.Name), 64), clip(p.Vehicle, 96)
		if p.Level < 0 || p.Level > 10000 || p.Kills < 0 || p.Kills > 1000000 || p.Deaths < 0 || p.Deaths > 1000000 ||
			p.Assists < 0 || p.Assists > 1000000 || !finite(p.Score, 1e9) || !finite(p.Damage, 1e12) {
			return errors.New("bad player figures")
		}
		if p.Nickname = clip(p.Nickname, 40); p.AI || m.Event == 0 {
			p.Nickname = ""
		}
		if p.Casts < 0 || p.Casts > 1000000 || p.TowerKills < 0 || p.TowerKills > 1000 || p.Streak < 0 || p.Streak > 1000000 ||
			!finite(p.TowerDamage, 1e12) || !finite(p.Filmed, 86400) {
			return errors.New("bad player figures")
		}
		if len(p.Abilities) > 8 || len(p.Passives) > 8 {
			return errors.New("too many abilities")
		}
		for j := range p.Abilities {
			if p.Abilities[j].ID = clip(p.Abilities[j].ID, 96); !finite(p.Abilities[j].Score, 1e9) {
				return errors.New("bad ability score")
			}
		}
		for j := range p.Passives {
			if p.Passives[j].ID = clip(p.Passives[j].ID, 96); p.Passives[j].Rank < 0 || p.Passives[j].Rank > 100 {
				return errors.New("bad passive rank")
			}
		}
	}
	if m.player(m.ReporterSlot).AI || m.player(m.HostSlot).AI {
		return errors.New("the reporter and the host are players")
	}
	return nil
}

func (m *matchReport) player(slot int) *reportPlayer {
	for i := range m.Players {
		if m.Players[i].Slot == slot {
			return &m.Players[i]
		}
	}
	return &reportPlayer{AI: true}
}

func (m *matchReport) humans() int {
	n := 0
	for _, p := range m.Players {
		if !p.AI {
			n++
		}
	}
	return n
}

// ---------------------------------------------------------------- Steam tickets

var errTicket = errors.New("Steam did not accept the ticket")

// steamTicket asks Steam whose ticket this is. configured false: no publisher key on this
// server, nothing was checked.
func steamTicket(ctx context.Context, ticket, identity string) (id string, configured bool, err error) {
	key := strings.TrimSpace(os.Getenv("STEAM_WEB_API_KEY"))
	if key == "" {
		return "", false, nil
	}
	if n := len(ticket); n < 16 || n > 5120 || !hexRe.MatchString(ticket) {
		return "", true, errTicket
	}
	q := url.Values{"key": {key}, "appid": {env("STEAM_APP_ID", "5466920")}, "ticket": {ticket}}
	if identity != "" {
		q.Set("identity", clip(identity, 64))
	}
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/?"+q.Encode(), nil)
	resp, err := httpc.Do(req)
	if err != nil {
		return "", true, errors.New("Steam could not be reached") // (never the URL: it holds the key)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
		return "", true, errors.New("Steam refused this server's key (STEAM_WEB_API_KEY)")
	}
	if resp.StatusCode >= 500 {
		return "", true, fmt.Errorf("Steam answered %d", resp.StatusCode)
	}
	var out struct {
		Response struct {
			Params *struct {
				Result          string `json:"result"`
				SteamID         string `json:"steamid"`
				PublisherBanned bool   `json:"publisherbanned"`
			} `json:"params"`
		} `json:"response"`
	}
	json.Unmarshal(body, &out)
	p := out.Response.Params
	if p == nil || p.Result != "OK" || !steam64Re.MatchString(p.SteamID) || p.PublisherBanned {
		return "", true, errTicket
	}
	return p.SteamID, true, nil
}

// tickets: the tickets Steam confirmed lately (ticket+identity -> SteamID64), for 6 hours,
// so a player's next reports with the same ticket need no new check.
var tickets = &ticketCache{at: map[[32]byte]ticketEntry{}}

type ticketEntry struct {
	id      string
	expires time.Time
}

type ticketCache struct {
	sync.Mutex
	at map[[32]byte]ticketEntry
}

func ticketKey(ticket, identity string) [32]byte { return sha256.Sum256([]byte(identity + "\x00" + ticket)) }

func (c *ticketCache) get(ticket, identity string) (string, bool) {
	if ticket == "" {
		return "", false
	}
	c.Lock()
	defer c.Unlock()
	e, ok := c.at[ticketKey(ticket, identity)]
	if !ok || time.Now().After(e.expires) {
		return "", false
	}
	return e.id, true
}

func (c *ticketCache) put(ticket, identity, id string) {
	c.Lock()
	defer c.Unlock()
	now := time.Now()
	if len(c.at) >= 100000 { // forget the expired ones (and, if still full, everything)
		for k, e := range c.at {
			if now.After(e.expires) {
				delete(c.at, k)
			}
		}
		if len(c.at) >= 100000 {
			c.at = map[[32]byte]ticketEntry{}
		}
	}
	c.at[ticketKey(ticket, identity)] = ticketEntry{id: id, expires: now.Add(6 * time.Hour)}
}

// ---------------------------------------------------------------- the game's endpoint

func apiAnswer(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"ok": status < 300, "message": message})
}

// a report limiter: at most 40 an hour per account (a match takes minutes; retries are rare)
var reportHits = struct {
	sync.Mutex
	at map[string][]time.Time
}{at: map[string][]time.Time{}}

func reportAllowed(id string) bool {
	reportHits.Lock()
	defer reportHits.Unlock()
	now := time.Now()
	keep := reportHits.at[id][:0]
	for _, t := range reportHits.at[id] {
		if now.Sub(t) < time.Hour {
			keep = append(keep, t)
		}
	}
	if len(keep) >= 40 {
		reportHits.at[id] = keep
		return false
	}
	reportHits.at[id] = append(keep, now)
	return true
}

// The answers the game acts on: 2xx taken; 400/403/413/422 refused for good (it drops the
// report); 401 a new ticket, then again; anything else (503): later.
func (a *app) gameMatch(w http.ResponseWriter, r *http.Request) {
	if a.db.pg == nil {
		apiAnswer(w, http.StatusServiceUnavailable, "no database")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512<<10)
	var in struct {
		Ticket   string          `json:"ticket"`
		Identity string          `json:"identity"`
		Report   json.RawMessage `json:"report"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || len(in.Report) == 0 {
		apiAnswer(w, http.StatusBadRequest, "not a report")
		return
	}
	var rep matchReport
	if err := json.Unmarshal(in.Report, &rep); err != nil {
		apiAnswer(w, http.StatusBadRequest, "not a report")
		return
	}
	if err := rep.check(); err != nil {
		apiAnswer(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	claimed := rep.player(rep.ReporterSlot).Steam
	// Every report's ticket is checked, the cross-check needs each one tied to its account. Steam
	// allows a publisher key ~100 000 checks a day: a ticket Steam already confirmed is remembered
	// for 6 hours and the game keeps using the same ticket for as long, so Steam is asked about
	// once per player per session, not once per match.
	var id string
	var configured bool
	var err error
	checked := true
	if known, ok := tickets.get(in.Ticket, in.Identity); ok {
		id, configured = known, true
	} else {
		id, configured, err = steamTicket(ctx, in.Ticket, in.Identity)
		if err == nil && configured {
			tickets.put(in.Ticket, in.Identity, id)
		}
	}
	switch {
	case errors.Is(err, errTicket):
		apiAnswer(w, http.StatusUnauthorized, err.Error())
		return
	case err != nil:
		log.Printf("match report: %v", err)
		apiAnswer(w, http.StatusServiceUnavailable, "try again later")
		return
	case !configured:
		id = claimed // nothing to check it with: kept as unverified
	case id != claimed:
		apiAnswer(w, http.StatusForbidden, "the ticket belongs to another account")
		return
	}
	if !reportAllowed(id) {
		apiAnswer(w, http.StatusTooManyRequests, "too many reports")
		return
	}
	ip := clip(r.Header.Get("CF-Connecting-IP"), 64)
	raw, _ := json.Marshal(rep) // (as checked and trimmed, not as sent)
	status, err := a.db.pg.storeReport(ctx, &rep, string(raw), id, configured && checked, ip)
	if err != nil {
		log.Printf("match report %s: %v", rep.Key, err)
		apiAnswer(w, http.StatusServiceUnavailable, "try again later")
		return
	}
	if status != http.StatusOK {
		apiAnswer(w, status, "refused")
		return
	}
	apiAnswer(w, http.StatusOK, "taken")
}

func jsonText(v any) string {
	b, err := json.Marshal(v)
	if err != nil || string(b) == "null" {
		return "[]"
	}
	return string(b)
}

// storeReport keeps one player's report; the match's rows are (re)written from the first report
// and from the host's. Returns an HTTP status (200: stored).
func (p *pgStore) storeReport(ctx context.Context, m *matchReport, raw, reporter string, verified bool, ip string) (int, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var banned bool
	if err := tx.QueryRow(ctx, `SELECT upload_banned FROM game_players WHERE steam_id = $1`, reporter).Scan(&banned); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	if banned {
		return http.StatusForbidden, nil
	}
	isHost := m.ReporterSlot == m.HostSlot
	var id int64
	var created, fromHost, wasAbandoned bool
	err = tx.QueryRow(ctx, `INSERT INTO matches (match_key) VALUES ($1)
		ON CONFLICT (match_key) DO UPDATE SET match_key = EXCLUDED.match_key
		RETURNING id, (xmax = 0), from_host, abandoned`, m.Key).Scan(&id, &created, &fromHost, &wasAbandoned)
	if err != nil {
		return 0, err
	}
	if created || (isHost && !fromHost) || (wasAbandoned && !m.Abandoned) { // (a finished report beats an abandoned one)
		// an event's match: the event it names, when the match began inside its window (it ended when
		// its first report arrived; two minutes' grace before the start for the countdown)
		event := int64(0)
		if m.Event > 0 {
			var inside bool
			if err := tx.QueryRow(ctx, `SELECT x.ended - make_interval(secs => $3) >= e.starts - interval '2 minutes'
					AND x.ended - make_interval(secs => $3) < e.starts + make_interval(secs => e.seconds)
				FROM events e, matches x WHERE e.id = $1 AND x.id = $2`, m.Event, id, m.Seconds).Scan(&inside); err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return 0, err
			}
			if inside {
				event = m.Event
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE matches SET event_id = $2 WHERE id = $1`, id, event); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `UPDATE matches SET host_id = $2, seconds = $3, winner = $4, score0 = $5, score1 = $6, towers0 = $7, towers1 = $8,
			capacity = $9, humans = $10, locked = $11, protocol = $12, content = $13, from_host = $14, abandoned = $15 WHERE id = $1`,
			id, m.player(m.HostSlot).Steam, int(m.Seconds), m.Winner, m.Scores[0], m.Scores[1], m.Towers[0], m.Towers[1],
			m.Capacity, m.humans(), m.Locked, int64(m.Protocol), int64(m.Content), isHost, m.Abandoned); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM match_players WHERE match_id = $1`, id); err != nil {
			return 0, err
		}
		for _, q := range m.Players {
			nick := "" // the event entry: the nickname as its owner wrote it; none when it is not this player's own
			if event != 0 && !q.AI && q.Nickname != "" {
				if err := tx.QueryRow(ctx, `SELECT nickname FROM event_nicknames WHERE event_id = $1 AND nick_key = $2 AND steam_id = $3`,
					event, nickKey(q.Nickname), q.Steam).Scan(&nick); err != nil && !errors.Is(err, pgx.ErrNoRows) {
					return 0, err
				}
			}
			if _, err := tx.Exec(ctx, `INSERT INTO match_players (match_id, slot, team, ai, steam_id, name, country, vehicle, level, kills, deaths, assists, score, damage, abilities, passives, left_match,
					nickname, casts, tower_damage, tower_kills, filmed, streak)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18, $19, $20, $21, $22, $23)`,
				id, q.Slot, q.Team, q.AI, q.Steam, q.Name, q.Country, q.Vehicle, q.Level, q.Kills, q.Deaths, q.Assists, q.Score, q.Damage,
				jsonText(q.Abilities), jsonText(q.Passives), q.Left && !q.AI, nick, q.Casts, q.TowerDamage, q.TowerKills, q.Filmed, q.Streak); err != nil {
				return 0, err
			}
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO match_reports (match_id, reporter, verified, is_host, ip, body) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
		ON CONFLICT (match_id, reporter) DO UPDATE SET verified = EXCLUDED.verified, is_host = EXCLUDED.is_host, received = now(), ip = EXCLUDED.ip, body = EXCLUDED.body`,
		id, reporter, verified, isHost, ip, raw); err != nil {
		return 0, err
	}
	if err := crossCheck(ctx, tx, id); err != nil {
		return 0, err
	}
	for _, q := range m.Players { // everyone in it is known from now on; a name and country only from their own report
		if q.AI {
			continue
		}
		if q.Steam == reporter && (verified || os.Getenv("STEAM_WEB_API_KEY") == "") {
			_, err = tx.Exec(ctx, `INSERT INTO game_players (steam_id, name, country) VALUES ($1, $2, $3)
				ON CONFLICT (steam_id) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country, last_seen = now()`, q.Steam, q.Name, q.Country)
		} else {
			_, err = tx.Exec(ctx, `INSERT INTO game_players (steam_id) VALUES ($1) ON CONFLICT (steam_id) DO UPDATE SET last_seen = now()`, q.Steam)
		}
		if err != nil {
			return 0, err
		}
	}
	return http.StatusOK, tx.Commit(ctx)
}

// ---------------------------------------------------------------- the admin's pages

type matchRow struct {
	ID                                  int64
	Key, HostID, HostName, Status, Note string
	Ended                               time.Time
	Seconds, Winner, Score0, Score1     int
	Towers0, Towers1, Capacity, Humans  int
	Locked, FromHost, Voided, Abandoned bool
	Protocol, Content                   int64
	Reports, Verified                   int
}

func (m matchRow) Duration() string { return fmt.Sprintf("%d:%02d", m.Seconds/60, m.Seconds%60) }
func (m matchRow) Format() string   { return fmt.Sprintf("%dv%d", m.Capacity/2, m.Capacity/2) }

type matchPlayerRow struct {
	reportPlayer
	AbilityText, PassiveText string
}

type matchReportRow struct {
	Reporter, Name, IP string
	Verified, IsHost   bool
	Received           time.Time
	Body               string
}

type matchesPage struct {
	Section  string
	Tab      string
	Me       *user
	IsAdmin  bool
	Message  string
	Database bool
	KeySet   bool // the Steam publisher key is configured
	Query    string
	Total    int
	Matches  []matchRow
	One      *matchRow // the detail page
	Teams    [2][]matchPlayerRow
	Reports  []matchReportRow
}

const matchColumns = `m.id, m.match_key, m.host_id, coalesce(h.name, ''), m.status, m.note, m.ended, m.seconds, m.winner, m.score0, m.score1,
	m.towers0, m.towers1, m.capacity, m.humans, m.locked, m.from_host, m.voided, m.protocol, m.content,
	(SELECT count(*) FROM match_reports r WHERE r.match_id = m.id), (SELECT count(*) FROM match_reports r WHERE r.match_id = m.id AND r.verified), m.abandoned`

func scanMatch(row pgx.Row, m *matchRow) error {
	return row.Scan(&m.ID, &m.Key, &m.HostID, &m.HostName, &m.Status, &m.Note, &m.Ended, &m.Seconds, &m.Winner, &m.Score0, &m.Score1,
		&m.Towers0, &m.Towers1, &m.Capacity, &m.Humans, &m.Locked, &m.FromHost, &m.Voided, &m.Protocol, &m.Content, &m.Reports, &m.Verified, &m.Abandoned)
}

func (a *app) adminMatches(w http.ResponseWriter, r *http.Request) {
	me := a.me(r)
	d := matchesPage{Section: "game", Tab: "matches", Me: me, IsAdmin: me != nil && a.cfg.Admins[me.ID], Database: a.db.pg != nil,
		KeySet: strings.TrimSpace(os.Getenv("STEAM_WEB_API_KEY")) != "", Query: clip(strings.TrimSpace(r.URL.Query().Get("q")), 64)}
	if m := r.URL.Query().Get("m"); m != "" && len(m) < 120 {
		d.Message = m
	}
	if d.IsAdmin && d.Database {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		pool := a.db.pg.pool
		pool.QueryRow(ctx, `SELECT count(*) FROM matches`).Scan(&d.Total)
		if idText := r.PathValue("id"); idText != "" {
			id, _ := strconv.ParseInt(idText, 10, 64)
			one := &matchRow{}
			if err := scanMatch(pool.QueryRow(ctx, `SELECT `+matchColumns+` FROM matches m LEFT JOIN game_players h ON h.steam_id = m.host_id WHERE m.id = $1`, id), one); err == nil {
				d.One = one
				a.matchDetail(ctx, &d, id)
			} else {
				d.Message = "No such match."
			}
		} else {
			// q: a SteamID64 (matches that account played), part of a match key, or a status ("disputed")
			rows, err := pool.Query(ctx, `SELECT `+matchColumns+` FROM matches m LEFT JOIN game_players h ON h.steam_id = m.host_id
				WHERE $1 = '' OR m.status = $1 OR m.match_key LIKE '%' || $1 || '%' OR EXISTS (SELECT 1 FROM match_players p WHERE p.match_id = m.id AND p.steam_id = $1)
				ORDER BY m.ended DESC LIMIT 200`, d.Query)
			if err != nil {
				log.Printf("admin matches: %v", err)
			} else {
				for rows.Next() {
					var m matchRow
					if err := scanMatch(rows, &m); err != nil {
						log.Printf("admin matches: %v", err)
						break
					}
					d.Matches = append(d.Matches, m)
				}
				rows.Close()
			}
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex")
	if err := a.pages.ExecuteTemplate(w, "admin_matches.html", d); err != nil {
		log.Printf("admin matches page: %v", err)
	}
}

func (a *app) matchDetail(ctx context.Context, d *matchesPage, id int64) {
	pool := a.db.pg.pool
	rows, err := pool.Query(ctx, `SELECT slot, team, ai, steam_id, name, country, vehicle, level, kills, deaths, assists, score, damage, abilities::text, passives::text, left_match
		FROM match_players WHERE match_id = $1 ORDER BY team DESC, slot`, id)
	if err != nil {
		log.Printf("admin match: %v", err)
		return
	}
	for rows.Next() {
		var p matchPlayerRow
		var abilities, passives string
		if err := rows.Scan(&p.Slot, &p.Team, &p.AI, &p.Steam, &p.Name, &p.Country, &p.Vehicle, &p.Level, &p.Kills, &p.Deaths, &p.Assists, &p.Score, &p.Damage, &abilities, &passives, &p.Left); err != nil {
			break
		}
		json.Unmarshal([]byte(abilities), &p.Abilities)
		json.Unmarshal([]byte(passives), &p.Passives)
		var parts []string
		for _, x := range p.Abilities {
			parts = append(parts, fmt.Sprintf("%s (%.0f)", x.ID, x.Score))
		}
		p.AbilityText = strings.Join(parts, ", ")
		parts = nil
		for _, x := range p.Passives {
			parts = append(parts, fmt.Sprintf("%s x%d", x.ID, x.Rank))
		}
		p.PassiveText = strings.Join(parts, ", ")
		if p.Team == 0 || p.Team == 1 {
			d.Teams[1-p.Team] = append(d.Teams[1-p.Team], p) // Volts (team 1) first
		}
	}
	rows.Close()
	rows, err = pool.Query(ctx, `SELECT r.reporter, coalesce(g.name, ''), r.ip, r.verified, r.is_host, r.received, jsonb_pretty(r.body)
		FROM match_reports r LEFT JOIN game_players g ON g.steam_id = r.reporter WHERE r.match_id = $1 ORDER BY r.is_host DESC, r.received`, id)
	if err != nil {
		log.Printf("admin match: %v", err)
		return
	}
	for rows.Next() {
		var x matchReportRow
		if err := rows.Scan(&x.Reporter, &x.Name, &x.IP, &x.Verified, &x.IsHost, &x.Received, &x.Body); err != nil {
			break
		}
		d.Reports = append(d.Reports, x)
	}
	rows.Close()
}

// POST /admin/matches/action: void / unvoid / accept / delete one match, or a note on it.
func (a *app) adminMatchAction(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) || !a.isAdmin(r) || a.db.pg == nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	r.ParseForm()
	id, _ := strconv.ParseInt(r.PostFormValue("id"), 10, 64)
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	pool := a.db.pg.pool
	var err error
	back, message := "/admin/game/matches/"+strconv.FormatInt(id, 10), "Done."
	switch r.PostFormValue("do") {
	case "void":
		_, err = pool.Exec(ctx, `UPDATE matches SET voided = true WHERE id = $1`, id)
		message = "Match voided."
	case "unvoid":
		_, err = pool.Exec(ctx, `UPDATE matches SET voided = false WHERE id = $1`, id)
		message = "Match restored."
	case "accept": // a disputed match the admin has looked at: it counts, whatever reports still arrive
		_, err = pool.Exec(ctx, `UPDATE matches SET status = 'accepted', crosscheck = true WHERE id = $1`, id)
		message = "Match accepted."
	case "note":
		_, err = pool.Exec(ctx, `UPDATE matches SET note = $2 WHERE id = $1`, id, clip(strings.TrimSpace(r.PostFormValue("note")), 500))
		message = "Note saved."
	case "delete":
		_, err = pool.Exec(ctx, `DELETE FROM matches WHERE id = $1`, id)
		back, message = "/admin/game/matches", "Match deleted."
	default:
		message = "Nothing to do."
	}
	if err != nil {
		log.Printf("admin match action: %v", err)
		message = "That did not work."
	}
	http.Redirect(w, r, back+"?m="+urlq(message), http.StatusSeeOther)
}
