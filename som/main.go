// Static Over Midtown - website server.
//
// Serves the landing page (a template, so the YouTube video id and other settings come from the
// environment), its static files, the existing press kit, and the playtest sign-up:
//
//	POST /api/signup            JSON or form: email, name (optional), consent; stored in data/signups.jsonl
//	GET  /admin/signups.csv     every sign-up as CSV (HTTP basic auth, ADMIN_PASSWORD)
//
// Configuration (environment variables, all optional except ADMIN_PASSWORD for the export):
//
//	PORT            listen port (default 8080)
//	YOUTUBE_ID      the trailer's YouTube video id
//	DATA_DIR        where signups.jsonl is kept (default ./data)
//	ADMIN_USER      basic-auth user for the export (default admin)
//	ADMIN_PASSWORD  basic-auth password for the export (export disabled when empty)
//	SITE_URL        canonical address, used in the page's meta tags (default https://martinpetkovski.com/som/)
//
// Run: go run .   (from this folder)
package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html/template"
	"log"
	"net"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type config struct {
	Port, YouTubeID, DataDir, AdminUser, AdminPassword, SiteURL string
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func loadConfig() config {
	return config{
		Port:          env("PORT", "8080"),
		YouTubeID:     env("YOUTUBE_ID", "M7lc1UVf-VE"), // TODO: the real trailer's id (this one is a placeholder)
		DataDir:       env("DATA_DIR", "data"),
		AdminUser:     env("ADMIN_USER", "admin"),
		AdminPassword: os.Getenv("ADMIN_PASSWORD"),
		SiteURL:       env("SITE_URL", "https://martinpetkovski.com/som/"),
	}
}

// ---------------------------------------------------------------- sign-ups

type signup struct {
	Email   string    `json:"email"`
	Name    string    `json:"name,omitempty"`
	At      time.Time `json:"at"`
	IPHash  string    `json:"ipHash"` // a hash, so the list holds no raw IP addresses
	Agent   string    `json:"agent,omitempty"`
	Referer string    `json:"referer,omitempty"`
}

type store struct {
	mu     sync.Mutex
	path   string
	emails map[string]bool
}

func openStore(dir string) (*store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	s := &store{path: filepath.Join(dir, "signups.jsonl"), emails: map[string]bool{}}
	all, err := s.all()
	if err != nil {
		return nil, err
	}
	for _, r := range all {
		s.emails[strings.ToLower(r.Email)] = true
	}
	return s, nil
}

func (s *store) all() ([]signup, error) {
	b, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []signup
	for _, line := range strings.Split(string(b), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var r signup
		if json.Unmarshal([]byte(line), &r) == nil {
			out = append(out, r)
		}
	}
	return out, nil
}

var errDuplicate = errors.New("duplicate")

func (s *store) add(r signup) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := strings.ToLower(r.Email)
	if s.emails[key] {
		return errDuplicate
	}
	f, err := os.OpenFile(s.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	b, _ := json.Marshal(r)
	if _, err := f.Write(append(b, '\n')); err != nil {
		return err
	}
	s.emails[key] = true
	return nil
}

// a small per-IP limiter: a few sign-ups per 10 minutes
type limiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	keep := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if now.Sub(t) < 10*time.Minute {
			keep = append(keep, t)
		}
	}
	if len(keep) >= 5 {
		l.hits[key] = keep
		return false
	}
	l.hits[key] = append(keep, now)
	return true
}

