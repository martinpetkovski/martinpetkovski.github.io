package main

// Online events: the normal online mode inside a time window, under nicknames, with a ladder of its
// own. The admin makes an event (a name, a start, a length). In the game a player picks a nickname
// before each match; the first Steam account to claim a nickname in an event owns it there
// (POST /api/game/event/nickname, under a Steam ticket), and one account may hold any number of
// them. An event's matches are ordinary match reports that carry the event's id and every player's
// nickname: a nickname that is not its player's own is dropped (no entry), and a match counts for
// the event when it started inside the window and passes the same rules as the global ladder (no
// password, finished, one team all human, counted by the cross-check). Event matches never count
// for the global ladder. The event's ladder is the total score per nickname, with one holder for
// each achievement.
//
// The game: GET /api/game/events, POST /api/game/event/nickname, GET /api/game/event/ladder.
// The admin: /admin/game/events (and ?id= for one event), POST /admin/game/event.

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const eventSchema = `
CREATE TABLE IF NOT EXISTS events (
  id      BIGSERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  starts  TIMESTAMPTZ NOT NULL,
  seconds INTEGER NOT NULL,
  created TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_nicknames (  -- who owns a nickname in an event: the first account to claim it
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nick_key TEXT NOT NULL,                     -- the nickname in lower case: what makes it unique
  nickname TEXT NOT NULL,                     -- as its owner wrote it
  steam_id TEXT NOT NULL,
  created  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, nick_key)
);
CREATE INDEX IF NOT EXISTS event_nicknames_steam ON event_nicknames (event_id, steam_id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS event_id BIGINT NOT NULL DEFAULT 0;                 -- 0: not an event's match
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS nickname TEXT NOT NULL DEFAULT '';             -- the event entry ('' none, or not this player's own)
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS casts INTEGER NOT NULL DEFAULT 0;              -- abilities and ultimates used
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS tower_damage DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS tower_kills INTEGER NOT NULL DEFAULT 0;        -- last hits on towers
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS filmed DOUBLE PRECISION NOT NULL DEFAULT 0;    -- seconds the camera crew filmed a tower this player was hitting
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;             -- most kills without dying
CREATE INDEX IF NOT EXISTS matches_event ON matches (event_id) WHERE event_id <> 0;
`

// The matches the global ladders count: the cross-check's, outside events.
const ladderMatch = countedMatch + ` AND m.event_id = 0`

// The matches an event counts: its own, under the global ladder's rules.
const eventMatch = `m.event_id = $1 AND NOT m.voided AND NOT m.locked AND NOT m.abandoned AND ` + countedMatch + `
	AND EXISTS (SELECT 1 FROM generate_series(0, 1) AS t(team) WHERE NOT EXISTS (SELECT 1 FROM match_players x WHERE x.match_id = m.id AND x.team = t.team AND x.ai))`

// nickname tidies what a player typed: single spaces, 2 to 20 letters, digits, spaces and common
// punctuation. ok false: not a nickname.
func nickname(s string) (string, bool) {
	s = strings.Join(strings.Fields(s), " ")
	n := 0
	for _, c := range s {
		if c == '^' || c == '<' || c == '>' || c == '\\' || !(unicode.IsLetter(c) || unicode.IsDigit(c) || c == ' ' || unicode.IsPunct(c) || unicode.IsSymbol(c)) {
			return "", false
		}
		n++
	}
	return s, n >= 2 && n <= 20
}

func nickKey(s string) string { return strings.ToLower(strings.Join(strings.Fields(s), " ")) }

// ---------------------------------------------------------------- the game's endpoints

type eventInfo struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Starts int64  `json:"starts"` // Unix seconds
	Ends   int64  `json:"ends"`
}

