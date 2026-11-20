package main

// The cross-check of a match's reports, for every online mode. Every human in a match reports it
// under a Steam ticket, so each report is tied to the account that played. A match with two or
// more humans is "verified" once two such reports agree on the result and on every player's
// figures; if any confirmed report disagrees with the host's (or, without it, the first) the match
// is "disputed" and counts for nothing until the admin accepts or voids it. Until a second report
// arrives it stays "unverified". A match with one human cannot be cross-checked: it is "single",
// with the shape and bounds checks of matchReport.check only. This shows that the host reported
// what the others saw; it does not judge the match itself.

import (
	"context"
	"encoding/json"
	"math"

	"github.com/jackc/pgx/v5"
)

// The statuses that count for the ladders (matches stored before the cross-check count as before).
const countedMatch = `(NOT m.crosscheck OR m.status IN ('verified', 'single', 'accepted'))`

// near: two copies of a running total (a client's last snapshot can be a moment behind the host's).
func near(a, b float64) bool {
	d := math.Abs(a - b)
	return d <= 2 || d <= math.Max(math.Abs(a), math.Abs(b))*.01
}

// agree: both reports describe the same match with the same result.
func (m *matchReport) agree(o *matchReport) bool {
	if m.Key != o.Key || m.Winner != o.Winner || m.Abandoned != o.Abandoned || m.Scores != o.Scores || m.Towers != o.Towers ||
		m.Capacity != o.Capacity || m.Event != o.Event || len(m.Players) != len(o.Players) || math.Abs(m.Seconds-o.Seconds) > 5 {
		return false
	}
	for i := range m.Players {
		p := &m.Players[i]
		q := o.player(p.Slot)
		if p.Team != q.Team || p.AI != q.AI || p.Steam != q.Steam || p.Nickname != q.Nickname || p.Kills != q.Kills || p.Deaths != q.Deaths || p.Assists != q.Assists ||
			!near(p.Score, q.Score) || !near(p.Damage, q.Damage) {
			return false
		}
	}
	return true
}

// crossCheck sets a match's status from the reports stored for it (inside storeReport's transaction).
func crossCheck(ctx context.Context, tx pgx.Tx, id int64) error {
	rows, err := tx.Query(ctx, `SELECT verified, body::text FROM match_reports WHERE match_id = $1 ORDER BY is_host DESC, received`, id)
	if err != nil {
		return err
	}
	var confirmed []matchReport // the host's first, when Steam confirmed it
	humans := 0
	for rows.Next() {
		var verified bool
		var body string
		if err := rows.Scan(&verified, &body); err != nil {
			rows.Close()
			return err
		}
		var rep matchReport
		if json.Unmarshal([]byte(body), &rep) != nil {
			continue
		}
		if n := rep.humans(); n > humans {
			humans = n
		}
		if verified {
			confirmed = append(confirmed, rep)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	status := "unverified"
	if humans <= 1 {
		status = "single"
	} else if len(confirmed) >= 2 {
		status = "verified"
		for i := 1; i < len(confirmed); i++ {
			if !confirmed[0].agree(&confirmed[i]) {
				status = "disputed"
			}
		}
	}
	_, err = tx.Exec(ctx, `UPDATE matches SET status = $2, crosscheck = true WHERE id = $1 AND status <> 'accepted'`, id, status)
	return err
}
