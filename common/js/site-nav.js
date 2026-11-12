/* ============================================================
   site-nav.js — behaviour for the shared navigation bar
   (dropdown groups, mobile hamburger panel, scroll-spy for
   in-page #anchors). Styles: common/css/site-nav.css.
   ============================================================ */
(function () {
  const nav = document.querySelector('nav.site-nav');
  if (!nav) return;
  const toggle = nav.querySelector('.nav-toggle');
  const groups = [...nav.querySelectorAll('.nav-more')];      // dropdown groups
  const backdrop = document.querySelector('.nav-backdrop');
  const mobile = () => matchMedia('(max-width: 920px)').matches;

  function setMenu(open) {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open);
  }
  function setGroup(g, open) {
    g.classList.toggle('open', open);
    const btn = g.querySelector('.nav-more-btn');
    if (btn) btn.setAttribute('aria-expanded', open);
  }
  const closeGroups = except => groups.forEach(g => { if (g !== except) setGroup(g, false); });

  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  if (backdrop) backdrop.addEventListener('click', () => setMenu(false));
  groups.forEach(g => {
    const btn = g.querySelector('.nav-more-btn');
    if (!btn) return;
    // On mobile every group is shown expanded in the panel, so the button is only a label.
    btn.addEventListener('click', e => {
      if (mobile()) return;
      e.stopPropagation();
      closeGroups(g);
      setGroup(g, !g.classList.contains('open'));
    });
  });
  nav.querySelectorAll('.nav-menu a').forEach(a => a.addEventListener('click', () => { setMenu(false); closeGroups(); }));
  document.addEventListener('click', e => { if (!e.target.closest('.nav-more')) closeGroups(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeGroups(); setMenu(false); }
  });
  addEventListener('resize', () => { if (!mobile()) setMenu(false); });

  // scroll-spy: highlight the section currently under the nav bar
  const links = [...nav.querySelectorAll('.nav-menu a[href^="#"]')];   // none on subpages
  const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  let ticking = false;
  function spy() {
    ticking = false;
    nav.classList.toggle('scrolled', scrollY > 8);
    const line = nav.offsetHeight + 90;
    let current = null;
    targets.forEach(t => { if (t.getBoundingClientRect().top <= line) current = t; });
    if (targets.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) current = targets[targets.length - 1];
    links.forEach(a => a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id));
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  spy();
})();
