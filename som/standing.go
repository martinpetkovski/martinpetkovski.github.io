package main

// GET /api/game/standing?who=A&who=B[&event=ID]: where the asked players stand right now, for the
// game's end-of-match screen (it asks before a match and after it, and shows what changed).
// Without an event `who` are SteamID64s and each has one board: "ladder" (the provisional rating).
// With an event `who` are the event's nicknames and each has "score" plus every achievement they
// have a figure in (events.go eventFigures), ranked exactly as the event's own ladders are.

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

type standingBoard struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Rank  int    `json:"rank"`
	Value int    `json:"value"`
}

type standingPlayer struct {
	Who    string          `json:"who"`
	Boards []standingBoard `json:"boards"`
}

func (a *app) standingAPI(w http.ResponseWriter, r *http.Request) {
	if a.db.pg == nil {
		http.Error(w, "no database", http.StatusServiceUnavailable)
		return
	}
	who := r.URL.Query()["who"]
	if len(who) > 10 {
		who = who[:10]
	}
	event, _ := strconv.ParseInt(r.URL.Query().Get("event"), 10, 64)
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	out := []standingPlayer{}
	if event > 0 {
		list, _, _, err := a.eventLadder(ctx, event)
		if err != nil {
			log.Printf("standing api: %v", err)
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		for _, name := range who {
			p := standingPlayer{Who: name, Boards: []standingBoard{}}
			key := nickKey(clip(name, 40))
			for i := range list {
				e := &list[i]
				if key == "" || nickKey(e.Nickname) != key {
					continue
				}
				p.Boards = append(p.Boards, standingBoard{ID: "score", Title: "SCORE", Rank: e.Rank, Value: int(e.Score + .5)})
				for _, f := range eventFigures {
					v := f.of(e)
					if v <= 0 {
						continue
					}
					rank := 1 // as the event's ladders order them: the higher figure first, ties in the score ladder's order
					for j := range list {
						if o := f.of(&list[j]); o > v || (o == v && j < i) {
							rank++
						}
					}
					p.Boards = append(p.Boards, standingBoard{ID: f.id, Title: f.title, Rank: rank, Value: int(v + .5)})
				}
				break
			}
			out = append(out, p)
		}
	} else {
		d, err := a.laddersWithin(ctx, 5*time.Second) // fresh enough to show a match that has just been counted
		if err != nil {
			log.Printf("standing api: %v", err)
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		for _, id := range who {
			p := standingPlayer{Who: id, Boards: []standingBoard{}}
			if steam64Re.MatchString(id) {
				for _, row := range d.Ladder {
					if row.ID == id {
						p.Boards = append(p.Boards, standingBoard{ID: "ladder", Title: "LADDER", Rank: row.Rank, Value: int(row.Rating + .5)})
						break
					}
				}
			}
			out = append(out, p)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(map[string]any{"players": out})
}
