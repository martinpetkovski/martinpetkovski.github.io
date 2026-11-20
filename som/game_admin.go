package main

// The admin panel's Game section (the Test enlistment section is admin.html): the matches
// (matches.go), the players, the provisional ladders of the players and of the countries, and the
// servers (the hosts of the reported matches). Banning, hiding from the ladders and blocking a
// host are flags on game_players. Needs the database (DATABASE_URL).
//
// The ladders are provisional: they are computed from the stored matches on every visit (stage 4 of
// claude/match-logging-plan.md keeps them). Rated matches: not voided, no password, at least one
// team all human, and counted by the cross-check (crosscheck.go: verified, single or accepted). Elo: every player against the enemy team's average rating (AI seats at a fixed
// rating); the result counts twice as much as the player's score against the enemy team's.

import (
	"context"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	eloStart = 1000.0 // a new player, and every AI seat
	eloK     = 32.0
)

// adminNav: what the shared header (templates/admin_nav.html) needs.
type adminNav struct {
	Me       *user
	IsAdmin  bool
	Section  string // "game" or "test"
	Tab      string // the Game section's page
	Database bool
	Message  string
}

type gamePlayerRow struct {
	ID, Name, Country, Note               string
	FirstSeen, LastSeen                   time.Time
	Banned, Hidden, HostBlocked           bool
	Matches, Wins, Kills, Deaths, Assists int
}

type ladderRow struct {
	Rank                 int
	ID, Name, Country    string
	Rating               float64
	Played, Wins, Losses int
	Last                 time.Time
}

type countryRow struct {
	Rank                  int
	Country, Flag, Best   string
	Players, Played, Wins int
	Rating, BestRating    float64
}

type hostRow struct {
	ID, Name               string
	Hosted, Voided, Humans int
	Last                   time.Time
	Blocked                bool
}

type gamePage struct {
	adminNav
	Query     string
	Players   []gamePlayerRow
	Ladder    []ladderRow
	Countries []countryRow
	Hosts     []hostRow
	Rated     int // matches the ladders count
}

func (a *app) nav(r *http.Request, section, tab string) adminNav {
	me := a.me(r)
	n := adminNav{Me: me, IsAdmin: me != nil && a.cfg.Admins[me.ID], Section: section, Tab: tab, Database: a.db.pg != nil}
	if m := r.URL.Query().Get("m"); m != "" && len(m) < 120 {
		n.Message = m
	}
	return n
}

// flag: a country's flag as the emoji pair of regional indicator letters
func flag(code string) string {
	if len(code) != 2 {
		return ""
	}
	r := []rune{}
	for _, c := range strings.ToUpper(code) {
		if c < 'A' || c > 'Z' {
			return ""
		}
		r = append(r, 0x1F1E6+(c-'A'))
	}
	return string(r)
}

