/* Static Over Midtown - the entrance, after the game's loading screen (Spookee ui.c, ui_draw_startup_loading):
   on black, an outline triangle (white, turning the title's yellow) fades in small, zooms, glides left of the
   logo turning a quarter turn to point right, then sweeps across, leaning forward; everything ahead of its two
   front sides is black, so the logo is uncovered behind it; shards fall off its wake; once it has cleared the
   logo, lightning strikes the T of MIDTOWN (a flash and a shake). The loading throbber (three slanted stripes,
   a wave of light running through them) waits at the bottom. Then the logo rises to its place and the game's
   page wipe (three slanted bands of short rows) crosses the screen while the items glitch in one by one.
   Click, a key or scrolling skips it. Plays once per browser session. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('intro')) return;
  try { sessionStorage.setItem('som-intro', '1'); } catch (e) {}
  const cv = document.querySelector('.fx'), ctx = cv.getContext('2d');
  const logo = document.querySelector('.logo');
  const items = [...document.querySelectorAll('.tagline, .video, .signup, .foot')];
  const YELLOW = [255, 203, 53], HIGHLIGHT = [255, 59, 59], ACCENT = [255, 133, 20], BLUE = [41, 130, 224], RED = [219, 33, 59];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp01 = (t) => t < 0 ? 0 : t > 1 ? 1 : t;
  const ease = (t) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };   // the game's ui_intro_ease
  const SPEED = 10 / 5.5;   // the game's phases (10 units over 7 s), a little brisker for the web
  let W, H, dpr, start = 0, done = false, struckAt = -1, outroAt = -1;

  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size(); addEventListener('resize', size);

  // the logo, centred on the screen during the intro
  let logoBox, lift = 0;
  const measure = () => {
    logo.style.transform = ''; const r = logo.getBoundingClientRect();
    lift = H * .45 - (r.top + r.height / 2);
    logo.style.transform = `translateY(${lift}px)`;
    logoBox = logo.getBoundingClientRect();
  };

  const verts = (cx, cy, s, ang, skew) => {   // the game's ui_tri_vertices: equilateral, size = centre to corner
    const v = [];
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * Math.PI / 3; let lx = Math.cos(a) * s; const ly = Math.sin(a) * s; lx += ly * skew;
      v.push([cx + lx * Math.cos(ang) - ly * Math.sin(ang), cy + lx * Math.sin(ang) + ly * Math.cos(ang)]);
    }
    return v;
  };
  const frontX = (v, y) => {   // the rightmost crossing of the triangle's sides at height y (the mask's edge)
    let hi = -Infinity;
    for (let i = 0; i < 3; i++) { const a = v[i], b = v[(i + 1) % 3];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hi = Math.max(hi, a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    return hi;
  };
  const LEAN = .25;
  let big, cy, startX, finalX;
  const layout = () => {
    const pad = 28, r = logoBox;
    big = Math.min((r.height / 2 + 40) / .8660254, (H / 2 - pad) / .8660254);
    cy = r.top + r.height / 2;
    startX = r.left - 12 - big;
    finalX = W + big * (1 + LEAN) + 40;
  };
  const pose = (e) => {   // the game's ui_intro_pose
    const p = { x: W / 2, y: H / 2, ang: -Math.PI / 2, skew: 0, s: big * .6, a: 0 };
    if (e < 0) return p;
    if (e < 3.2) {
      const zoom = ease(e / 1.4), move = ease((e - 1.4) / 1.8);
      p.a = ease(e / .6); p.x += (startX - W / 2) * move; p.y += (cy - H / 2) * move;
      p.ang = -Math.PI / 2 + move * Math.PI / 2; p.s = big * (.15 + .45 * zoom + .4 * move);
    } else {
      const k = ease((e - 3.2) / 6.3);
      p.a = 1; p.x = startX + (finalX - startX) * k; p.y = cy; p.ang = 0; p.skew = LEAN * ease((e - 3.2) / 1.5); p.s = big;
    }
    return p;
  };

  const glowLine = (pts, close, color, width) => {   // a bright core with soft additive halos (the game's 7 passes)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'miter';
    for (const [w, a] of [[26, .05], [16, .08], [9, .14], [5, .25]]) {
      ctx.strokeStyle = rgba(color, a); ctx.lineWidth = w; ctx.beginPath();
      pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); if (close) ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = rgba(color, 1); ctx.lineWidth = width; ctx.beginPath();
    pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); if (close) ctx.closePath(); ctx.stroke();
  };

  // shards: small detached triangles born along the sweeping triangle's back, drifting and fading
  const shards = []; let lastShard = 0;
  const shardColor = (white) => YELLOW.map((c) => c + (255 - c) * white);

  const throbber = (t, alpha) => {   // the game's ui_loading_throbber
    const h = 34, w = h * .28, gap = h * .095, lean = h * .23, total = 3 * w + 2 * gap + lean;
    const x0 = W / 2 - total / 2, y0 = H - h - 42;
    [BLUE, RED, HIGHLIGHT].forEach((c, i) => {
      const ph = ((t * 1.4 - i * .16) % 1 + 1) % 1, k = ph < .5 ? Math.sin(ph * Math.PI) : 0, lit = .3 + .7 * k * k;
      const y = y0 - k * h * .18, x = x0 + i * (w + gap);
      ctx.save(); ctx.globalAlpha = alpha * lit; ctx.shadowColor = rgba(c, .9); ctx.shadowBlur = 18 * k;
      ctx.fillStyle = rgba(c, 1); ctx.beginPath();
      ctx.moveTo(x + lean, y); ctx.lineTo(x + lean + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  };

  const bolt = (x, y, t) => {   // lightning down to the T of MIDTOWN
    if (t < 0 || t > .5) return;
    const a = t < .06 ? 1 : 1 - (t - .06) / .44, seed = Math.floor(t * 30);
    let rnd = seed * 9301 + 49297; const r = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280) - .5;
    const pts = [[x + r() * 80, -10]]; const n = 9;
    for (let i = 1; i < n; i++) pts.push([x + r() * 60 * (1 - i / n), y * i / n]);
    pts.push([x, y]);
    ctx.globalAlpha = a; glowLine(pts, false, [255, 245, 220], 2.5);
    const f = Math.floor(n / 2); glowLine([pts[f], [pts[f][0] + 70, pts[f][1] + 50], [pts[f][0] + 60, pts[f][1] + 95]], false, [255, 245, 220], 1.5);
    ctx.globalAlpha = 1;
  };

  const wipe = (t) => {   // the game's ui_page_wipe: three slanted bands of short rows
    if (t < 0 || t >= 1) return false;
    const slant = H * .35, row = 12;
    for (let k = 0; k < 3; k++) {
      const p = t * 1.6 - k * .14; if (p <= 0 || p >= 1.3) continue;
      const cx = -slant + p * (W + 2 * slant), w = k === 1 ? 54 : 24, a = (1 - t) * (k === 1 ? .55 : .35);
      ctx.fillStyle = rgba(k === 1 ? YELLOW : HIGHLIGHT, a);
      for (let y = 0; y < H; y += row) ctx.fillRect(cx + (y / H - .5) * slant - w / 2, y, w, row);
    }
    return true;
  };

  const finish = () => {   // the logo rises to its place, the wipe crosses, the items glitch in
    if (outroAt >= 0) return;
    outroAt = performance.now();
    logo.style.clipPath = ''; logo.style.transition = 'transform .7s cubic-bezier(.65,0,.25,1)'; logo.style.transform = '';
    root.classList.add('outro'); root.classList.remove('intro');
    items.forEach((el, i) => { el.style.animationDelay = (.25 + i * .09) + 's'; el.classList.add('glitch-in'); });
    setTimeout(() => { logo.style.transition = ''; }, 800);
  };

  const frame = (now) => {
    if (!start) start = now;
    const t = (now - start) / 1000, e = t * SPEED;
    ctx.clearRect(0, 0, W, H);
    if (outroAt >= 0) {
      const ot = (now - outroAt) / 1000;
      if (!wipe((ot - .15) / .6) && ot > .8) { root.classList.remove('outro'); items.forEach((el) => { el.classList.remove('glitch-in'); el.style.animationDelay = ''; }); return; }
      return requestAnimationFrame(frame);
    }
    const p = pose(e), white = 1 - ease((e - 1.4) / 1.8);
    // shake after the strike
    let sx = 0, sy = 0;
    if (struckAt >= 0) { const k = Math.max(0, 1 - (t - struckAt) / .45); sx = Math.sin(t * 90) * 7 * k; sy = Math.cos(t * 70) * 5 * k; }
    ctx.save(); ctx.translate(sx, sy);
    logo.style.transform = `translate(${sx}px, ${lift + sy}px)`;
    // the logo: hidden until the sweep, then uncovered behind the triangle's front sides
    if (e < 3.2) logo.style.clipPath = 'inset(0 100% 0 0)';
    else {
      const v = verts(p.x, p.y, big, 0, LEAN * ease((e - 3.2) / 1.5)), r = logoBox, steps = 24, pts = [];
      for (let i = 0; i <= steps; i++) {
        const y = r.top - 30 + (r.height + 60) * i / steps, hi = frontX(v, y);
        pts.push(`${(isFinite(hi) ? hi : -9999) - r.left}px ${y - r.top}px`);
      }
      logo.style.clipPath = `polygon(-9999px -30px, ${pts.join(', ')}, -9999px ${r.height + 30}px)`;
      if (struckAt < 0 && p.x - big * 1.2 > r.right) struckAt = t;
    }
    // shards off the wake
    if (e >= 3.2 && p.x - big < W && t - lastShard > .03) {
      lastShard = t; const v = verts(p.x, p.y, big, 0, p.skew), back = v[1][0] + (v[2][0] - v[1][0]) * Math.random();
      shards.push({ x: back, y: p.y + (Math.random() - .5) * big * 1.6, vx: -40 - Math.random() * 80, vy: (Math.random() - .5) * 60, s: 4 + Math.random() * 9, r: Math.random() * 6, born: t });
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i], age = t - s.born; if (age > 1.1) { shards.splice(i, 1); continue; }
      const v = verts(s.x + s.vx * age, s.y + s.vy * age, s.s * (1 - age / 1.1), s.r + age * 3, 0);
      ctx.fillStyle = rgba(shardColor(0), .8 * (1 - age / 1.1));
      ctx.beginPath(); v.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();
    }
    // the triangle: whole while it zooms and turns; once sweeping, only its two front sides lead
    if (p.a > 0 && p.x - big * 1.3 < W) {
      const v = verts(p.x, p.y, p.s, p.ang, p.skew); ctx.globalAlpha = p.a;
      if (e < 3.2) glowLine(v, true, shardColor(white), 2);
      else glowLine([v[1], v[0], v[2]], false, shardColor(white), 2);
      ctx.globalAlpha = 1;
    }
    throbber(t, Math.min(clamp01(t / .5), struckAt >= 0 ? 1 - clamp01((t - struckAt) / .4) : 1));
    if (struckAt >= 0) {
      const st = t - struckAt, r = logoBox, m = logo.querySelector('span:last-child').getBoundingClientRect();
      bolt(m.left + m.width * .5, r.top + r.height * .55, st);
      const flash = st < .05 ? st / .05 : Math.max(0, 1 - (st - .05) / .4);
      if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(ACCENT, flash * .22); ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalCompositeOperation = 'source-over'; }
      if (st > 1.1) finish();
    }
    ctx.restore();
    requestAnimationFrame(frame);
  };

  const skip = () => { if (outroAt < 0 && start) finish(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, skip, { passive: true, once: true }));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    measure(); layout(); requestAnimationFrame(frame);
  });
})();
