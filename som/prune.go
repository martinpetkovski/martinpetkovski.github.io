package main

// Keeping the database small: every player's full report of a match is kept for 30 days,
// then only the host's (the match's own rows come from it). The other reports stay listed
// (who reported, verified, when, from where) without their body. Runs an hour after start
// and then once a day.

import (
	"context"
	"log"
	"time"
)

const reportBodyDays = 30

func (p *pgStore) pruneLoop() {
	time.Sleep(time.Hour)
	for {
		p.pruneReports()
		time.Sleep(24 * time.Hour)
	}
}

func (p *pgStore) pruneReports() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	ct, err := p.pool.Exec(ctx, `UPDATE match_reports r SET body = '{}'::jsonb
		FROM matches m
		WHERE m.id = r.match_id AND m.from_host AND NOT r.is_host
		  AND r.received < now() - make_interval(days => $1) AND r.body <> '{}'::jsonb`, reportBodyDays)
	if err != nil {
		log.Printf("cleaning up old match reports: %v", err)
		return
	}
	if n := ct.RowsAffected(); n > 0 {
		log.Printf("cleaned up %d player report(s) older than %d days (the hosts' are kept)", n, reportBodyDays)
	}
}