func clientIP(r *http.Request) string {
	if f := r.Header.Get("X-Forwarded-For"); f != "" { // behind a proxy / load balancer
		return strings.TrimSpace(strings.Split(f, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func hashIP(ip string) string {
	h := sha256.Sum256([]byte("som-signup:" + ip))
	return hex.EncodeToString(h[:8])
}

func validEmail(s string) bool {
	if len(s) > 254 || strings.ContainsAny(s, " <>,;\"") {
		return false
	}
	a, err := mail.ParseAddress(s)
	if err != nil || a.Address != s {
		return false
	}
	at := strings.LastIndex(s, "@")
	return at > 0 && strings.Contains(s[at+1:], ".")
}

func jsonReply(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func signupHandler(st *store, lim *limiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", "POST")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
		var in struct {
			Email, Name, Website string // Website: a honeypot people never see
			Consent              bool
		}
		if strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				jsonReply(w, 400, map[string]string{"error": "Something went wrong. Please try again."})
				return
			}
		} else {
			r.ParseForm()
			in.Email, in.Name, in.Website = r.FormValue("email"), r.FormValue("name"), r.FormValue("website")
			in.Consent = r.FormValue("consent") != ""
		}
		in.Email, in.Name = strings.TrimSpace(in.Email), strings.TrimSpace(in.Name)
		if in.Website != "" { // a bot filled the hidden field: pretend it worked
			jsonReply(w, 200, map[string]string{"status": "ok"})
			return
		}
		if !validEmail(in.Email) {
			jsonReply(w, 400, map[string]string{"error": "That email address doesn't look right."})
			return
		}
		if !in.Consent {
			jsonReply(w, 400, map[string]string{"error": "Please agree to be contacted about the playtest."})
			return
		}
		if len(in.Name) > 80 {
			in.Name = in.Name[:80]
		}
		ip := clientIP(r)
		if !lim.allow(ip) {
			jsonReply(w, 429, map[string]string{"error": "Too many sign-ups from here. Try again in a few minutes."})
			return
		}
		rec := signup{Email: in.Email, Name: in.Name, At: time.Now().UTC(), IPHash: hashIP(ip),
			Agent: trim(r.UserAgent(), 200), Referer: trim(r.Referer(), 200)}
		switch err := st.add(rec); {
		case errors.Is(err, errDuplicate):
			jsonReply(w, 200, map[string]string{"status": "already"})
		case err != nil:
			log.Printf("signup: %v", err)
			jsonReply(w, 500, map[string]string{"error": "Something went wrong on our side. Please try again later."})
		default:
			log.Printf("signup: new tester (%s)", rec.IPHash)
			jsonReply(w, 200, map[string]string{"status": "ok"})
		}
	}
}

func trim(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

func exportHandler(cfg config, st *store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AdminPassword == "" {
			http.Error(w, "export disabled: set ADMIN_PASSWORD", http.StatusNotFound)
			return
		}
		u, p, ok := r.BasicAuth()
		if !ok || subtle.ConstantTimeCompare([]byte(u), []byte(cfg.AdminUser)) != 1 ||
			subtle.ConstantTimeCompare([]byte(p), []byte(cfg.AdminPassword)) != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="som-admin"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		all, err := st.all()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="som-playtest-signups.csv"`)
		c := csv.NewWriter(w)
		c.Write([]string{"email", "name", "signed_up_utc", "ip_hash"})
		for _, s := range all {
			c.Write([]string{s.Email, s.Name, s.At.Format(time.RFC3339), s.IPHash})
		}
		c.Flush()
	}
}

// ---------------------------------------------------------------- pages

func security(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		h.ServeHTTP(w, r)
	})
}

func main() {
	cfg := loadConfig()
	st, err := openStore(cfg.DataDir)
	if err != nil {
		log.Fatalf("data: %v", err)
	}
	page := template.Must(template.ParseFiles("templates/index.html"))
	lim := &limiter{hits: map[string][]time.Time{}}

	mux := http.NewServeMux()
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	mux.Handle("/press-kit/", http.StripPrefix("/press-kit/", http.FileServer(http.Dir("press-kit"))))
	mux.HandleFunc("/api/signup", signupHandler(st, lim))
	mux.HandleFunc("/admin/signups.csv", exportHandler(cfg, st))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := page.Execute(w, cfg); err != nil {
			log.Printf("page: %v", err)
		}
	})

	log.Printf("Static Over Midtown site on :%s (video %s, data in %s)", cfg.Port, cfg.YouTubeID, cfg.DataDir)
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: security(mux), ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(srv.ListenAndServe())
}
