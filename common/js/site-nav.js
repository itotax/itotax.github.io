/* ============================================================
   site-nav.js — behaviour for the shared navigation bar
   ("Pages" dropdown, mobile hamburger panel, scroll-spy for
   in-page #anchors). Styles: common/css/site-nav.css.
   ============================================================ */
(function () {
  const nav = document.querySelector('nav.site-nav');
  if (!nav) return;
  const toggle = nav.querySelector('.nav-toggle');
  const more = nav.querySelector('.nav-more');
  const moreBtn = nav.querySelector('.nav-more-btn');
  const backdrop = document.querySelector('.nav-backdrop');
  const mobile = () => matchMedia('(max-width: 920px)').matches;

  function setMenu(open) {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open);
  }
  function setMore(open) {
    if (!more) return;                    // subpages have no "Pages" dropdown
    more.classList.toggle('open', open);
    moreBtn.setAttribute('aria-expanded', open);
  }

  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  backdrop.addEventListener('click', () => setMenu(false));
  if (moreBtn) moreBtn.addEventListener('click', e => { if (!mobile()) { e.stopPropagation(); setMore(!more.classList.contains('open')); } });
  nav.querySelectorAll('.nav-menu a').forEach(a => a.addEventListener('click', () => { setMenu(false); setMore(false); }));
  document.addEventListener('click', e => { if (more && !more.contains(e.target)) setMore(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { setMore(false); setMenu(false); }
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