func (a *app) gameAdmin(w http.ResponseWriter, r *http.Request) {
	tab := r.PathValue("tab")
	switch tab {
	case "players", "ladder", "countries", "servers":
	default:
		http.Redirect(w, r, "/admin/game/matches", http.StatusSeeOther)
		return
	}
	d := gamePage{adminNav: a.nav(r, "game", tab), Query: clip(strings.TrimSpace(r.URL.Query().Get("q")), 64)}
	if d.IsAdmin && d.Database {
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		var err error
		switch tab {
		case "players":
			err = a.loadPlayers(ctx, &d)
		case "ladder", "countries":
			err = a.loadLadders(ctx, &d)
		case "servers":
			err = a.loadHosts(ctx, &d)
		}
		if err != nil {
			log.Printf("admin game %s: %v", tab, err)
			d.Message = "The database did not answer."
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex")
	if err := a.pages.ExecuteTemplate(w, "admin_game.html", d); err != nil {
		log.Printf("admin game page: %v", err)
	}
}

func (a *app) loadPlayers(ctx context.Context, d *gamePage) error {
	rows, err := a.db.pg.pool.Query(ctx, `SELECT g.steam_id, g.name, g.country, g.note, g.first_seen, g.last_seen, g.upload_banned, g.ladder_hidden, g.host_blocked,
		count(m.id) FILTER (WHERE NOT m.voided),
		count(m.id) FILTER (WHERE NOT m.voided AND p.team = m.winner),
		coalesce(sum(p.kills) FILTER (WHERE NOT m.voided), 0), coalesce(sum(p.deaths) FILTER (WHERE NOT m.voided), 0), coalesce(sum(p.assists) FILTER (WHERE NOT m.voided), 0)
		FROM game_players g LEFT JOIN match_players p ON p.steam_id = g.steam_id LEFT JOIN matches m ON m.id = p.match_id
		WHERE $1 = '' OR g.steam_id = $1 OR g.name ILIKE '%' || $1 || '%' OR g.country = upper($1)
		GROUP BY g.steam_id ORDER BY g.last_seen DESC LIMIT 500`, d.Query)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var p gamePlayerRow
		if err := rows.Scan(&p.ID, &p.Name, &p.Country, &p.Note, &p.FirstSeen, &p.LastSeen, &p.Banned, &p.Hidden, &p.HostBlocked,
			&p.Matches, &p.Wins, &p.Kills, &p.Deaths, &p.Assists); err != nil {
			return err
		}
		d.Players = append(d.Players, p)
	}
	return rows.Err()
}

func (a *app) loadHosts(ctx context.Context, d *gamePage) error {
	rows, err := a.db.pg.pool.Query(ctx, `SELECT m.host_id, coalesce(max(g.name), ''), count(*), count(*) FILTER (WHERE m.voided),
		coalesce(sum(m.humans), 0), max(m.ended), coalesce(bool_or(g.host_blocked), false)
		FROM matches m LEFT JOIN game_players g ON g.steam_id = m.host_id
		WHERE m.host_id <> '' GROUP BY m.host_id ORDER BY max(m.ended) DESC LIMIT 500`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var h hostRow
		if err := rows.Scan(&h.ID, &h.Name, &h.Hosted, &h.Voided, &h.Humans, &h.Last, &h.Blocked); err != nil {
			return err
		}
		d.Hosts = append(d.Hosts, h)
	}
	return rows.Err()
}

// loadLadders replays every rated match, oldest first.
func (a *app) loadLadders(ctx context.Context, d *gamePage) error {
	pool := a.db.pg.pool
	type seat struct {
		team  int
		ai    bool
		steam string
		score float64
	}
	type match struct {
		winner int
		ended  time.Time
		seats  []seat
	}
	var order []int64
	games := map[int64]*match{}
	rows, err := pool.Query(ctx, `SELECT m.id, m.winner, m.ended FROM matches m WHERE NOT m.voided AND NOT m.locked AND NOT m.abandoned AND `+countedMatch+` ORDER BY m.ended, m.id`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id int64
		m := &match{}
		if err := rows.Scan(&id, &m.winner, &m.ended); err != nil {
			rows.Close()
			return err
		}
		games[id] = m
		order = append(order, id)
	}
	rows.Close()
	rows, err = pool.Query(ctx, `SELECT p.match_id, p.team, p.ai, p.steam_id, p.score FROM match_players p JOIN matches m ON m.id = p.match_id WHERE NOT m.voided AND NOT m.locked AND `+countedMatch)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id int64
		var s seat
		if err := rows.Scan(&id, &s.team, &s.ai, &s.steam, &s.score); err != nil {
			rows.Close()
			return err
		}
		if m := games[id]; m != nil {
			m.seats = append(m.seats, s)
		}
	}
	rows.Close()

	type standing struct {
		rating             float64
		played, wins, loss int
		last               time.Time
	}
	table := map[string]*standing{}
	get := func(id string) *standing {
		s := table[id]
		if s == nil {
			s = &standing{rating: eloStart}
			table[id] = s
		}
		return s
	}
	for _, id := range order {
		m := games[id]
		var humans, total [2]int
		var rating, score [2]float64
		for _, s := range m.seats {
			if s.team < 0 || s.team > 1 {
				continue
			}
			total[s.team]++
			score[s.team] += s.score
			if s.ai {
				rating[s.team] += eloStart
			} else {
				humans[s.team]++
				rating[s.team] += get(s.steam).rating
			}
		}
		if total[0] == 0 || total[1] == 0 || (humans[0] < total[0] && humans[1] < total[1]) {
			continue // rated: at least one team all human
		}
		d.Rated++
		var avg, avgScore [2]float64
		for t := 0; t < 2; t++ {
			avg[t], avgScore[t] = rating[t]/float64(total[t]), score[t]/float64(total[t])
		}
		delta := map[string]float64{}
		for _, s := range m.seats {
			if s.ai || s.steam == "" || s.team < 0 || s.team > 1 {
				continue
			}
			st, enemy := get(s.steam), 1-s.team
			won := 0.0
			if s.team == m.winner {
				won = 1
			}
			perf := .5 // the player's score against the enemy team's average
			if s.score+avgScore[enemy] > 0 {
				perf = s.score / (s.score + avgScore[enemy])
			}
			actual := (2*won + perf) / 3
			expected := 1 / (1 + math.Pow(10, (avg[enemy]-st.rating)/400))
			delta[s.steam] = eloK * (actual - expected)
			st.played++
			if won == 1 {
				st.wins++
			} else {
				st.loss++
			}
			st.last = m.ended
		}
		for id, dv := range delta { // the whole match at once: nobody's change moves another's expectation
			table[id].rating += dv
		}
	}

	// names, countries and flags
	type info struct {
		name, country  string
		hidden, banned bool
	}
	people := map[string]info{}
	rows, err = pool.Query(ctx, `SELECT steam_id, name, country, ladder_hidden, upload_banned FROM game_players`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id string
		var x info
		if err := rows.Scan(&id, &x.name, &x.country, &x.hidden, &x.banned); err != nil {
			rows.Close()
			return err
		}
		people[id] = x
	}
	rows.Close()

	countries := map[string]*countryRow{}
	for id, s := range table {
		p := people[id]
		if s.played == 0 || p.hidden || p.banned {
			continue
		}
		name := p.name
		if name == "" {
			name = id
		}
		d.Ladder = append(d.Ladder, ladderRow{ID: id, Name: name, Country: p.country, Rating: s.rating, Played: s.played, Wins: s.wins, Losses: s.loss, Last: s.last})
		if p.country == "" {
			continue
		}
		c := countries[p.country]
		if c == nil {
			c = &countryRow{Country: p.country, Flag: flag(p.country)}
			countries[p.country] = c
		}
		c.Players++
		c.Played += s.played
		c.Wins += s.wins
		c.Rating += s.rating
		if s.rating > c.BestRating || c.Best == "" {
			c.Best, c.BestRating = name, s.rating
		}
	}
	sort.Slice(d.Ladder, func(i, j int) bool {
		if d.Ladder[i].Rating != d.Ladder[j].Rating {
			return d.Ladder[i].Rating > d.Ladder[j].Rating
		}
		return d.Ladder[i].Played > d.Ladder[j].Played
	})
	for i := range d.Ladder {
		d.Ladder[i].Rank = i + 1
	}
	for _, c := range countries {
		c.Rating /= float64(c.Players) // the country's players' average rating
		d.Countries = append(d.Countries, *c)
	}
	sort.Slice(d.Countries, func(i, j int) bool {
		if d.Countries[i].Rating != d.Countries[j].Rating {
			return d.Countries[i].Rating > d.Countries[j].Rating
		}
		return d.Countries[i].Players > d.Countries[j].Players
	})
	for i := range d.Countries {
		d.Countries[i].Rank = i + 1
	}
	if q := strings.ToUpper(d.Query); q != "" { // a country code filters the player ladder
		var keep []ladderRow
		for _, l := range d.Ladder {
			if l.Country == q || strings.Contains(strings.ToUpper(l.Name), q) {
				keep = append(keep, l)
			}
		}
		d.Ladder = keep
	}
	return nil
}