// GET /api/game/events: the running and the coming events, the nearest first, with the site's clock.
func (a *app) eventsAPI(w http.ResponseWriter, r *http.Request) {
	if a.db.pg == nil {
		http.Error(w, "no database", http.StatusServiceUnavailable)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	out := struct {
		Now    int64       `json:"now"`
		Events []eventInfo `json:"events"`
	}{Now: time.Now().Unix(), Events: []eventInfo{}}
	rows, err := a.db.pg.pool.Query(ctx, `SELECT id, name, starts, seconds FROM events WHERE starts + make_interval(secs => seconds) > now() ORDER BY starts LIMIT 8`)
	if err != nil {
		log.Printf("events api: %v", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	for rows.Next() {
		var e eventInfo
		var starts time.Time
		var seconds int
		if err := rows.Scan(&e.ID, &e.Name, &starts, &seconds); err != nil {
			break
		}
		e.Starts, e.Ends = starts.Unix(), starts.Unix()+int64(seconds)
		out.Events = append(out.Events, e)
	}
	rows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(out)
}

// POST /api/game/event/nickname: claim a nickname in a running event, or confirm one already held.
// 200 it is this account's; 409 another account's; 422 not a nickname; 410 no such running event;
// 401 a new ticket, then again; 503 later.
func (a *app) eventNickname(w http.ResponseWriter, r *http.Request) {
	if a.db.pg == nil {
		apiAnswer(w, http.StatusServiceUnavailable, "no database")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	var in struct {
		Ticket   string `json:"ticket"`
		Identity string `json:"identity"`
		Steam    string `json:"steam"` // used only on a server without a publisher key (nothing to check with)
		Event    int64  `json:"event"`
		Nickname string `json:"nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Event <= 0 {
		apiAnswer(w, http.StatusBadRequest, "not a claim")
		return
	}
	nick, ok := nickname(in.Nickname)
	if !ok {
		apiAnswer(w, http.StatusUnprocessableEntity, "not a nickname")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	var id string
	var configured bool
	var err error
	if known, found := tickets.get(in.Ticket, in.Identity); found {
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
		log.Printf("event nickname: %v", err)
		apiAnswer(w, http.StatusServiceUnavailable, "try again later")
		return
	case !configured:
		if id = in.Steam; !steam64Re.MatchString(id) {
			apiAnswer(w, http.StatusUnauthorized, "no account")
			return
		}
	}
	if !reportAllowed("nick:" + id) {
		apiAnswer(w, http.StatusTooManyRequests, "too many claims")
		return
	}
	pool := a.db.pg.pool
	var banned bool
	pool.QueryRow(ctx, `SELECT upload_banned FROM game_players WHERE steam_id = $1`, id).Scan(&banned)
	if banned {
		apiAnswer(w, http.StatusForbidden, "refused")
		return
	}
	var running bool
	if err := pool.QueryRow(ctx, `SELECT now() >= starts AND now() < starts + make_interval(secs => seconds) FROM events WHERE id = $1`, in.Event).Scan(&running); err != nil || !running {
		apiAnswer(w, http.StatusGone, "no such running event")
		return
	}
	var owner string
	err = pool.QueryRow(ctx, `INSERT INTO event_nicknames (event_id, nick_key, nickname, steam_id) VALUES ($1, $2, $3, $4)
		ON CONFLICT (event_id, nick_key) DO UPDATE SET nick_key = EXCLUDED.nick_key RETURNING steam_id`, in.Event, nickKey(nick), nick, id).Scan(&owner)
	if err != nil {
		log.Printf("event nickname: %v", err)
		apiAnswer(w, http.StatusServiceUnavailable, "try again later")
		return
	}
	if owner != id {
		apiAnswer(w, http.StatusConflict, "that nickname is taken")
		return
	}
	apiAnswer(w, http.StatusOK, "yours")
}

type eventEntry struct {
	Rank                                    int
	Nickname, Steam, Country                string
	Score, Damage, Best, TowerDamage, Filmed float64
	Matches, Wins, Kills, Assists           int
	Casts, TowerKills, Streak               int
}

type eventAward struct {
	Title, Nickname string
	Value           float64
}

// eventFigures: the achievements, each a figure of an entry; id is what the game picks the icon by.
var eventFigures = []struct {
	id, title string
	of        func(e *eventEntry) float64
}{
	{"kills", "MOST KILLS", func(e *eventEntry) float64 { return float64(e.Kills) }},
	{"assists", "MOST ASSISTS", func(e *eventEntry) float64 { return float64(e.Assists) }},
	{"damage", "MOST DAMAGE", func(e *eventEntry) float64 { return e.Damage }},
	{"wins", "MOST WINS", func(e *eventEntry) float64 { return float64(e.Wins) }},
	{"best", "BEST MATCH", func(e *eventEntry) float64 { return e.Best }},
	{"casts", "MOST ABILITIES USED", func(e *eventEntry) float64 { return float64(e.Casts) }},
	{"towerDamage", "TOWER BREAKER", func(e *eventEntry) float64 { return e.TowerDamage }},
	{"towerKills", "LAST HIT", func(e *eventEntry) float64 { return float64(e.TowerKills) }},
	{"filmed", "ON AIR", func(e *eventEntry) float64 { return e.Filmed }},
	{"streak", "LONGEST STREAK", func(e *eventEntry) float64 { return float64(e.Streak) }},
}

// eventBoard: one achievement's own ladder for the game (the top 50 entries by its figure, and the asked nickname's row).
type eventBoard struct {
	ID      string        `json:"id"`
	Title   string        `json:"title"`
	Entries []ladderEntry `json:"entries"`
	Me      *ladderEntry  `json:"me,omitempty"`
}

// eventLadder: an event's entries, the highest total score first, and its achievements.
func (a *app) eventLadder(ctx context.Context, event int64) ([]eventEntry, []eventAward, int, error) {
	pool := a.db.pg.pool
	var matches int
	pool.QueryRow(ctx, `SELECT count(*) FROM matches m WHERE `+eventMatch, event).Scan(&matches)
	rows, err := pool.Query(ctx, `SELECT p.nickname, max(p.steam_id), coalesce(max(g.country), ''), sum(p.score), count(*), count(*) FILTER (WHERE p.team = m.winner),
			sum(p.kills), sum(p.assists), sum(p.damage), max(p.score), sum(p.casts), sum(p.tower_damage), sum(p.tower_kills), sum(p.filmed), max(p.streak)
		FROM match_players p JOIN matches m ON m.id = p.match_id LEFT JOIN game_players g ON g.steam_id = p.steam_id
		WHERE `+eventMatch+` AND p.nickname <> '' AND NOT p.ai AND NOT coalesce(g.upload_banned, false)
		GROUP BY p.nickname ORDER BY sum(p.score) DESC, p.nickname`, event)
	if err != nil {
		return nil, nil, 0, err
	}
	var list []eventEntry
	for rows.Next() {
		var e eventEntry
		if err := rows.Scan(&e.Nickname, &e.Steam, &e.Country, &e.Score, &e.Matches, &e.Wins, &e.Kills, &e.Assists, &e.Damage, &e.Best,
			&e.Casts, &e.TowerDamage, &e.TowerKills, &e.Filmed, &e.Streak); err != nil {
			rows.Close()
			return nil, nil, 0, err
		}
		e.Rank = len(list) + 1
		list = append(list, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, 0, err
	}
	var awards []eventAward
	for _, f := range eventFigures { // one holder each: the highest figure (a tie: the higher on the ladder)
		best := -1
		for i := range list {
			if v := f.of(&list[i]); v > 0 && (best < 0 || v > f.of(&list[best])) {
				best = i
			}
		}
		if best >= 0 {
			awards = append(awards, eventAward{Title: f.title, Nickname: list[best].Nickname, Value: f.of(&list[best])})
		}
	}
	return list, awards, matches, nil
}

// GET /api/game/event/ladder?event=ID&nick=NICKNAME: an event's ladder in the shape of the game's
// LADDER screen (ladder_api.go): "players" the top 50 entries with the total score as the rating,
// "me" the asked nickname's row, "countries" the achievements' holders (the title and its holder as
// the name, the figure as the rating), and "boards": each achievement as a ladder of its own.
func (a *app) eventLadderAPI(w http.ResponseWriter, r *http.Request) {
	if a.db.pg == nil {
		http.Error(w, "no database", http.StatusServiceUnavailable)
		return
	}
	event, _ := strconv.ParseInt(r.URL.Query().Get("event"), 10, 64)
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	list, awards, matches, err := a.eventLadder(ctx, event)
	if err != nil {
		log.Printf("event ladder api: %v", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	mine := nickKey(clip(r.URL.Query().Get("nick"), 40))
	out := ladderReply{Rated: matches, Players: []ladderEntry{}, Countries: []ladderEntry{}}
	for _, e := range list {
		row := ladderEntry{Rank: e.Rank, Name: e.Nickname, Country: e.Country, Rating: int(e.Score + .5)}
		if e.Rank <= ladderTop {
			out.Players = append(out.Players, row)
		}
		if mine != "" && nickKey(e.Nickname) == mine {
			me := row
			out.Me = &me
		}
	}
	for i, x := range awards {
		out.Countries = append(out.Countries, ladderEntry{Rank: i + 1, Name: x.Title + ": " + x.Nickname, Rating: int(x.Value + .5)})
	}
	boards := []eventBoard{} // every achievement as a ladder of its own: the entries with something to show, the highest first
	for _, f := range eventFigures {
		order := make([]*eventEntry, 0, len(list))
		for i := range list {
			if f.of(&list[i]) > 0 {
				order = append(order, &list[i])
			}
		}
		sort.SliceStable(order, func(a, b int) bool { return f.of(order[a]) > f.of(order[b]) })
		board := eventBoard{ID: f.id, Title: f.title, Entries: []ladderEntry{}}
		for i, e := range order {
			row := ladderEntry{Rank: i + 1, Name: e.Nickname, Country: e.Country, Rating: int(f.of(e) + .5)}
			if i < ladderTop {
				board.Entries = append(board.Entries, row)
			}
			if mine != "" && nickKey(e.Nickname) == mine {
				me := row
				board.Me = &me
			}
		}
		boards = append(boards, board)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(struct {
		ladderReply
		Boards []eventBoard `json:"boards"`
	}{out, boards})
}

// ---------------------------------------------------------------- the admin's page

type eventRow struct {
	ID                 int64
	Name               string
	Starts, Ends       time.Time
	Minutes            int
	Matches, Nicknames int
}

func (e eventRow) State() string {
	now := time.Now()
	switch {
	case now.Before(e.Starts):
		return "coming"
	case now.Before(e.Ends):
		return "running"
	}
	return "over"
}

type nickRow struct {
	Key, Nickname, Steam, Name string
	Created                    time.Time
}

// loadEvents fills the Events tab: every event, and with ?id= one event's ladder, achievements and nicknames.
func (a *app) loadEvents(ctx context.Context, d *gamePage, id int64) error {
	pool := a.db.pg.pool
	rows, err := pool.Query(ctx, `SELECT e.id, e.name, e.starts, e.seconds,
			(SELECT count(*) FROM matches m WHERE m.event_id = e.id), (SELECT count(*) FROM event_nicknames n WHERE n.event_id = e.id)
		FROM events e ORDER BY e.starts DESC LIMIT 200`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var e eventRow
		var seconds int
		if err := rows.Scan(&e.ID, &e.Name, &e.Starts, &seconds, &e.Matches, &e.Nicknames); err != nil {
			rows.Close()
			return err
		}
		e.Starts = e.Starts.UTC()
		e.Ends, e.Minutes = e.Starts.Add(time.Duration(seconds)*time.Second), seconds/60
		d.Events = append(d.Events, e)
		if e.ID == id {
			one := e
			d.Event = &one
		}
	}
	rows.Close()
	if d.Event == nil {
		return rows.Err()
	}
	if d.EventLadder, d.EventAwards, d.Rated, err = a.eventLadder(ctx, id); err != nil {
		return err
	}
	rows, err = pool.Query(ctx, `SELECT n.nick_key, n.nickname, n.steam_id, coalesce(g.name, ''), n.created FROM event_nicknames n
		LEFT JOIN game_players g ON g.steam_id = n.steam_id WHERE n.event_id = $1 ORDER BY n.created LIMIT 2000`, id)
	if err != nil {
		return err
	}
	for rows.Next() {
		var n nickRow
		if err := rows.Scan(&n.Key, &n.Nickname, &n.Steam, &n.Name, &n.Created); err != nil {
			rows.Close()
			return err
		}
		d.Nicknames = append(d.Nicknames, n)
	}
	rows.Close()
	return rows.Err()
}

// POST /admin/game/event: create an event; end a running one now; delete one (its matches stay in
// the match list and count for no ladder); take a nickname away.
func (a *app) eventAction(w http.ResponseWriter, r *http.Request) {
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
	back, message := "/admin/game/events", "Done."
	var err error
	switch r.PostFormValue("do") {
	case "create":
		name := clip(r.PostFormValue("name"), 60)
		starts, perr := time.ParseInLocation("2006-01-02T15:04", strings.TrimSpace(r.PostFormValue("starts")), time.UTC)
		minutes, _ := strconv.Atoi(strings.TrimSpace(r.PostFormValue("minutes")))
		if name == "" || perr != nil || minutes < 1 || minutes > 60*24*60 {
			message = "An event needs a name, a start (UTC) and a length in minutes."
			break
		}
		_, err = pool.Exec(ctx, `INSERT INTO events (name, starts, seconds) VALUES ($1, $2, $3)`, name, starts, minutes*60)
		message = "Event created."
	case "end": // a running event stops now
		_, err = pool.Exec(ctx, `UPDATE events SET seconds = greatest(0, extract(epoch FROM now() - starts)::int) WHERE id = $1 AND now() >= starts AND now() < starts + make_interval(secs => seconds)`, id)
		back, message = back+"?id="+strconv.FormatInt(id, 10), "Event ended."
	case "delete":
		_, err = pool.Exec(ctx, `DELETE FROM events WHERE id = $1`, id)
		message = "Event deleted."
	case "nickname": // the nickname is free again; what was played under it leaves the ladder
		key := r.PostFormValue("key")
		if _, err = pool.Exec(ctx, `UPDATE match_players p SET nickname = '' FROM matches m WHERE m.id = p.match_id AND m.event_id = $1 AND lower(p.nickname) = $2`, id, key); err == nil {
			_, err = pool.Exec(ctx, `DELETE FROM event_nicknames WHERE event_id = $1 AND nick_key = $2`, id, key)
		}
		back, message = back+"?id="+strconv.FormatInt(id, 10), "Nickname removed."
	default:
		message = "Nothing to do."
	}
	if err != nil {
		log.Printf("admin event action: %v", err)
		message = "That did not work."
	}
	sep := "?"
	if strings.Contains(back, "?") {
		sep = "&"
	}
	http.Redirect(w, r, back+sep+"m="+urlq(message), http.StatusSeeOther)
}
