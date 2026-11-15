package main

// Sign in through Steam (OpenID 2.0: Steam sends the visitor back with a signed answer,
// which is checked with Steam itself; no API key needed) and a signed session cookie.

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const steamOpenID = "https://steamcommunity.com/openid/login"

var steamIDRe = regexp.MustCompile(`^https://steamcommunity\.com/openid/id/(\d{17})$`)

var httpc = &http.Client{Timeout: 10 * time.Second}

// baseURL: the address the visitor used, e.g. https://som.najjak.com/
func baseURL(r *http.Request) string {
	scheme := r.Header.Get("X-Forwarded-Proto")
	if scheme != "http" && scheme != "https" {
		scheme = "https"
		if h := strings.Split(r.Host, ":")[0]; h == "localhost" || h == "127.0.0.1" || r.TLS == nil && strings.HasSuffix(h, ".localhost") {
			scheme = "http"
		}
	}
	return scheme + "://" + r.Host + "/"
}

func steamLogin(w http.ResponseWriter, r *http.Request) {
	base := baseURL(r)
	q := url.Values{
		"openid.ns":         {"http://specs.openid.net/auth/2.0"},
		"openid.mode":       {"checkid_setup"},
		"openid.return_to":  {base + "auth/steam/callback"},
		"openid.realm":      {base},
		"openid.identity":   {"http://specs.openid.net/auth/2.0/identifier_select"},
		"openid.claimed_id": {"http://specs.openid.net/auth/2.0/identifier_select"},
	}
	http.Redirect(w, r, steamOpenID+"?"+q.Encode(), http.StatusFound)
}

// verifySteam checks Steam's answer and returns the SteamID64 it vouches for.
func verifySteam(ctx context.Context, r *http.Request) (string, error) {
	q := r.URL.Query()
	if q.Get("openid.mode") != "id_res" {
		return "", errors.New("sign-in cancelled")
	}
	if q.Get("openid.op_endpoint") != steamOpenID || !strings.HasPrefix(q.Get("openid.return_to"), baseURL(r)+"auth/steam/callback") {
		return "", errors.New("unexpected answer")
	}
	m := steamIDRe.FindStringSubmatch(q.Get("openid.claimed_id"))
	if m == nil || q.Get("openid.identity") != q.Get("openid.claimed_id") {
		return "", errors.New("no Steam account in the answer")
	}
	check := url.Values{}
	for k, v := range q {
		if strings.HasPrefix(k, "openid.") {
			check[k] = v
		}
	}
	check.Set("openid.mode", "check_authentication")
	req, _ := http.NewRequestWithContext(ctx, "POST", steamOpenID, strings.NewReader(check.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := httpc.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
	if !strings.Contains(string(body), "is_valid:true") {
		return "", errors.New("Steam did not confirm the sign-in")
	}
	return m[1], nil
}

// steamProfile: the public name and picture of a Steam account.
func steamProfile(ctx context.Context, id string) (name, avatar string) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://steamcommunity.com/profiles/"+id+"/?xml=1", nil)
	resp, err := httpc.Do(req)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()
	var p struct {
		Name   string `xml:"steamID"`
		Avatar string `xml:"avatarMedium"`
	}
	xml.NewDecoder(io.LimitReader(resp.Body, 256<<10)).Decode(&p)
	name = strings.TrimSpace(p.Name)
	if len([]rune(name)) > 40 {
		name = string([]rune(name)[:40])
	}
	if !strings.HasPrefix(p.Avatar, "https://") {
		p.Avatar = ""
	}
	return name, p.Avatar
}

// ---------------------------------------------------------------- sessions

type sessions struct{ key []byte }

func loadSessions(dir string) (*sessions, error) {
	p := filepath.Join(dir, "session.key")
	if b, err := os.ReadFile(p); err == nil && len(b) >= 64 {
		k, err := hex.DecodeString(strings.TrimSpace(string(b)))
		if err == nil {
			return &sessions{k}, nil
		}
	}
	k := make([]byte, 32)
	rand.Read(k)
	if err := os.WriteFile(p, []byte(hex.EncodeToString(k)), 0o600); err != nil {
		return nil, err
	}
	return &sessions{k}, nil
}

const cookieName = "som_session"

func (s *sessions) sign(v string) string {
	m := hmac.New(sha256.New, s.key)
	m.Write([]byte(v))
	return hex.EncodeToString(m.Sum(nil))
}

func (s *sessions) set(w http.ResponseWriter, r *http.Request, id string) {
	exp := time.Now().Add(60 * 24 * time.Hour)
	v := id + "." + strconv.FormatInt(exp.Unix(), 10)
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: v + "." + s.sign(v), Path: "/", Expires: exp,
		HttpOnly: true, Secure: strings.HasPrefix(baseURL(r), "https"), SameSite: http.SameSiteLaxMode})
}

func (s *sessions) clear(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
}

// id: the signed-in SteamID64, or "".
func (s *sessions) id(r *http.Request) string {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return ""
	}
	i := strings.LastIndex(c.Value, ".")
	if i < 0 {
		return ""
	}
	v, sig := c.Value[:i], c.Value[i+1:]
	if !hmac.Equal([]byte(sig), []byte(s.sign(v))) {
		return ""
	}
	parts := strings.Split(v, ".")
	if len(parts) != 2 {
		return ""
	}
	exp, _ := strconv.ParseInt(parts[1], 10, 64)
	if time.Now().Unix() > exp {
		return ""
	}
	return parts[0]
}

// sameOrigin: a form posted from this site (not from another site riding the cookie).
func sameOrigin(r *http.Request) bool {
	src := r.Header.Get("Origin")
	if src == "" || src == "null" {
		src = r.Referer()
	}
	u, err := url.Parse(src)
	return err == nil && u.Host != "" && strings.EqualFold(u.Host, r.Host)
}
