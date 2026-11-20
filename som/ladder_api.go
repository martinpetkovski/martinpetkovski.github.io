package main

// GET /api/game/ladder: the provisional ladders for the game's LADDER screen (public, no sign-in).
// The top 50 players and countries (the same Elo as the admin's Ladder page), plus the asking
// player's row (?me=SteamID64) and their country's row (?country=ISO code, else the player's own).

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

const ladderTop = 50

type ladderEntry struct {
	Rank    int    `json:"rank"`
	Name    string `json:"name,omitempty"`
	Country string `json:"country,omitempty"`
	Rating  int    `json:"rating"`
}

type ladderReply struct {
	Rated     int           `json:"rated"`
	Players   []ladderEntry `json:"players"`
	Me        *ladderEntry  `json:"me,omitempty"`
	Countries []ladderEntry `json:"countries"`
	MyCountry *ladderEntry  `json:"myCountry,omitempty"`
}

var ladderCache struct {
	sync.Mutex
	at time.Time
	d  *gamePage
}

func (a *app) cachedLadders(ctx context.Context) (*gamePage, error) {
	return a.laddersWithin(ctx, time.Minute)
}

// laddersWithin: the ladders no older than age (recomputed, and kept for everyone, when they are).
func (a *app) laddersWithin(ctx context.Context, age time.Duration) (*gamePage, error) {
	ladderCache.Lock()
	defer ladderCache.Unlock()
	if ladderCache.d != nil && time.Since(ladderCache.at) < age {
		return ladderCache.d, nil
	}
	d := &gamePage{}
	if err := a.loadLadders(ctx, d); err != nil {
		return nil, err
	}
	ladderCache.d, ladderCache.at = d, time.Now()
	return d, nil
}

func (a *app) ladderAPI(w http.ResponseWriter, r *http.Request) {
	if a.db.pg == nil {
		http.Error(w, "no database", http.StatusServiceUnavailable)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	d, err := a.cachedLadders(ctx)
	if err != nil {
		log.Printf("ladder api: %v", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	me := r.URL.Query().Get("me")
	if !steam64Re.MatchString(me) {
		me = ""
	}
	country := strings.ToUpper(clip(strings.TrimSpace(r.URL.Query().Get("country")), 2))
	out := ladderReply{Rated: d.Rated, Players: []ladderEntry{}, Countries: []ladderEntry{}}
	for _, p := range d.Ladder {
		e := ladderEntry{Rank: p.Rank, Name: p.Name, Country: p.Country, Rating: int(p.Rating + .5)}
		if p.Rank <= ladderTop {
			out.Players = append(out.Players, e)
		}
		if me != "" && p.ID == me {
			out.Me = &e
			if country == "" {
				country = p.Country
			}
		}
	}
	for _, c := range d.Countries {
		e := ladderEntry{Rank: c.Rank, Country: c.Country, Rating: int(c.Rating + .5)}
		if c.Rank <= ladderTop {
			out.Countries = append(out.Countries, e)
		}
		if country != "" && c.Country == country {
			out.MyCountry = &e
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(out)
}
