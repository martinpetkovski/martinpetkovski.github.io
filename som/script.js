/* Static Over Midtown - teaser page.
   One video, fully preloaded behind a loading bar, then played once from the start and looped
   between two points with a crossfade (two copies of the video, so the seam never shows). Two labels
   sit over it at the bottom: "All footage captured in engine" and the wishlist button, drawn like the
   game's menu items (a port of native/src/ui.c: ui_text, ui_push_glitched, ui_menu_label_at,
   ui_menu_chevrons) in device pixels with the game's settings and menu colours.

   Pick the loop points: open index.html?loop  */
(() => {
  'use strict';

  const CONFIG = {
    video: 'assets/trailer.mp4',
    loopStart: 0,          /* seconds the video returns to when it finishes: set it in loop.js */
    loopEnd: 0,            /* seconds: where each loop ends; 0 = the end of the video */
    fade: 1.0,             /* seconds of crossfade from the loop end into the loop start */

    note: 'All footage captured in engine',
    button: 'The council wants *YOU ¶* to wishlist this on § Steam',   /* *word* = orange, ¶ = the pointing finger, § = the Steam mark */
    steamUrl: 'https://store.steampowered.com/',   /* TODO: your Steam store page */
    /* the opening, in seconds after the video starts */
    videoFade: 1.6,                 /* up from black, between letterbox bars */
    noteMin: 3.0,                   /* the note shows above the loading bar for at least this long */
    barsOpen: 1.4, barsTime: 1.3,   /* then the letterbox glides open */
    buttonLead: 2,                  /* the button arrives this many seconds before the first loop back */
    /* the button glitches in the first time the video loops back (and then just stays) */
    bars: .12,                      /* letterbox height, as a share of the screen height */
    minVideoWidth: .7,              /* on tall screens show at least this share of the video's width */

    /* the game's settings */
    pixelSize: 4,          /* game.pixelSize: one game pixel = 4 screen pixels (x display scale) */
    fontPixelSize: 3,      /* one font pixel = 3 screen pixels at the base text scale (the game uses 4) */
    textScale: 5,
  };
  /* the loop point from loop.js; the address bar wins (the loop picker uses it): ?loopStart=12.5 */
  if (isFinite(parseFloat(window.LOOP_START))) CONFIG.loopStart = Math.max(0, parseFloat(window.LOOP_START));
  const Q = new URLSearchParams(location.search);
  for (const k of ['loopStart', 'loopEnd', 'fade']) if (Q.has(k) && isFinite(parseFloat(Q.get(k)))) CONFIG[k] = parseFloat(Q.get(k));
  const PICKER = Q.has('loop');

  /* The in-game menu colours (native/src/ui.c and data.json game.ui), 0..1 */
  const P = {
    faceTop: [1, .66, .16], faceBottom: [.96, .36, 0],          /* uiMenuHeaderTop / Bottom: the menu orange */
    ink: [12 / 255, 10 / 255, 16 / 255],                        /* game.ui.pauseTint #0c0a10 */
    accentTop: [1, .66, .16], accentBottom: [.96, .36, 0],      /* chevrons, highlighted words */
    itemTop: [1, 1, 1], itemBottom: [.8, .8, .84],              /* menu items, state 0 (white) */
    text: [242 / 255, 230 / 255, 220 / 255],                    /* game.ui.textColor #f2e6dc */
    hint: [138 / 255, 127 / 255, 140 / 255],                    /* game.ui.hintColor #8a7f8c */
    black: [0, 0, 0], white: [1, 1, 1],
  };

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const link = document.getElementById('wishlist');

  let W = 0, H = 0, dpr = 1, g = 4, scale = 5, base = 5, fontPx = 3;
  let faces = null, faceEm = 0, L = null;
  let now = 0, T = -1, poke = 0;        /* T: seconds since the video started (-1 while loading) */
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const fract = (v) => v - Math.floor(v);
  const hash = (a, b, c) => fract(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);
  const rgb = (c, a = 1) => `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`;

  /* ------------------------------------------------------------ the Steam mark */
  /* The round mark of the official Steam logo (assets/steam_logo.svg, Valve's store artwork): its
     path data, drawn straight onto a canvas so it works even when the page is opened from disk. */
  const STEAM_MARK = [
    'M44.238,0.601C21,0.601,1.963,18.519,0.154,41.29l23.71,9.803c2.009-1.374,4.436-2.179,7.047-2.179 c0.234,0,0.467,0.008,0.698,0.021l10.544-15.283c0-0.073-0.001-0.144-0.001-0.216c0-9.199,7.483-16.683,16.683-16.683 c9.199,0,16.682,7.484,16.682,16.683c0,9.199-7.483,16.684-16.682,16.684c-0.127,0-0.253-0.003-0.379-0.006l-15.038,10.73 c0.008,0.195,0.015,0.394,0.015,0.592c0,6.906-5.617,12.522-12.522,12.522c-6.061,0-11.129-4.326-12.277-10.055L1.678,56.893 c5.25,18.568,22.309,32.181,42.56,32.181c24.432,0,44.237-19.806,44.237-44.235C88.475,20.406,68.669,0.601,44.238,0.601',
    'M27.875,67.723l-5.434-2.245c0.963,2.005,2.629,3.684,4.841,4.606c4.782,1.992,10.295-0.277,12.288-5.063 c0.965-2.314,0.971-4.869,0.014-7.189c-0.955-2.321-2.757-4.131-5.074-5.097c-2.299-0.957-4.762-0.922-6.926-0.105l5.613,2.321 c3.527,1.47,5.195,5.52,3.725,9.047C35.455,67.526,31.402,69.194,27.875,67.723',
    'M69.95,33.436c0-6.129-4.986-11.116-11.116-11.116c-6.129,0-11.116,4.987-11.116,11.116 c0,6.13,4.987,11.115,11.116,11.115C64.964,44.55,69.95,39.565,69.95,33.436 M50.502,33.417c0-4.612,3.739-8.35,8.351-8.35 c4.612,0,8.351,3.738,8.351,8.35s-3.739,8.35-8.351,8.35C54.241,41.767,50.502,38.028,50.502,33.417'
  ];
  const steamOk = typeof Path2D === 'function';

  /* ------------------------------------------------------------ fonts (ui_build_gdi_atlas) */
  /* Each glyph is rasterised small and thresholded (alpha >= 110: crisp font pixels), then drawn
     point sampled at S screen pixels per font pixel. Headers lean forward (Russo One italic). */
  function buildFace(family, em, italic) {
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    const font = `${em}px "${family}"`;
    x.font = font;
    const mH = x.measureText('H');
    const asc = Math.ceil(mH.fontBoundingBoxAscent || em * .95), desc = Math.ceil(mH.fontBoundingBoxDescent || em * .3);
    const k = italic ? .21 : 0;
    const cellH = asc + desc + 4, cellW = Math.ceil(em * 1.3 + asc * k) + 8;
    c.width = cellW; c.height = cellH;
    const face = { cellW, cellH, glyphs: {}, capTop: 1, capH: cellH - 2, id: family + em + italic };
    for (let code = 32; code < 127; code++) {
      const ch = String.fromCharCode(code).toUpperCase();
      if (face.glyphs[ch]) continue;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cellW, cellH);
      x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
      const adv = Math.round(x.measureText(ch).width) + 1;
      if (k) x.setTransform(1, 0, -k, 1, k * (1 + asc), 0);
      x.fillText(ch, 2, 1 + asc);
      const d = x.getImageData(0, 0, cellW, cellH).data, mask = new Uint8Array(cellW * cellH);
      for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
      face.glyphs[ch] = { mask, adv };
    }
    const h = face.glyphs.H.mask; let top = -1, bottom = -1;
    for (let y = 0; y < cellH; y++) for (let xx = 0; xx < cellW; xx++) if (h[y * cellW + xx]) { if (top < 0) top = y; bottom = y; }
    if (top >= 0) { face.capTop = top; face.capH = bottom - top + 1; }
    return face;
  }

  /* The Steam mark as a glyph of the button font: the round icon of the official logo (its left
     89 x 89 units, without the word) rasterised into the font's cell at the font's own resolution,
     so it shares the letters' pixel size, shadow, extrusion and face. */
  /* The pointing finger, aimed out of the screen at you: hand-made pixel art (a fist, the index
     fingertip coming at the camera with its nail, the curled fingers and the thumb), resampled
     into the button font's cell at the font's own pixel size.
     # face, + mid shade, o dark outline, w highlight */
  const FINGER = [
    '.........oooooo.....',
    '.......oo######oo...',
    '......o###oooo###o..',
    '.....o###o#ww#o###o.',
    '.....o##o#w###o###o.',
    '.....o##o#####o###o.',
    '.....o###ooooo####o.',
    '.....o############o.',
    '....oo+##########+o.',
    '...o##o+++####+++o..',
    '..o###oooooooooooo..',
    '..o###o##########o..',
    '..o###o+++++++++o...',
    '..o###oooooooooo....',
    '..o###o#########o...',
    '..o###o++++++++o....',
    '..o###ooooooooo.....',
    '..o+##o#######o.....',
    '...o++o+++++++o.....',
    '....oooooooooo......'
  ];
  function addPointGlyph(face) {
    const w = face.cellW, h = face.cellH, ah = FINGER.length, aw = FINGER[0].length;
    /* a whole multiple of the art (every pixel kept) about 1.6 capitals tall, if the cell has room */
    let n = ah * Math.max(1, Math.round(face.capH * 1.6 / ah));
    if (n > h || n * aw / ah > w - 4) n = Math.min(h, Math.round((w - 4) * ah / aw));
    const nw = Math.round(n * aw / ah);
    const oy = Math.max(0, Math.min(h - n, Math.round(face.capTop + face.capH / 2 - n / 2))), mask = new Uint8Array(w * h);
    const code = { '#': 1, 'o': 2, '+': 3, 'w': 4 };
    for (let y = 0; y < n; y++) for (let x = 0; x < nw; x++) {
      const c = FINGER[Math.floor(y * ah / n)][Math.floor(x * aw / nw)], m = code[c] || 0;
      const yy = oy + y, xx = 2 + x;
      if (m && yy >= 0 && yy < h && xx < w) mask[yy * w + xx] = m;
    }
    face.glyphs['¶'] = { mask, adv: nw + 3 };
  }
  function addSteamGlyph(face) {
    if (!steamOk) return;
    const w = face.cellW, h = face.cellH, n = Math.min(w - 4, Math.max(6, Math.round(face.capH * 1.5)));
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    c.width = w; c.height = h;
    x.setTransform(n / 89.4, 0, 0, n / 89.4, 2, Math.round(face.capTop + face.capH / 2 - n / 2));
    x.fillStyle = '#fff';
    for (const d of STEAM_MARK) x.fill(new Path2D(d));
    x.setTransform(1, 0, 0, 1, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
    face.glyphs['§'] = { mask, adv: n + 2 };
  }

  /* glyph images: solid colours are cached; per-row gradients with a moving shine are rebuilt */
  const cache = new Map();
  const scratch = [0, 1, 2].map(() => document.createElement('canvas'));
  function paint(face, ch, rowColor, chan, target) {
    const gl = face.glyphs[ch] || face.glyphs[' '], w = face.cellW, h = face.cellH;
    const c = target || document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data;
    for (let r = 0; r < h; r++) {
      const col = rowColor(r);
      const R = chan === 2 ? 0 : col[0] * 255, G = chan === 1 ? 0 : col[1] * 255, B = chan === 1 ? 0 : col[2] * 255;
      for (let cx = 0; cx < w; cx++) { const m = gl.mask[r * w + cx]; if (m) {
        const o = (r * w + cx) * 4, k = m === 2 ? .42 : m === 3 ? .72 : 1;   /* 2 dark line, 3 mid shade, 4 highlight */
        const hl = m === 4 ? .75 : 0;
        d[o] = R * k + (255 - R * k) * hl; d[o + 1] = G * k + (255 - G * k) * hl; d[o + 2] = B * k + (255 - B * k) * hl; d[o + 3] = 255;
      } }
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  function solidGlyph(face, ch, color) {
    const key = face.id + '|' + ch + '|' + color.join(',');
    let e = cache.get(key);
    if (!e) {
      e = { img: paint(face, ch, () => color, 0) };
      e.ghosts = () => (e.g || (e.g = [paint(face, ch, () => color, 1), paint(face, ch, () => color, 2)]));
      cache.set(key, e);
    }
    return e;
  }

  /* ------------------------------------------------------------ primitives (ui_push_glitched) */
  let LT = null;                 /* logo transform { x, y, sx, sy } */
  let GL = 0, GSEED = 0;         /* glitch amount and seed */
  function xform(x, y, w, h) {
    if (!LT) return [x, y, w, h];
    const cx = LT.x + (x + w / 2 - LT.x) * LT.sx, cy = LT.y + (y + h / 2 - LT.y) * LT.sy;
    return [cx - w * LT.sx / 2, cy - h * LT.sy / 2, w * LT.sx, h * LT.sy];
  }
  /* glitch: 3-game-pixel bands torn sideways, dropped out, with red / cyan channel ghosts */
  function bands(y, h, fn) {
    const band = 3 * g, y1 = y + h, frame = Math.floor(now * 24);
    for (let by = Math.floor(y / band) * band; by < y1; by += band) {
      const s0 = Math.max(y, by), s1 = Math.min(y1, by + band);
      if (s1 <= s0) continue;
      const bi = Math.floor(by / band);
      const h1 = hash(bi, frame, GSEED), h2 = hash(bi + 911, frame, GSEED), h3 = hash(frame, bi, 77);
      if (h3 < GL * .18) continue;
      const off = h1 < GL * .7 ? Math.floor((h2 * 2 - 1) * GL * 14 + .5) * g : 0;
      fn(s0, s1, off, off !== 0 || h2 > .7);
    }
  }
  function blit(img, ghosts, x, y, w, h, alpha) {
    [x, y, w, h] = xform(x, y, w, h);
    if (alpha <= .001) return;
    if (GL <= 0) { ctx.globalAlpha = alpha; ctx.drawImage(img, x, y, w, h); return; }
    const ih = img.height;
    bands(y, h, (s0, s1, off, split) => {
      const sy = (s0 - y) / h * ih, sh = (s1 - s0) / h * ih;
      if (split && ghosts) {
        const [red, cyan] = ghosts();
        ctx.globalAlpha = alpha * .55;
        ctx.drawImage(red, 0, sy, img.width, sh, x + off - 2 * g, s0, w, s1 - s0);
        ctx.drawImage(cyan, 0, sy, img.width, sh, x + off + 2 * g, s0, w, s1 - s0);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, sy, img.width, sh, x + off, s0, w, s1 - s0);
    });
  }
  /* ui_rect: a solid snapped to the game-pixel grid */
  function rect(x, y, w, h, color, alpha) {
    if (!(w > 0) || !(h > 0)) return;
    const x0 = Math.floor(x / g + .5) * g, y0 = Math.floor(y / g + .5) * g;
    const x1 = Math.max(x0 + g, Math.floor((x + w) / g + .5) * g), y1 = Math.max(y0 + g, Math.floor((y + h) / g + .5) * g);
    [x, y, w, h] = xform(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = rgb(color); ctx.globalAlpha = alpha;
    if (GL <= 0) { ctx.fillRect(x, y, w, h); return; }
    bands(y, h, (s0, s1, off) => ctx.fillRect(x + off, s0, w, s1 - s0));
  }

  /* ------------------------------------------------------------ text (ui_text) */
  /* mode: 'solid' | 'title' (gradient, grain, lit edge, sweeping shine) | 'item' (gradient, grain) */
  function text(s, x, y, S, face, mode, color, alpha, opt = {}) {
    x = Math.floor(x); y = Math.floor(y);
    const cT = face.capTop, cH = face.capH;
    let letter = opt.letter0 || 0;
    for (const ch of s.toUpperCase()) {
      const gl = face.glyphs[ch] || face.glyphs[' '];
      const bob = opt.bob ? Math.floor(Math.sin(now * 1.7 + letter * .55) * 1.2 + .5) * S : 0;
      let dx = x - 2 * S, dy = y - cT * S + bob, dw = face.cellW * S, dh = face.cellH * S;
      if (ch === '¶' && poke > 0) {   /* the finger pokes at you: grows by whole screen pixels per font pixel */
        const S2 = Math.round(S * (1 + .4 * poke)), cx = dx + (2 + face.capH * .8) * S, cy = y + cH * S / 2;
        dx = cx - (cx - dx) * S2 / S; dy = cy - (cy - dy) * S2 / S; dw = face.cellW * S2; dh = face.cellH * S2;
      }
      if (ch !== ' ') {
        if (mode === 'solid') {
          const e = solidGlyph(face, ch, color);
          blit(e.img, e.ghosts, dx, dy, dw, dh, alpha);
        } else {
          const L0 = letter;
          const rowColor = mode === 'title'
            ? (r) => {
                const t = clamp01((r - cT) / Math.max(1, cH - 1));
                const c = lerp3(P.faceTop, P.faceBottom, t);
                const h = fract(Math.sin((L0 * 5.31 + r * 2.17) * 12.9898) * 43758.5453);
                const gr = 1 + (h - .5) * .1 + (r === cT ? .12 : 0);
                const pos = (now * 9) % 40 - 6, d = L0 + (r - cT) * .12 - pos, shine = Math.exp(-d * d / 1.4) * .55;
                return c.map((v) => Math.min(1, v * gr + shine));
              }
            : (r) => {
                const t = clamp01((r - cT) / Math.max(1, cH - 1));
                const c = lerp3(opt.top, opt.bottom, t);
                const h = fract(Math.sin((L0 * 7.13 + r * 3.71) * 12.9898) * 43758.5453);
                const gr = 1 + (h - .5) * .12 + (r === cT ? .1 : 0);
                return c.map((v) => Math.min(1, v * gr));
              };
          const img = paint(face, ch, rowColor, 0, scratch[0]);
          blit(img, () => [paint(face, ch, rowColor, 1, scratch[1]), paint(face, ch, rowColor, 2, scratch[2])], dx, dy, dw, dh, alpha);
        }
      }
      x += gl.adv * S + (opt.track || 0); letter++;
    }
    return x;
  }
  const width = (s, face, S, track = 0) => [...s.toUpperCase()].reduce((w, ch) => w + (face.glyphs[ch] || face.glyphs[' ']).adv * S + track, 0) - track;

  /* pixel text (Press Start 2P): one font pixel = one game pixel; on narrow screens it steps down
     to a smaller whole number of device pixels instead of wrapping into a tower of lines */
  function wrapPixel(srcLines, S, maxW) {
    const out = [];
    for (const src of srcLines) {
      let c = '';
      for (const w of src.toUpperCase().split(/\s+/)) {
        const n = c ? c + ' ' + w : w;
        if (c && width(n, faces.tag, S) > maxW) { out.push(c); c = w; } else c = n;
      }
      if (c) out.push(c);
    }
    return out;
  }
  function fitPixel(srcLines, maxW, maxLines) {
    const wrap = (S) => wrapPixel(srcLines, S, maxW);
    const sizes = [...new Set([g, g * .75, g * .5, g / 3].map((v) => Math.max(1, Math.round(v))))];
    let S = sizes[0], lines = wrap(S);
    for (const s of sizes) { S = s; lines = wrap(s); if (lines.length <= maxLines) break; }
    return { S, lines };
  }

  /* ------------------------------------------------------------ the button: a menu item + chevrons */
  const itemS = (sc) => fontPx * sc / base;
  /* "*YOU*" style markers: segments drawn in the accent colour */
  const segments = (s) => s.split('*').map((t, i) => ({ t: t.toUpperCase(), accent: i % 2 === 1 })).filter((p) => p.t);
  const plain = (s) => s.replace(/\*/g, '');
  function menuLabel(s, cx, y, sc, alpha, hover) {   /* ui_menu_label_at: shadow, two-step extrusion, gradient face */
    const S = itemS(sc), f = faces.item, x = Math.floor(cx - width(plain(s), f, S) / 2);
    const side = P.itemBottom.map((v) => v * .5), deep = P.itemBottom.map((v) => v * .3);
    const p = plain(s);
    text(p, x + sc, y + sc * 4, S, f, 'solid', P.black, .4 * alpha);
    text(p, x, y + sc * 2, S, f, 'solid', deep, alpha);
    text(p, x, y + sc, S, f, 'solid', side, alpha);
    let xx = x, letter = 0;
    for (const seg of segments(s)) {
      const red = seg.accent !== !!hover;   /* hover swaps: the label turns red, the accent word white */
      xx = text(seg.t, xx, y, S, f, 'item', null, alpha, {
        top: red ? P.accentTop : P.itemTop, bottom: red ? P.accentBottom : P.itemBottom, letter0: letter });
      letter += seg.t.length;
    }
  }
  function chevron(x, y, h, sc, dir, c, a) {
    const half = Math.max(2, Math.floor(h / sc / 2));
    for (let r = -half; r <= half; r++) rect(x + (half - Math.abs(r)) * sc * dir, y + h / 2 + (r - .5) * sc, sc * 2, sc, c, a);
  }
  function chevrons(left, right, y, h, sc, amp) {   /* >> LABEL << sliding in and out a little */
    const dark = P.accentBottom.map((v) => v * .45);
    const slide = Math.floor((.5 + .5 * Math.sin(now * 7)) * amp) * sc, gap = sc * 6, step = sc * 5;
    const half = Math.max(2, Math.floor(h / sc / 2));
    for (let i = 0; i < 2; i++) {
      const lx = left - gap - half * sc - sc * 2 - i * step - slide, rx = right + gap + half * sc + i * step + slide;
      const face = i ? P.accentBottom : P.accentTop;
      chevron(lx + sc, y + sc * 4, h, sc, 1, P.black, .4); chevron(rx + half * sc + sc, y + sc * 4, h, sc, -1, P.black, .4);
      chevron(lx, y + sc * 2, h, sc, 1, dark, 1); chevron(lx, y, h, sc, 1, face, i ? .75 : 1);
      chevron(rx + half * sc, y + sc * 2, h, sc, -1, dark, 1); chevron(rx + half * sc, y, h, sc, -1, face, i ? .75 : 1);
    }
  }
  /* ui_item_slide: an item glitches in, then settles */
  function itemGlitch(t0, order) {
    const t = clamp01((T - t0 - Math.min(order, 8) * .015) / .16);
    GL = t >= 1 ? 0 : Math.min(1, (1 - t) * 1.4); GSEED = order;
  }

  /* ------------------------------------------------------------ the video: preload, play, loop */
  /* Two full-screen video elements (behind the transparent canvas) share one fully downloaded copy:
     the playing one, and the next one, parked on the loop start, which fades in on top over the last
     `fade` seconds. Shown directly rather than copied into the canvas: browsers starve hidden videos. */
  const vids = [0, 1].map(() => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.className = 'video'; v.style.opacity = 0; document.body.insertBefore(v, canvas);
    v.addEventListener('loadedmetadata', () => { if (faces) layout(); });
    return v;
  });
  let cur = 0, fading = false, fadeFrom = 0, parked = false, loaded = false, progress = 0, loadedAt = 0, failed = false;
  const loopEnd = (v) => (CONFIG.loopEnd > 0 ? Math.min(CONFIG.loopEnd, v.duration || Infinity) : v.duration);

  async function preload(url) {
    /* 1) download it all with progress (needs a web server) */
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), parts = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length;
        progress = total ? got / total : Math.min(.95, progress + .01);
      }
      const blob = new Blob(parts, { type: r.headers.get('content-type') || 'video/mp4' });
      return URL.createObjectURL(blob);
    } catch (e) {
      /* 2) opened from disk: let the element buffer it and follow its buffered range */
      return new Promise((resolve) => {
        const v = vids[0]; v.src = url; v.load();
        const tick = () => {
          if (v.error) { failed = true; return resolve(null); }
          if (v.duration && v.buffered.length) progress = v.buffered.end(v.buffered.length - 1) / v.duration;
          if (v.readyState >= 4 && progress > .995) return resolve(url);
          setTimeout(tick, 100);
        };
        v.addEventListener('canplaythrough', () => { progress = Math.max(progress, .999); }, { once: true });
        tick();
      });
    }
  }

  function startVideo(src) {
    vids.forEach((v) => { if (v.src !== src) { v.src = src; v.load(); } });
    const v = vids[0];
    const go = () => { try { v.currentTime = 0; } catch (e) {} v.play().catch(() => {}); loaded = true; loadedAt = now; };
    if (v.readyState >= 2) go(); else v.addEventListener('loadeddata', go, { once: true });
  }

  function updateLoop() {
    const a = vids[cur], b = vids[1 - cur];
    if (!a.duration) return;
    const end = loopEnd(a), fade = Math.min(CONFIG.fade, Math.max(.05, (end - CONFIG.loopStart) / 2));
    if (!fading && !parked && a.currentTime > end - fade - 2) {   /* park the other copy on the loop start */
      try { b.currentTime = CONFIG.loopStart; } catch (e) {}
      b.pause(); parked = true;
    }
    if (!isFinite(buttonOn) && a.currentTime >= end - fade - CONFIG.buttonLead) buttonOn = now;   /* just before the first loop back */
    if (!fading && (a.currentTime >= end - fade || a.ended)) {
      b.play().catch(() => {}); fading = true; fadeFrom = now;
      if (!isFinite(buttonOn)) buttonOn = now;
    }
    if (fading && now - fadeFrom >= fade) {
      a.pause(); cur = 1 - cur; fading = false; parked = false;
    }
  }

  function showVideos() {   /* the playing copy underneath, the incoming one fading in on top */
    const a = vids[cur], b = vids[1 - cur];
    const fade = Math.min(CONFIG.fade, Math.max(.05, (loopEnd(a) - CONFIG.loopStart) / 2));
    const k = fading ? Math.max(.01, smooth((now - fadeFrom) / fade)) : 0;
    a.style.zIndex = 0; a.style.opacity = 1;
    b.style.zIndex = 1; b.style.opacity = k;
  }


  /* ------------------------------------------------------------ the loading bar */
  /* Like the game's startup loading (ui_tube_bar + "LOADING  N%"): a framed tube filling with the
     menu orange, one game pixel at a time, the percentage below it. */
  let shown = 0;
  function drawLoader(alpha) {
    if (alpha <= 0) return;
    shown += (progress - shown) * .25; if (progress >= 1) shown = Math.max(shown, Math.min(1, shown + .05));
    const bw = Math.floor(Math.min(W * .4, 7 * scale * 24) / g) * g, bh = Math.max(3 * g, Math.floor(9 * scale * .5 / g + .5) * g);
    const bx = Math.floor((W / 2 - bw / 2) / g) * g, by = Math.floor((L.vy + L.vh / 2 - bh / 2) / g) * g;   /* centred on the video */
    GL = 0; LT = null;
    rect(bx - g, by - g, bw + 2 * g, bh + 2 * g, P.ink, alpha);                 /* the frame */
    rect(bx, by, bw, bh, P.black, alpha);
    const fw = Math.floor(bw * clamp01(shown) / g) * g, rows = Math.round(bh / g);
    if (fw > 0) for (let r = 0; r < rows; r++) {                                  /* the fill: lit top row, darker below */
      const t = rows > 1 ? r / (rows - 1) : 0, c = lerp3(P.accentTop, P.accentBottom, t).map((v) => Math.min(1, v * (r === 0 ? 1.15 : 1)));
      rect(bx, by + r * g, fw, g, c, alpha);
    }
    const label = failed ? 'VIDEO NOT FOUND' : 'LOADING PRE-ALPHA TEASER  ' + Math.floor(clamp01(shown) * 100) + '%';
    let sc = Math.max(1, Math.floor(scale / 2) + (scale > 2 ? 1 : 0));
    while (sc > 1 && width('LOADING PRE-ALPHA TEASER  100%', faces.item, itemS(sc)) > W * .9) sc--;
    const S = itemS(sc);
    const tx = Math.floor(W / 2 - width(label, faces.item, S) / 2), ty = by + bh + g + sc * 4;
    text(label, tx + sc, ty + sc, S, faces.item, 'solid', P.black, .8 * alpha);
    text(label, tx, ty, S, faces.item, 'solid', P.text, alpha);

    /* ALL FOOTAGE CAPTURED IN ENGINE above the bar: fades in, its letters slowly drifting apart */
    const nt = now - pageStart, nS = L.nS, e = 1 - Math.pow(1 - Math.min(1, nt / 6), 2);
    const na = smooth((nt - .2) / 1.2) * alpha;
    if (na > 0) glide(CONFIG.note, W / 2, by - g - L.nh - Math.max(L.nh * 3, bh * 1.5), nS, nS * (2.5 + 2 * e), P.text, na * .6);
  }

  /* ------------------------------------------------------------ layout */
  /* Wide screens: the video fills the screen (cropped as needed) and the button sits near the bottom.
     Tall screens (phones): filling the screen would crop the video to a sliver, so it shows as a band
     with at least `minVideoWidth` of its width visible, and the button lives in the space below it,
     on two lines, from the start. */
  const chevW = (sc) => 2 * (sc * 6 + sc * 9 + sc * 5 + sc * 3);
  function buttonLines(lines, sc) { return Math.max(...lines.map((t) => width(plain(t), faces.item, itemS(sc)))); }
  function layout() {
    const v0 = vids[0], A = v0.videoWidth && v0.videoHeight ? v0.videoWidth / v0.videoHeight : 16 / 9;
    const coverW = Math.max(W, H * A), dispW = Math.min(coverW, W / CONFIG.minVideoWidth), dispH = dispW / A;
    const band = dispH < H - 2;
    const bar = Math.round(H * CONFIG.bars / g) * g;
    let lines = [CONFIG.button], isc = scale, vy = 0, vh = H, itemY;
    if (!band) {   /* wide screens: one line at the menu's size, as before */
      while (isc > 1 && buttonLines(lines, isc) + chevW(isc) > W * .96) isc--;
    } else {   /* phones: no chevrons; 2-4 balanced lines (never splitting a *highlight*), whichever reads largest */
      const ws = CONFIG.button.split(' '), fit = (ls) => {
        let sc = Math.round(scale * 4);
        while (sc > 1 && buttonLines(ls, sc) > W * .9) sc--;
        const h = faces.item.capH * itemS(sc), bH = (ls.length - 1) * Math.round(h * 2.1) + h;
        return bH > H * .32 ? 0 : sc;
      };
      const splits = (from, n) => {   /* every way to cut ws[from..] into n lines */
        if (n === 1) return [[ws.slice(from).join(' ')]];
        const out = [];
        for (let k = from + 1; k <= ws.length - n + 1; k++) {
          const a = ws.slice(from, k).join(' ');
          if ((ws.slice(0, k).join(' ').split('*').length - 1) % 2) continue;
          for (const rest of splits(k, n - 1)) out.push([a, ...rest]);
        }
        return out;
      };
      let best = { sc: 0, l: lines };
      for (let n = 2; n <= 4; n++) for (const ls of splits(0, n)) { const sc = fit(ls); if (sc > best.sc) best = { sc, l: ls }; }
      lines = best.l; isc = Math.max(1, best.sc);
    }
    const bh = faces.item.capH * itemS(isc), lineH = Math.round(bh * 2.1), blockH = (lines.length - 1) * lineH + bh;
    const bw = buttonLines(lines, isc);
    if (!band) itemY = Math.floor((H - blockH - Math.max(H * .055, bh * 1.6)) / g) * g;   /* close to the bottom edge */
    else {
      vh = Math.round(dispH);
      const below = Math.max(blockH * 3, H * .22);   /* room for the button under the video */
      vy = Math.round(Math.max(0, (H - vh - below) * .5));
      itemY = Math.floor((vy + vh + (H - vy - vh) / 2 - blockH / 2) / g) * g;
    }
    for (const v of vids) Object.assign(v.style, { left: 0, top: vy / dpr + 'px', width: '100vw', height: (band ? vh / dpr + 'px' : '100vh') });
    /* the note on the loading screen: small Press Start 2P */
    let nS = Math.max(1, Math.round(g * .5));
    while (nS > 1 && width(CONFIG.note, faces.tag, nS, nS * 4.5) > W * .9) nS--;
    const nh = faces.tag.capH * nS;
    L = { band, isc, bw, bh, lines, lineH, blockH, itemY, nS, nh, bar, vy, vh };
    const pad = isc * 10;
    Object.assign(link.style, {
      left: (W / 2 - bw / 2 - (band ? 0 : chevW(isc) / 2) - pad) / dpr + 'px', top: (itemY - pad) / dpr + 'px',
      width: (bw + (band ? 0 : chevW(isc)) + pad * 2) / dpr + 'px', height: (blockH + pad * 2 + isc * 4) / dpr + 'px',
    });
  }

  /* the opening: the video rises between letterbox bars, which then glide open */
  function drawOpening() {
    const C = CONFIG, open = smooth((T - C.barsOpen) / C.barsTime);
    const h = Math.round(L.bar * (1 - open) / g) * g;
    if (h > 0) { ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); }
  }
  /* Pixel letters that move smoothly: each glyph is scaled up crisp (point sampled) once, then drawn
     at fractional positions with filtering, so it glides instead of snapping from pixel to pixel. */
  const crisp = new Map();
  function crispGlyph(face, ch, S, color) {
    const key = face.id + ch + S + color.join(',');
    let c = crisp.get(key);
    if (!c) {
      const src = solidGlyph(face, ch, color).img;
      c = document.createElement('canvas'); c.width = face.cellW * S; c.height = face.cellH * S;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
      crisp.set(key, c);
    }
    return c;
  }
  function glide(s, cx, y, S, track, color, alpha) {
    const f = faces.tag, chars = [...s.toUpperCase()];
    const w = chars.reduce((t, ch) => t + (f.glyphs[ch] || f.glyphs[' ']).adv * S + track, 0) - track;
    let x = cx - w / 2;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const ch of chars) {
      if (ch !== ' ') {
        const dy = y - f.capTop * S;
        ctx.globalAlpha = alpha * .8; ctx.drawImage(crispGlyph(f, ch, S, P.black), x - 2 * S + S, dy + S);   /* shadow */
        ctx.globalAlpha = alpha; ctx.drawImage(crispGlyph(f, ch, S, color), x - 2 * S, dy);
      }
      x += (f.glyphs[ch] || f.glyphs[' ']).adv * S + track;
    }
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
  }
  function drawLabels() {
    if (L.band) return;   /* (phones: the button is drawn in its own space, see drawButton) */
    /* a soft darkening at the bottom so the button reads over any footage */
    const gy = Math.min(L.itemY - L.bh * 3, H * .7), gr = ctx.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, 'rgba(12,10,16,0)'); gr.addColorStop(1, 'rgba(12,10,16,.75)');
    ctx.globalAlpha = smooth((T - CONFIG.barsOpen) / CONFIG.barsTime); ctx.fillStyle = gr; ctx.fillRect(0, gy, W, H - gy); ctx.globalAlpha = 1;
    drawOpening();
  }
  /* the wishlist button: glitches in once (ui_item_slide), then stays */
  function drawButton() {
    if (!(now >= buttonOn)) return;
    const t = clamp01((now - buttonOn - .015) / .16);
    GL = t >= 1 ? 0 : Math.min(1, (1 - t) * 1.4); GSEED = 1;
    L.lines.forEach((line, i) => menuLabel(line, W / 2, L.itemY + i * L.lineH, L.isc, 1, hover));
    if (!L.band) chevrons(W / 2 - L.bw / 2, W / 2 + L.bw / 2, L.itemY + L.blockH / 2 - L.bh / 2, L.bh, L.isc, hover ? 6 : 3);
    GL = 0;
    if (!linked) { linked = true; link.classList.add('live'); }
  }

  /* ------------------------------------------------------------ frame */
  let hover = false, linked = false, buttonOn = Infinity, pageStart = 0;   /* buttonOn: when the button appears */
  function frame(ms) {
    now = ms / 1000; if (!pageStart) pageStart = now;
    T = loaded ? now - loadedAt : -1; window.__soT = T; window.__soFade = fading ? now - fadeFrom : -1;
    if (L && L.band && !isFinite(buttonOn)) buttonOn = pageStart + .4;   /* phones: from the start */
    { const p = ((now - buttonOn - .6) % 2.2) / .45; poke = now > buttonOn + .6 && p < 1 ? Math.sin(p * Math.PI) : 0; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (loaded) {
      updateLoop();
      showVideos();
      const inFade = 1 - smooth(T / CONFIG.videoFade);   /* out of black */
      if (inFade > 0) { ctx.globalAlpha = inFade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (!PICKER) drawLabels();
    }
    drawLoader(loaded ? 1 - smooth(T / .35) : 1);
    if (!PICKER) drawButton();
    if (PICKER) picker();
    requestAnimationFrame(frame);
  }

  link.href = CONFIG.steamUrl;
  link.addEventListener('mouseenter', () => (hover = true));
  link.addEventListener('mouseleave', () => (hover = false));
  link.addEventListener('focus', () => (hover = true));
  link.addEventListener('blur', () => (hover = false));

  /* ------------------------------------------------------------ the loop picker (index.html?loop) */
  let pk = null;
  function picker() {
    if (!pk) {
      pk = document.createElement('div'); pk.className = 'picker';
      pk.innerHTML = `
        <div class="row"><input type="range" id="pkPos" min="0" max="1" step="0.01" value="0"><span id="pkTime">0.00</span></div>
        <div class="row">
          <button id="pkPlay">Play / pause</button>
          <button id="pkBack">&minus;1 frame</button><button id="pkFwd">+1 frame</button>
          <button id="pkStart">Set loop point here</button>
          <button id="pkPrev">Preview the seam</button>
        </div>
        <div class="row"><code id="pkOut"></code><button id="pkCopy">Copy</button></div>
        <div class="hint">Scrub to the moment the video should return to when it finishes, set the loop point, then
        preview the seam: it plays the end of the video crossfading into that moment. Paste the line into loop.js.</div>`;
      document.body.appendChild(pk);
      const $ = (id) => pk.querySelector('#' + id), v = () => vids[cur], fps = 1 / 30;
      const show = () => { $('pkOut').textContent = `window.LOOP_START = ${CONFIG.loopStart.toFixed(2)};`; };
      $('pkPos').addEventListener('input', (e) => { v().pause(); fading = false; v().currentTime = e.target.value * v().duration; });
      $('pkPlay').onclick = () => (v().paused ? v().play() : v().pause());
      $('pkBack').onclick = () => { v().pause(); v().currentTime = Math.max(0, v().currentTime - fps); };
      $('pkFwd').onclick = () => { v().pause(); v().currentTime = Math.min(v().duration, v().currentTime + fps); };
      $('pkStart').onclick = () => { CONFIG.loopStart = +v().currentTime.toFixed(2); show(); };
      $('pkPrev').onclick = () => { fading = false; parked = false; vids[1 - cur].pause(); v().currentTime = Math.max(0, loopEnd(v()) - CONFIG.fade - 2); v().play(); };
      $('pkCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('pkOut').textContent); };
      pk.show = show; show();
    }
    const v = vids[cur];
    if (v.duration) {
      pk.querySelector('#pkTime').textContent = v.currentTime.toFixed(2) + ' / ' + v.duration.toFixed(2) + ' s';
      if (document.activeElement !== pk.querySelector('#pkPos')) pk.querySelector('#pkPos').value = v.currentTime / v.duration;
      if (!pk.shown) { pk.shown = true; pk.show(); }
    }
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = Math.round(innerWidth * dpr); H = Math.round(innerHeight * dpr);
    canvas.width = W; canvas.height = H;
    g = Math.max(1, Math.floor(CONFIG.pixelSize + .5) * dpr);   /* game_hud_pixel: pixelSize x display scale */
    scale = Math.max(1, Math.floor(CONFIG.textScale * H / 1080 + .5));
    base = scale;
    fontPx = CONFIG.fontPixelSize;
    const em = Math.max(6, Math.floor(7 / .72 * base / fontPx + .5));   /* ui_font_raster */
    if (em !== faceEm) {
      faceEm = em; cache.clear();
      faces = { item: buildFace('Russo One', em, false), tag: buildFace('Press Start 2P', 8, false) }; crisp.clear();
      addSteamGlyph(faces.item); addPointGlyph(faces.item);
    }
    layout();
  }

  const fontsReady = document.fonts
    ? Promise.all([document.fonts.load('16px "Russo One"'), document.fonts.load('8px "Press Start 2P"')]).catch(() => {})
    : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(() => {
    resize();
    addEventListener('resize', resize);
    requestAnimationFrame(frame);
    preload(CONFIG.video).then((src) => {   /* (the note stays readable even when loading is quick) */
      progress = 1;
      const wait = Math.max(250, ((pageStart || performance.now() / 1000) + CONFIG.noteMin - performance.now() / 1000) * 1000);
      if (src) setTimeout(() => startVideo(src), wait);
    });
  });
})();
