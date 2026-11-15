/* Static Over Midtown - website: click-to-play YouTube trailer, copying the key, confirmations. */
(() => {
  'use strict';

  /* the trailer: YouTube loads only once the visitor presses play (privacy-enhanced domain) */
  const poster = document.querySelector('.poster');
  if (poster) poster.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(poster.dataset.id)}?autoplay=1&rel=0&modestbranding=1`;
    f.title = 'Static Over Midtown trailer';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.allowFullscreen = true;
    poster.replaceWith(f);
  });

  /* copy the key */
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = document.getElementById(b.dataset.copy).textContent.trim();
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; }
    catch (e) { getSelection().selectAllChildren(document.getElementById(b.dataset.copy)); }
    setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  }));

  /* deleting a comment and admin actions ask first */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-confirm], form.del button');
    if (b && !confirm(b.dataset.confirm || 'Delete this comment?')) e.preventDefault();
  });

  /* when a post or action brings you back, drop the ?m= note from the address */
  if (location.search.includes('m=')) history.replaceState(null, '', location.pathname + location.hash);
})();
