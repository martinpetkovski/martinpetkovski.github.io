/* Static Over Midtown - press kit: screenshot gallery + lightbox, copy buttons, file sizes. */
(() => {
  'use strict';

  /* screenshots: media/<name>.png (full, 3840x2160) and media/previews/<name>.jpg */
  const SHOTS = [
    ['screenshot', 'Five on five over Midtown'],
    ['wallpaper', 'Crossfire between the office towers'],
  ];

  /* the trailer: the YouTube video set in the admin panel; YouTube loads only once play is pressed */
  const box = document.getElementById('trailer-video');
  if (box) fetch('../api/trailer').then((r) => r.json()).then(({ youtubeId: id }) => {
    if (!id) return;
    const v = encodeURIComponent(id);
    document.getElementById('trailer-link').href = `https://www.youtube.com/watch?v=${v}`;
    box.innerHTML = `<button class="poster" type="button" aria-label="Play the trailer">
      <img src="https://i.ytimg.com/vi/${v}/maxresdefault.jpg" alt="" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v}/hqdefault.jpg'">
      <span class="play" aria-hidden="true"></span></button>`;
    box.querySelector('.poster').addEventListener('click', () => {
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v}?autoplay=1&rel=0" title="Static Over Midtown trailer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    });
  }).catch(() => {});

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const shots = document.getElementById('shots');
  shots.innerHTML = SHOTS.map(([n, cap], i) => `
    <a class="shot" href="media/${n}.png" data-i="${i}">
      <img src="media/previews/${n}.jpg" alt="${esc(cap)}" loading="lazy" width="1600" height="900">
      <span class="dl"><span>${esc(cap)}</span><i class="fa-solid fa-expand"></i></span>
    </a>`).join('');

  /* lightbox */
  const lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img'), lbDl = lb.querySelector('a');
  let at = 0;
  const show = (i) => {
    at = (i + SHOTS.length) % SHOTS.length;
    const [n, cap] = SHOTS[at];
    lbImg.src = `media/${n}.png`; lbImg.alt = cap; lbDl.href = lbImg.src;
    lb.classList.add('open');
  };
  shots.addEventListener('click', (e) => {
    const a = e.target.closest('.shot'); if (!a) return;
    e.preventDefault(); show(+a.dataset.i);
  });
  lb.addEventListener('click', (e) => {
    const t = e.target.closest('button') || e.target;
    if (t.dataset.go) show(at + +t.dataset.go);
    else if (t === lb || 'close' in t.dataset) lb.classList.remove('open');
  });
  addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') lb.classList.remove('open');
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
  });

  /* copy buttons */
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const el = document.querySelector(b.dataset.copy);
    const text = [...el.querySelectorAll('p')].map((p) => p.textContent.trim()).join('\n\n') || el.textContent.trim();
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); }
    b.classList.add('done'); b.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => { b.innerHTML = '<i class="fa-regular fa-copy"></i>'; b.classList.remove('done'); }, 1600);
  }));

  /* file sizes next to download buttons (when served from a web server) */
  document.querySelectorAll('[data-size]').forEach(async (s) => {
    try {
      const r = await fetch(s.dataset.size, { method: 'HEAD' });
      const n = +r.headers.get('content-length');
      if (r.ok && n) s.textContent = n > 1e6 ? (n / 1e6).toFixed(n > 1e8 ? 0 : 1) + ' MB' : Math.round(n / 1e3) + ' KB';
    } catch (e) { /* opened from disk: no sizes */ }
  });
})();
