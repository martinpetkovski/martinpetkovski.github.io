/* Static Over Midtown - press kit: screenshot gallery + lightbox, copy buttons, file sizes. */
(() => {
  'use strict';

  /* screenshots: images/screenshots/<name>.png (full) and images/screenshots/thumbs/<name>.jpg */
  const SHOTS = [
    ['screenshot-01', 'A five-on-five brawl over Midtown'],
    ['screenshot-02', 'Fighting around the radio tower'],
    ['screenshot-03', 'Dogfight between the office blocks'],
    ['screenshot-04', 'A blue car cuts through the park'],
    ['screenshot-05', 'Beams and smoke over the skyline'],
    ['screenshot-06', 'Explosions in the business district'],
    ['screenshot-07', 'Night flight past the city tower'],
    ['screenshot-08', 'Cruising past the old station'],
  ];

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const shots = document.getElementById('shots');
  shots.innerHTML = SHOTS.map(([n, cap], i) => `
    <a class="shot" href="images/screenshots/${n}.png" data-i="${i}">
      <img src="images/screenshots/thumbs/${n}.jpg" alt="${esc(cap)}" loading="lazy" width="960" height="540">
      <span class="dl"><span class="tag" style="color:var(--text)">${esc(cap)}</span><span class="tag orange">PNG</span></span>
    </a>`).join('');

  /* lightbox */
  const lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img'), lbDl = lb.querySelector('a');
  let at = 0;
  const show = (i) => {
    at = (i + SHOTS.length) % SHOTS.length;
    const [n, cap] = SHOTS[at];
    lbImg.src = `images/screenshots/${n}.png`; lbImg.alt = cap; lbDl.href = lbImg.src;
    lb.classList.add('open');
  };
  shots.addEventListener('click', (e) => {
    const a = e.target.closest('.shot'); if (!a) return;
    e.preventDefault(); show(+a.dataset.i);
  });
  lb.addEventListener('click', (e) => {
    if (e.target.dataset.go) show(at + +e.target.dataset.go);
    else if (e.target === lb || 'close' in e.target.dataset) lb.classList.remove('open');
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
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; b.classList.add('done'); }
    catch (e) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = 'Selected'; }
    setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1600);
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
