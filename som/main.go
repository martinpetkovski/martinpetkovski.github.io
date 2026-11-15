// Static Over Midtown - website server.
//
// The landing page with the trailer, the playtest (sign in with Steam, join, and the Steam key
// shows up on the page once it is given out), comments from signed-in Steam users, the press
// kit, and an admin panel (/admin, only for the Steam accounts in ADMIN_STEAM_ID) for the
// page's texts, the trailer, the playtest keys and the testers.
//
// Configuration (environment variables):
//
//	PORT            listen port (default 8080)
//	ADMIN_STEAM_ID  SteamID64 of the admin (several: comma separated). Sign in and open /admin
//	                to see yours.
//	YOUTUBE_ID      the trailer's YouTube id on first start (after that: the admin panel)
//	DATA_DIR        where the site's data is kept (default ./data)
//	SITE_URL        canonical address for the page's meta tags (default https://som.najjak.com/)
//
// Run: go run .   (from this folder)
package main

import (
	"encoding/csv"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type config struct {
	Port, DataDir, SiteURL string
	Admins                 map[string]bool
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

type app struct {
	cfg   config
	db    *db
	sess  *sessions
	pages *template.Template
	lim   *limiter
}

func main() {
	cfg := config{
		Port:    env("PORT", "8080"),
		DataDir: env("DATA_DIR", "data"),
		SiteURL: env("SITE_URL", "https://som.najjak.com/"),
		Admins:  map[string]bool{},
	}
	for _, id := range strings.Split(os.Getenv("ADMIN_STEAM_ID"), ",") {
		if id = strings.TrimSpace(id); id != "" {
			cfg.Admins[id] = true
		}
	}
	d, err := openDB(cfg.DataDir, env("YOUTUBE_ID", "M7lc1UVf-VE"))
	if err != nil {
		log.Fatalf("data: %v", err)
	}
	s, err := loadSessions(cfg.DataDir)
	if err != nil {
		log.Fatalf("data: %v", err)
	}
	a := &app{cfg: cfg, db: d, sess: s, lim: &limiter{hits: map[string][]time.Time{}},
		pages: template.Must(template.New("").Funcs(funcs).ParseGlob("templates/*.html"))}

	mux := http.NewServeMux()
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	mux.Handle("/press-kit/", http.StripPrefix("/press-kit/", http.FileServer(http.Dir("press-kit"))))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("GET /{$}", a.home)
	mux.HandleFunc("GET /index.html", a.home)
	mux.HandleFunc("GET /api/trailer", a.trailer)
	mux.HandleFunc("GET /auth/steam", steamLogin)
	mux.HandleFunc("GET /auth/steam/callback", a.steamCallback)
	mux.HandleFunc("POST /auth/logout", a.logout)
	mux.HandleFunc("POST /playtest/join", a.post(a.join))
	mux.HandleFunc("POST /playtest/leave", a.post(a.leave))
	mux.HandleFunc("POST /comments", a.post(a.addComment))
	mux.HandleFunc("POST /comments/delete", a.post(a.deleteComment))
	mux.HandleFunc("GET /admin", a.admin)
	mux.HandleFunc("POST /admin/settings", a.adminPost(a.saveSettings))
	mux.HandleFunc("POST /admin/keys", a.adminPost(a.addKeys))
	mux.HandleFunc("POST /admin/keys/give", a.adminPost(a.giveKeys))
	mux.HandleFunc("POST /admin/user", a.adminPost(a.userAction))
	mux.HandleFunc("GET /admin/testers.csv", a.testersCSV)
	mux.HandleFunc("GET /admin/email-signups.csv", a.emailCSV)

	log.Printf("Static Over Midtown site on :%s (data in %s, %d admin(s))", cfg.Port, cfg.DataDir, len(cfg.Admins))
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: security(mux), ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(srv.ListenAndServe())
}

var funcs = template.FuncMap{
	"date": func(t time.Time) string {
		if t.IsZero() {
			return ""
		}
		return t.Format("2 Jan 2006")
	},
	"ago": func(t time.Time) string {
		d := time.Since(t)
		switch {
		case d < time.Minute:
			return "just now"
		case d < time.Hour:
			return strconv.Itoa(int(d/time.Minute)) + " min ago"
		case d < 24*time.Hour:
			return strconv.Itoa(int(d/time.Hour)) + " h ago"
		case d < 30*24*time.Hour:
			return strconv.Itoa(int(d/(24*time.Hour))) + " d ago"
		}
		return t.Format("2 Jan 2006")
	},
}

// ---------------------------------------------------------------- the page

type commentView struct {
	ID                    int64
	Name, Avatar, Profile string
	Text                  string
	At                    time.Time
	Deleted               bool
	ByAdmin               bool
	CanDelete, CanReply   bool
	Depth                 int
	Replies               []*commentView
	Count                 int // replies at every level below
}

type pageData struct {
	S        settings
	SiteURL  string
	Me       *user
	Admin    bool
	Comments []*commentView
	Total    int
	Message  string
}

// me: the signed-in user (a copy), or nil.
func (a *app) me(r *http.Request) *user {
	id := a.sess.id(r)
	if id == "" {
		return nil
	}
	var out *user
	a.db.view(func(s *state) {
		if u := s.Users[id]; u != nil {
			c := *u
			out = &c
		}
	})
	return out
}

var messages = map[string]string{
	"joined": "Enlisted.",
	"left":   "Stood down.",
	"closed": "The gates are shut. For now.",
	"signin": "Identify yourself first.",
	"failed": "Signal lost. Try again.",
	"banned": "Your channel is closed.",
	"slow":   "Too much noise. Wait a few minutes.",
	"empty":  "Nothing to transmit.",
}

func (a *app) home(w http.ResponseWriter, r *http.Request) {
	me := a.me(r)
	d := pageData{SiteURL: a.cfg.SiteURL, Me: me, Admin: me != nil && a.cfg.Admins[me.ID], Message: messages[r.URL.Query().Get("m")]}
	a.db.view(func(s *state) {
		d.S = s.Settings
		d.Comments, d.Total = a.threads(s, me)
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store") // the page shows who is signed in
	if err := a.pages.ExecuteTemplate(w, "index.html", d); err != nil {
		log.Printf("page: %v", err)
	}
}

// post wraps a form handler: same-site forms only; it answers with where to go next.
// threads: the comments as trees, newest threads first, replies oldest first.
func (a *app) threads(s *state, me *user) ([]*commentView, int) {
	admin := me != nil && a.cfg.Admins[me.ID]
	views := map[int64]*commentView{}
	for _, c := range s.Comments {
		v := &commentView{ID: c.ID, Text: c.Text, At: c.At, Deleted: c.Deleted}
		if u := s.Users[c.User]; u != nil && !c.Deleted {
			v.Name, v.Avatar, v.Profile, v.ByAdmin = u.Name, u.Avatar, "https://steamcommunity.com/profiles/"+u.ID, a.cfg.Admins[u.ID]
			v.CanDelete = admin || me != nil && me.ID == u.ID
		}
		v.CanReply = me != nil && !me.Banned
		views[c.ID] = v
	}
	var top []*commentView
	total := 0
	for _, c := range s.Comments { // stored oldest first
		v := views[c.ID]
		if !c.Deleted {
			total++
		}
		if p := views[c.Parent]; c.Parent != 0 && p != nil {
			p.Replies = append(p.Replies, v)
		} else {
			top = append([]*commentView{v}, top...)
		}
	}
	var walk func(v *commentView, depth int) int
	walk = func(v *commentView, depth int) int {
		v.Depth = depth
		for _, r := range v.Replies {
			v.Count += 1 + walk(r, depth+1)
		}
		return v.Count
	}
	for _, v := range top {
		walk(v, 0)
	}
	return top, total
}

func (a *app) post(f func(r *http.Request, me *user) string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !sameOrigin(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		r.ParseForm()
		http.Redirect(w, r, f(r, a.me(r)), http.StatusSeeOther)
	}
}

func (a *app) steamCallback(w http.ResponseWriter, r *http.Request) {
	id, err := verifySteam(r.Context(), r)
	if err != nil {
		log.Printf("steam sign-in: %v", err)
		http.Redirect(w, r, "/?m=failed#playtest", http.StatusSeeOther)
		return
	}
	name, avatar := steamProfile(r.Context(), id)
	a.db.do(func(s *state) bool {
		u := s.Users[id]
		if u == nil {
			u = &user{ID: id, Joined: time.Now().UTC()}
			s.Users[id] = u
		}
		if name != "" {
			u.Name = name
		}
		if u.Name == "" {
			u.Name = "Steam user"
		}
		if avatar != "" {
			u.Avatar = avatar
		}
		return true
	})
	a.sess.set(w, r, id)
	log.Printf("steam sign-in: %s", id)
	http.Redirect(w, r, "/#playtest", http.StatusSeeOther)
}

func (a *app) logout(w http.ResponseWriter, r *http.Request) {
	if sameOrigin(r) {
		a.sess.clear(w)
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (a *app) join(r *http.Request, me *user) string {
	if me == nil {
		return "/?m=signin#playtest"
	}
	open := true
	a.db.do(func(s *state) bool {
		open = s.Settings.SignupsOpen
		if u := s.Users[me.ID]; open && u != nil && u.SignedUp.IsZero() {
			u.SignedUp = time.Now().UTC()
			return true
		}
		return false
	})
	if !open {
		return "/?m=closed#playtest"
	}
	log.Printf("playtest: %s joined", me.ID)
	return "/?m=joined#playtest"
}

func (a *app) leave(r *http.Request, me *user) string {
	if me == nil {
		return "/#playtest"
	}
	a.db.do(func(s *state) bool {
		u := s.Users[me.ID]
		if u == nil || u.Key != "" { // a tester who has a key stays one
			return false
		}
		u.SignedUp = time.Time{}
		return true
	})
	return "/?m=left#playtest"
}

func (a *app) addComment(r *http.Request, me *user) string {
	if me == nil {
		return "/?m=signin#comments"
	}
	if me.Banned {
		return "/?m=banned#comments"
	}
	text := strings.TrimSpace(strings.ReplaceAll(r.FormValue("text"), "\r", ""))
	if text == "" {
		return "/?m=empty#comments"
	}
	if r := []rune(text); len(r) > 1000 {
		text = string(r[:1000])
	}
	if !a.lim.allow("c:" + me.ID) {
		return "/?m=slow#comments"
	}
	parent, _ := strconv.ParseInt(r.FormValue("parent"), 10, 64)
	var id int64
	a.db.do(func(s *state) bool {
		if !s.Settings.Comments || parent != 0 && s.comment(parent) == nil {
			return false
		}
		s.NextID++
		id = s.NextID
		s.Comments = append(s.Comments, comment{ID: id, Parent: parent, User: me.ID, Text: text, At: time.Now().UTC()})
		return true
	})
	if id == 0 {
		return "/#comments"
	}
	return "/#c" + strconv.FormatInt(id, 10)
}

func (a *app) deleteComment(r *http.Request, me *user) string {
	id, _ := strconv.ParseInt(r.FormValue("id"), 10, 64)
	if me == nil {
		return "/#comments"
	}
	admin := a.cfg.Admins[me.ID]
	back := "/#comments"
	a.db.do(func(s *state) bool {
		c := s.comment(id)
		if c == nil || c.Deleted || c.User != me.ID && !admin {
			return false
		}
		if c.Parent != 0 {
			back = "/#c" + strconv.FormatInt(c.Parent, 10)
		}
		return s.removeComment(id)
	})
	if strings.HasPrefix(r.FormValue("back"), "/admin") && admin {
		return "/admin#comments"
	}
	return back
}

// ---------------------------------------------------------------- admin

type adminData struct {
	S        settings
	Me       *user
	IsAdmin  bool
	Message  string
	Keys     int
	Testers  []user
	Waiting  int
	Users    int
	Comments int
	Banned   []user
	Emails   int
	Recent   []recentComment
}

type recentComment struct {
	ID     int64
	Name   string
	UserID string
	Text   string
	At     time.Time
	Reply  bool
}

func (a *app) admin(w http.ResponseWriter, r *http.Request) {
	me := a.me(r)
	d := adminData{Me: me, IsAdmin: me != nil && a.cfg.Admins[me.ID], Message: messages[r.URL.Query().Get("m")]}
	if m := r.URL.Query().Get("m"); d.Message == "" && m != "" && len(m) < 120 {
		d.Message = m
	}
	if d.IsAdmin {
		a.db.view(func(s *state) {
			d.S, d.Keys, d.Users, d.Comments = s.Settings, len(s.Keys), len(s.Users), len(s.Comments)
			for _, u := range s.testers() {
				d.Testers = append(d.Testers, *u)
				if u.Key == "" {
					d.Waiting++
				}
			}
			for i := len(s.Comments) - 1; i >= 0 && len(d.Recent) < 50; i-- {
				c := s.Comments[i]
				if c.Deleted {
					continue
				}
				rc := recentComment{ID: c.ID, UserID: c.User, Text: c.Text, At: c.At, Reply: c.Parent != 0}
				if u := s.Users[c.User]; u != nil {
					rc.Name = u.Name
				}
				d.Recent = append(d.Recent, rc)
			}
			for _, u := range s.Users {
				if u.Banned {
					d.Banned = append(d.Banned, *u)
				}
			}
		})
		e, _ := emailSignups(filepath.Join(a.cfg.DataDir, "signups.jsonl"))
		d.Emails = len(e)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex")
	if err := a.pages.ExecuteTemplate(w, "admin.html", d); err != nil {
		log.Printf("admin page: %v", err)
	}
}

func (a *app) isAdmin(r *http.Request) bool { id := a.sess.id(r); return id != "" && a.cfg.Admins[id] }

func (a *app) adminPost(f func(r *http.Request) string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !sameOrigin(r) || !a.isAdmin(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		r.ParseForm()
		http.Redirect(w, r, "/admin?m="+urlq(f(r)), http.StatusSeeOther)
	}
}

func urlq(s string) string { return strings.ReplaceAll(template.URLQueryEscaper(s), "+", "%20") }

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

func (a *app) saveSettings(r *http.Request) string {
	yt := clip(r.FormValue("youtube"), 200)
	if i := strings.Index(yt, "v="); i >= 0 { // a whole YouTube link pasted
		yt = yt[i+2:]
	} else if i := strings.LastIndex(yt, "/"); i >= 0 {
		yt = yt[i+1:]
	}
	if f := strings.FieldsFunc(yt, func(c rune) bool { return c == '&' || c == '?' || c == '#' }); len(f) > 0 {
		yt = f[0]
	} else {
		yt = ""
	}
	a.db.do(func(s *state) bool {
		st := &s.Settings
		if yt != "" {
			st.YouTubeID = yt
		}
		st.Tagline = clip(r.FormValue("tagline"), 200)
		st.Lead = clip(r.FormValue("lead"), 400)
		st.VideoNote = clip(r.FormValue("videonote"), 200)
		st.KeyNote = clip(r.FormValue("keynote"), 400)
		st.SignupsOpen = r.FormValue("open") != ""
		st.Comments = r.FormValue("comments") != ""
		return true
	})
	return "Saved."
}

func (a *app) addKeys(r *http.Request) string {
	added, dup := 0, 0
	a.db.do(func(s *state) bool {
		for _, k := range strings.Fields(r.FormValue("keys")) {
			k = strings.ToUpper(strings.TrimSpace(k))
			if len(k) < 5 || len(k) > 64 {
				continue
			}
			if s.keyUsed(k) {
				dup++
				continue
			}
			s.Keys = append(s.Keys, k)
			added++
		}
		return added > 0
	})
	msg := strconv.Itoa(added) + " key(s) added."
	if dup > 0 {
		msg += " " + strconv.Itoa(dup) + " duplicate(s) skipped."
	}
	return msg
}

func (a *app) giveKeys(r *http.Request) string {
	n, _ := strconv.Atoi(r.FormValue("n"))
	given, short := 0, 0
	a.db.do(func(s *state) bool {
		for _, u := range s.testers() {
			if u.Key != "" {
				continue
			}
			if n > 0 && given >= n {
				break
			}
			if !s.giveKey(u) {
				short++
				continue
			}
			given++
		}
		return given > 0
	})
	msg := strconv.Itoa(given) + " key(s) sent."
	if short > 0 {
		msg += " Out of keys: " + strconv.Itoa(short) + " still waiting."
	}
	return msg
}

func (a *app) userAction(r *http.Request) string {
	id, act := r.FormValue("id"), r.FormValue("do")
	msg := "Nothing changed."
	a.db.do(func(s *state) bool {
		u := s.Users[id]
		if u == nil {
			return false
		}
		switch act {
		case "give":
			if u.SignedUp.IsZero() {
				u.SignedUp = time.Now().UTC()
			}
			if s.giveKey(u) {
				msg = "Key sent to " + u.Name + "."
				return true
			}
			msg = "No keys left."
		case "revoke": // the key is not reused: it may have been seen
			if u.Key != "" {
				u.Key, u.KeyAt = "", time.Time{}
				msg = "Key taken from " + u.Name + "."
				return true
			}
		case "remove":
			u.SignedUp, u.Key, u.KeyAt = time.Time{}, "", time.Time{}
			msg = u.Name + " removed."
			return true
		case "ban", "unban":
			u.Banned = act == "ban"
			if u.Banned {
				var ids []int64
				for _, c := range s.Comments {
					if c.User == id && !c.Deleted {
						ids = append(ids, c.ID)
					}
				}
				for _, cid := range ids {
					s.removeComment(cid)
				}
				msg = u.Name + " silenced."
			} else {
				msg = u.Name + " can speak again."
			}
			return true
		}
		return false
	})
	return msg
}

func (a *app) testersCSV(w http.ResponseWriter, r *http.Request) {
	if !a.isAdmin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="som-playtesters.csv"`)
	c := csv.NewWriter(w)
	c.Write([]string{"steam_id", "name", "profile", "joined_playtest_utc", "key", "key_given_utc"})
	a.db.view(func(s *state) {
		for _, u := range s.testers() {
			kt := ""
			if !u.KeyAt.IsZero() {
				kt = u.KeyAt.Format(time.RFC3339)
			}
			c.Write([]string{u.ID, u.Name, "https://steamcommunity.com/profiles/" + u.ID, u.SignedUp.Format(time.RFC3339), u.Key, kt})
		}
	})
	c.Flush()
}

func (a *app) emailCSV(w http.ResponseWriter, r *http.Request) {
	if !a.isAdmin(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	all, err := emailSignups(filepath.Join(a.cfg.DataDir, "signups.jsonl"))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="som-email-signups.csv"`)
	c := csv.NewWriter(w)
	c.Write([]string{"email", "name", "signed_up_utc"})
	for _, s := range all {
		c.Write([]string{s.Email, s.Name, s.At.Format(time.RFC3339)})
	}
	c.Flush()
}

// ---------------------------------------------------------------- bits

// a small limiter: a few actions per 10 minutes per key
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

func security(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		h.ServeHTTP(w, r)
	})
}
