package main

import (
	"encoding/json"
	"net/http"
)

// trailer: the trailer's YouTube id as set in the admin panel, for pages that are plain files
// (the press kit): GET /api/trailer -> {"youtubeId":"..."}
func (a *app) trailer(w http.ResponseWriter, r *http.Request) {
	var id string
	a.db.view(func(s *state) { id = s.Settings.YouTubeID })
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(map[string]string{"youtubeId": id})
}
