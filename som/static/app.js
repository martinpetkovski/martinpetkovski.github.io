/* Static Over Midtown - website: click-to-play YouTube trailer and the playtest sign-up. */
(() => {
  'use strict';

  /* the entrance: the logo alone in the middle, word by word, then up to its place, then everything else */
  const root = document.documentElement, logo = document.querySelector('.logo');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (logo && !still && root.classList.contains('intro')) {
    const place = () => {   // from where it sits to the middle of the screen, a little bigger
      logo.style.transform = ''; const r = logo.getBoundingClientRect();
      const dy = innerHeight / 2 - (r.top + r.height / 2);
      logo.style.transform = `translateY(${dy}px) scale(1.15)`;
    };
    place();
    const go = () => {
      requestAnimationFrame(() => logo.classList.add('lit'));
      setTimeout(() => {
        logo.classList.add('moving'); logo.style.transform = '';
        root.classList.add('ready'); root.classList.remove('intro');
      }, 2000);
      setTimeout(() => logo.classList.remove('moving'), 3400);
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { place(); go(); });
  } else root.classList.remove('intro');

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

  /* the sign-up */
  const form = document.getElementById('signup');
  if (!form) return;
  const status = form.querySelector('.status'), button = form.querySelector('.cta');
  const say = (text, kind) => { status.textContent = text; status.className = 'status ' + (kind || ''); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    form.email.setAttribute('aria-invalid', 'false');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.email.setAttribute('aria-invalid', 'true'); form.email.focus();
      return say("That email address doesn't look right.", 'err');
    }
    if (!form.consent.checked) return say('Please agree to be contacted about the playtest.', 'err');
    button.disabled = true; say('Sending…');
    try {
      const r = await fetch(form.getAttribute('action'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: form.name.value.trim(), website: form.website.value, consent: true }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
      form.classList.add('done');
      say(out.status === 'already'
        ? "You're already on the list. We'll email your Steam key when a test opens."
        : "You're in. We'll email your Steam key when a test opens.", 'ok');
    } catch (err) {
      say(err.message || 'Something went wrong. Please try again.', 'err');
    } finally {
      button.disabled = false;
    }
  });
})();