// POST /admin/game/player: ban / unban (their reports are refused and they leave the ladders),
// hide / show (off the ladders only), block / unblock as a host, a note.
func (a *app) gamePlayerAction(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) || !a.isAdmin(r) || a.db.pg == nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	r.ParseForm()
	id := r.PostFormValue("id")
	back := r.PostFormValue("back")
	if !strings.HasPrefix(back, "/admin/game/") || strings.ContainsAny(back, "?#\r\n") {
		back = "/admin/game/players"
	}
	if !steam64Re.MatchString(id) {
		http.Redirect(w, r, back+"?m="+urlq("No such player."), http.StatusSeeOther)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	set := func(column string, value bool) error {
		_, err := a.db.pg.pool.Exec(ctx, `INSERT INTO game_players (steam_id, `+column+`) VALUES ($1, $2)
			ON CONFLICT (steam_id) DO UPDATE SET `+column+` = EXCLUDED.`+column, id, value)
		return err
	}
	var err error
	message := "Done."
	switch r.PostFormValue("do") {
	case "ban":
		err, message = set("upload_banned", true), "Banned: their reports are refused and they are off the ladders."
	case "unban":
		err, message = set("upload_banned", false), "Ban lifted."
	case "hide":
		err, message = set("ladder_hidden", true), "Hidden from the ladders."
	case "show":
		err, message = set("ladder_hidden", false), "Back on the ladders."
	case "block":
		err, message = set("host_blocked", true), "Blocked as a host."
	case "unblock":
		err, message = set("host_blocked", false), "Host block lifted."
	case "note":
		_, err = a.db.pg.pool.Exec(ctx, `INSERT INTO game_players (steam_id, note) VALUES ($1, $2)
			ON CONFLICT (steam_id) DO UPDATE SET note = EXCLUDED.note`, id, clip(r.PostFormValue("note"), 500))
		message = "Note saved."
	default:
		message = "Nothing to do."
	}
	if err != nil {
		log.Printf("admin game player: %v", err)
		message = "That did not work."
	}
	http.Redirect(w, r, back+"?m="+urlq(message), http.StatusSeeOther)
}

// the Steam publisher key: shown on the Game pages when it is missing
func steamKeySet() bool { return strings.TrimSpace(os.Getenv("STEAM_WEB_API_KEY")) != "" }

func itoa(n int) string { return strconv.Itoa(n) }
