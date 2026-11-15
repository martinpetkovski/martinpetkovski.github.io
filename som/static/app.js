/* Static Over Midtown - website: the trailer, the key, comment threads (reply, fold), confirmations. */
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
    const el = document.getElementById(b.dataset.copy);
    try { await navigator.clipboard.writeText(el.textContent.trim()); } catch (e) { getSelection().selectAllChildren(el); }
    b.classList.add('done'); b.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => { b.classList.remove('done'); b.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1600);
  }));

  const tpl = document.getElementById('reply-form');
  document.addEventListener('click', (e) => {
    /* confirmations */
    const conf = e.target.closest('[data-confirm]');
    if (conf && !confirm(conf.dataset.confirm)) { e.preventDefault(); return; }

    /* fold a thread */
    const fold = e.target.closest('.fold');
    if (fold) {
      const c = fold.closest('.c'), folded = c.classList.toggle('folded');
      fold.setAttribute('aria-expanded', String(!folded));
      fold.innerHTML = folded ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-minus"></i>';
      return;
    }

    /* reply: a form under the comment */
    const rep = e.target.closest('[data-reply]');
    if (rep && tpl) {
      const body = rep.closest('.c-body'), open = body.querySelector(':scope > .say.reply');
      if (open) { open.querySelector('textarea').focus(); return; }
      const f = tpl.content.firstElementChild.cloneNode(true);
      f.querySelector('[name=parent]').value = rep.dataset.reply;
      rep.closest('.c-acts').after(f);
      f.querySelector('textarea').focus();
      return;
    }
    const cancel = e.target.closest('[data-cancel]');
    if (cancel) cancel.closest('form').remove();
  });

  /* Ctrl+Enter sends */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('.say textarea')) e.target.form.requestSubmit();
  });

  /* drop the ?m= note from the address once shown */
  if (location.search.includes('m=')) history.replaceState(null, '', location.pathname + location.hash);
})();
