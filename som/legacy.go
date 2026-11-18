package main

// The email sign-ups from before Steam sign-in (data/signups.jsonl): kept so they can still
// be downloaded from the admin panel. New sign-ups go through Steam.

import (
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"
)

type emailSignup struct {
	Email string    `json:"email"`
	Name  string    `json:"name,omitempty"`
	At    time.Time `json:"at"`
}

func emailSignupsFile(path string) ([]emailSignup, error) {
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []emailSignup
	for _, line := range strings.Split(string(b), "\n") {
		var r emailSignup
		if strings.TrimSpace(line) != "" && json.Unmarshal([]byte(line), &r) == nil {
			out = append(out, r)
		}
	}
	return out, nil
}
