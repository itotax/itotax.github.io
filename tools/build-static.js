#!/usr/bin/env node
// ────────────────────────────────────────────────────────────
//  build-static.js — bake the data-driven content into the HTML
//
//  Publications, news, awards, activities and lectures are rendered
//  in the browser from publications.bib / *.json. Crawlers that do
//  not run JavaScript (most AI crawlers, some search engines) would
//  see empty pages, so this script writes a plain HTML copy of the
//  same content into each page's container, between
//      <!--static:NAME--> … <!--/static:NAME-->
//  The page's own script replaces it on load, so visitors still get
//  the interactive version. Re-running is idempotent.
//
//  Usage:  node tools/build-static.js          (rewrite the pages)
//          node tools/build-static.js --check  (exit 1 if out of date)
//
//  Run it after editing publications.bib, news.json, awards.json,
//  activity.json or lecture.json. tools/pre-commit does that for you.
// ────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CHECK = process.argv.includes('--check');

// ── helpers ────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&(?!(?:[a-z]+|#\d+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');

function cleanTeX(s) {
  if (!s) return '';
  return String(s)
    .replace(/\\&/g, '&').replace(/\\'(\w)/g, '$1').replace(/\\'/g, '\'')
    .replace(/\{\\"(\w)\}/g, '$1').replace(/\{([^{}]+)\}/g, '$1').replace(/[{}]/g, '')
    .replace(/--/g, '–').replace(/~/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseBib(src) {
  const out = [];
  src = src.replace(/^%.*$/gm, '');
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const type = m[1].toLowerCase();
    if (['string', 'preamble', 'comment'].includes(type)) continue;
    const start = m.index + m[0].length;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++; else if (src[i] === '}') depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    const e = { _type: type, _key: m[2] };
    const fre = /([\w-]+)\s*=\s*(?:\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}|"([^"]*)"|(\d+))/g;
    let fm;
    while ((fm = fre.exec(body)) !== null) {
      e[fm[1].toLowerCase()] = (fm[2] ?? fm[3] ?? fm[4] ?? '').trim().replace(/\s+/g, ' ');
    }
    out.push(e);
  }
  return out;
}

const acceptDateOf = e => e.accepted || e.acceptdate || '';
const byYearThenAccepted = (a, b) =>
  ((parseInt(b.year) || 0) - (parseInt(a.year) || 0)) || acceptDateOf(b).localeCompare(acceptDateOf(a));

// One publication as a plain citation line.
function citation(e, lang) {
  if (e._type === 'award') {
    const body = (lang === 'ja' ? (e.ja || e.en) : (e.en || e.ja)) || esc(cleanTeX(e.title || e.note || ''));
    return body;
  }
  const author = cleanTeX(e.author || e.editor || '');
  const title = cleanTeX(e.title || e.note || '');
  const venue = cleanTeX(e.journal || e.booktitle || e.publisher || e.school || '');
  const bits = [];
  if (author) bits.push(esc(author) + '.');
  bits.push(author ? `<cite>${esc(title)}</cite>.` : esc(title));
  if (venue) {
    let v = `<em>${esc(venue)}</em>`;
    if (e.volume) v += ` ${esc(e.volume)}${e.number ? `(${esc(e.number)})` : ''}`;
    if (e.pages) v += `, pp. ${esc(cleanTeX(e.pages))}`;
    bits.push(v + (e.year ? `, ${esc(e.year)}.` : '.'));
  }
  const noteLabel = author && e.note && e.note !== e.title ? cleanTeX(e.note) : '';
  if (noteLabel && noteLabel.length < 40) bits.push(`(${esc(noteLabel)})`);
  if (e.doi) bits.push(`<a href="https://doi.org/${attr(e.doi)}">doi:${esc(e.doi)}</a>`);
  if (e.url) bits.push(`<a href="${attr(e.url)}">${/\.pdf$/i.test(e.url) ? 'PDF' : 'Link'}</a>`);
  return bits.join(' ');
}

const TYPE_LABEL = {
  en: { article: 'Journal', inproceedings: 'Int’l Conf.', domesticconf: 'Domestic Conf.', invitedtalk: 'Invited Talk',
        book: 'Book', incollection: 'Book Chapter', patent: 'Patent', award: 'Award', misc: 'Misc',
        phdthesis: 'Ph.D. Thesis', mastersthesis: 'Master’s Thesis' },
  ja: { article: '論文誌', inproceedings: '国際会議', domesticconf: '国内会議・研究会', invitedtalk: '招待講演',
        book: '書籍', incollection: '書籍（分担）', patent: '特許', award: '受賞', misc: 'その他',
        phdthesis: '博士論文', mastersthesis: '修士論文' },
};
const typeOf = e => (e._type === 'inproceedings' && (e.category || '').toLowerCase() === 'domestic') ? 'domesticconf' : e._type;

// ── data ───────────────────────────────────────────────────
const BIB = parseBib(read('publications.bib'));
const AWARDS = JSON.parse(read('awards.json'));
const ACTIVITY = JSON.parse(read('activity.json'));
const LECTURE = JSON.parse(read('lecture.json'));

// News: reuse the site's own merge logic so the baked list matches the page.
async function loadNews() {
  const sandbox = { window: {} };
  const fetchLocal = async f => ({
    ok: true,
    text: async () => read(f),
    json: async () => JSON.parse(read(f)),
  });
  new Function('window', 'fetch', read('common/js/news-merge.js'))(sandbox.window, fetchLocal);
  const all = await sandbox.window.loadMergedNews();
  return { all, front: sandbox.window.selectFrontPageNews(all, new Date()) };
}

// Top-tier venues: take the rule table from the page itself (single source).
function venueRules() {
  const src = read('publications-top-confs.html');
  const m = /const VENUE_RULES = (\[[\s\S]*?\n\]);/.exec(src);
  if (!m) throw new Error('VENUE_RULES not found in publications-top-confs.html');
  return new Function(`return ${m[1]}`)();
}

// ── renderers (plain, semantic HTML) ───────────────────────
function pubsHTML(lang) {
  const all = [...BIB].sort(byYearThenAccepted);
  const byYear = new Map();
  all.forEach(e => { const y = e.year || '—'; if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(e); });
  const L = TYPE_LABEL[lang];
  return [...byYear.entries()].map(([y, es]) =>
    `<h2>${esc(y)}</h2>\n<ul>\n` + es.map(e =>
      `<li><strong>[${L[typeOf(e)] || esc(e._type)}]</strong> ${citation(e, lang)}</li>`).join('\n') + '\n</ul>').join('\n');
}

function topConfsHTML(lang) {
  const rules = venueRules();
  const classify = b => {
    if (!b || /\bWorkshop\b/i.test(b)) return null;
    for (const r of rules) if (r.test(b)) return r.id;
    return null;
  };
  const buckets = Object.fromEntries(rules.map(r => [r.id, []]));
  BIB.filter(e => e._type === 'inproceedings').forEach(e => {
    const id = classify(cleanTeX(e.booktitle || ''));
    if (id) buckets[id].push(e);
  });
  return rules.map(r => {
    const es = buckets[r.id].sort((a, b) => byYearThenAccepted(a, b) || (a._key || '').localeCompare(b._key || ''));
    if (!es.length) return '';
    return `<h2>${esc(r.label)} (${es.length})</h2>\n<ul>\n` + es.map(e => `<li>${citation(e, lang)}</li>`).join('\n') + '\n</ul>';
  }).filter(Boolean).join('\n');
}

const fmtDate = (iso, lang) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return lang === 'ja' ? `${m[1]}年${+m[2]}月${+m[3]}日` : `${M[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
};
function newsHTML(items, lang) {
  return '<ul>\n' + items.map(e => {
    const body = lang === 'ja' ? (e.ja || e.en || '') : (e.en || e.ja || '');
    const link = e.link ? ` <a href="${attr(e.link)}">${lang === 'ja' ? (e.link_ja || 'リンク') : (e.link_en || 'Link')}</a>` : '';
    return `<li><time datetime="${attr(e.date)}">${fmtDate(e.date, lang)}</time> — ${body}${link}</li>`;
  }).join('\n') + '\n</ul>';
}

function awardsHTML(lang, limit) {
  const yearOf = e => e.year || (e.date || '').slice(0, 4) || '—';
  let all = [...AWARDS].sort((a, b) => yearOf(b).localeCompare(yearOf(a)) || (b.date || '').localeCompare(a.date || ''));
  if (limit) all = all.slice(0, limit);
  return '<ul>\n' + all.map(e => {
    const body = lang === 'ja' ? (e.ja || e.en || '') : (e.en || e.ja || '');
    const link = e.link ? ` <a href="${attr(e.link)}">${lang === 'ja' ? (e.link_ja || 'リンク') : (e.link_en || 'Link')}</a>` : '';
    return `<li>${esc(yearOf(e))} — ${body}${link}</li>`;
  }).join('\n') + '\n</ul>';
}

const actBody = (e, lang) => e[lang] || e.ja || e.en || '';
const rolesHTML = lang => '<ul>\n' + (ACTIVITY.standing || []).map(r =>
  `<li>${esc(r.period || '')} — ${actBody(r, lang)}</li>`).join('\n') + '\n</ul>';
function activitiesHTML(lang) {
  const ORDER = { chair: 0, spc: 1, steering: 2, pc: 3, editor: 4, other: 5 };
  const all = [...(ACTIVITY.activities || [])].sort((a, b) =>
    (b.year - a.year) || ((ORDER[a.tag] ?? 9) - (ORDER[b.tag] ?? 9)) || actBody(a, lang).localeCompare(actBody(b, lang), 'ja'));
  const byYear = new Map();
  all.forEach(e => { if (!byYear.has(e.year)) byYear.set(e.year, []); byYear.get(e.year).push(e); });
  return [...byYear.entries()].map(([y, es]) =>
    `<h3>${y}</h3>\n<ul>\n` + es.map(e => `<li>${actBody(e, lang)}</li>`).join('\n') + '\n</ul>').join('\n');
}
const reviewingHTML = () => '<ul>\n' + (ACTIVITY.reviewing || []).map(r => `<li>${esc(r)}</li>`).join('\n') + '\n</ul>';

function lectureHTML(lang, onlyCurrent) {
  const D = LECTURE.en || {};
  const tr = (sec, s) => (!s || lang === 'ja') ? (s || '') : ((D[sec] || {})[s] || s);
  const years = [...LECTURE.years].sort((a, b) => b.fy - a.fy);
  const pick = onlyCurrent ? years.slice(0, 1) : years;
  return pick.map(y => {
    const inst = LECTURE.institutions[y.inst] || {};
    const head = lang === 'ja' ? `${y.label}（${y.fy}年度）· ${inst.ja || ''}` : `AY ${y.fy} · ${inst.en || inst.ja || ''}`;
    const notes = (y.notes || []).map(n => `<li>${esc(tr('notes', n))}</li>`);
    const courses = y.courses.map(c => {
      const extra = [tr('targets', c.target), tr('terms', c.term), tr('details', c.detail),
                     c.english ? (lang === 'ja' ? '英語で実施' : 'Taught in English') : ''].filter(Boolean).join(', ');
      return `<li>${esc(tr('courses', c.name))}${extra ? ` (${esc(extra)})` : ''}</li>`;
    });
    return `<h3>${esc(head)}</h3>\n<ul>\n${[...notes, ...courses].join('\n')}\n</ul>`;
  }).join('\n');
}

// ── sitemap ────────────────────────────────────────────────
// lastmod = date of the last commit touching the page, or today when
// the page has uncommitted changes (i.e. it is about to be committed).
function lastmod(file) {
  const { execFileSync } = require('child_process');
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  try {
    if (git('status', '--porcelain', '--', file)) return new Date().toLocaleDateString('sv-SE');
    return git('log', '-1', '--format=%cs', '--', file) || new Date().toLocaleDateString('sv-SE');
  } catch (_) { return new Date().toLocaleDateString('sv-SE'); }
}
function sitemapXML() {
  const SITE = 'https://takayuki-ito.com/';
  const PAGES = [['index', '1.0'], ['publications', '0.8'], ['publications-top-confs', '0.8'],
                 ['news', '0.6'], ['awards', '0.6'], ['activity', '0.6'], ['lecture', '0.5']];
  const loc = (base, sfx) => (base === 'index' && !sfx) ? SITE : `${SITE}${base}${sfx}.html`;
  const urls = [];
  for (const [base, prio] of PAGES) for (const sfx of ['', '-j']) {
    urls.push(`  <url>
    <loc>${loc(base, sfx)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${loc(base, '')}"/>
    <xhtml:link rel="alternate" hreflang="ja" href="${loc(base, '-j')}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${loc(base, '')}"/>
    <lastmod>${lastmod(`${base}${sfx}.html`)}</lastmod>
    <priority>${prio}</priority>
  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/build-static.js — do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

// ── navigation ─────────────────────────────────────────────
// The menu is defined once here and written into every page that has
// <nav class="site-nav">. Items: [href, icon, title, subtitle]; a group
// (label + items) becomes a dropdown. To add a page, add a line here.
const NAV = {
  en: [
    ['index.html', 'Home'],
    { label: 'Research', items: [
      ['index.html#research', '🔬', 'Research Interests', 'Themes and keywords'],
      ['ResearchStatement2020.html', '📄', 'Research Statement 2020', ''],
      ['ResearchStatement2018.html', '📄', 'Research Statement 2018', ''],
      ['ResearchStatement2016.html', '📄', 'Research Statement 2016', ''],
      ['ResearchStatement2009.html', '📄', 'Research Statement 2009', ''],
    ] },
    { label: 'Publications', items: [
      ['publications.html', '📚', 'Publications', 'Full list with BibTeX'],
      ['publications-top-confs.html', '🏆', 'Top-Tier Conferences', 'AAAI · IJCAI · AAMAS · ACL · ACM CI …'],
      ['awards.html', '🎖️', 'Awards', 'Complete list of awards'],
    ] },
    ['news.html', 'News'],
    { label: 'Activities', items: [
      ['activity.html', '🤝', 'Professional Activities', 'Conference & society service'],
      ['lecture.html', '🎓', 'Teaching', 'Courses by academic year'],
    ] },
  ],
  ja: [
    ['index-j.html', 'ホーム'],
    { label: '研究', items: [
      ['index-j.html#research', '🔬', '研究テーマ', '研究の背景とキーワード'],
      ['researchstatement-j2020.html', '📄', '研究概要 2020', ''],
      ['researchstatement-j2018.html', '📄', '研究概要 2018', ''],
      ['researchstatement-j2016.html', '📄', '研究概要 2016', ''],
      ['research-j.html', '📄', '研究概要 2009', ''],
    ] },
    { label: '業績', items: [
      ['publications-j.html', '📚', '論文一覧', '全業績・BibTeX 付き'],
      ['publications-top-confs-j.html', '🏆', '難関国際会議', 'AAAI・IJCAI・AAMAS・ACL・ACM CI など'],
      ['awards-j.html', '🎖️', '受賞歴', '受賞の全一覧'],
    ] },
    ['news-j.html', 'お知らせ'],
    { label: '活動', items: [
      ['activity-j.html', '🤝', '学会活動', '国際会議・学会・編集委員など'],
      ['lecture-j.html', '🎓', '担当講義', '年度別の担当科目'],
    ] },
  ],
};
const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const isJa = f => /-j\.html$|-j\d{4}\.html$/.test(f);

function navMenuHTML(file) {
  const cur = h => h === file ? ' aria-current="page"' : '';
  const rows = NAV[isJa(file) ? 'ja' : 'en'].map((it, i) => {
    if (Array.isArray(it)) return `        <li><a href="${it[0]}"${cur(it[0])}>${esc(it[1])}</a></li>`;
    const here = it.items.some(x => x[0] === file);
    const items = it.items.map(([h, ico, t, sub]) =>
      `            <li><a href="${h}"${cur(h)}><span class="dd-ico">${ico}</span><span><span class="dd-title">${esc(t)}</span>${sub ? `<span class="dd-sub">${esc(sub)}</span>` : ''}</span></a></li>`).join('\n');
    return `        <li class="nav-more${here ? ' current' : ''}">
          <button type="button" class="nav-more-btn" aria-expanded="false" aria-controls="nav-group-${i}">${esc(it.label)} ${CHEVRON}</button>
          <ul class="nav-dropdown" id="nav-group-${i}">
${items}
          </ul>
        </li>`;
  });
  return `<ul class="nav-menu" id="nav-menu">\n${rows.join('\n')}\n      </ul>`;
}
function applyNav(html, file) {
  const re = /<ul class="nav-menu[^"]*" id="nav-menu">[\s\S]*?\n      <\/ul>/;
  if (!re.test(html)) throw new Error(`${file}: nav menu not found`);
  return html.replace(re, () => navMenuHTML(file));
}

// ── injection ──────────────────────────────────────────────
// First run: an empty <tag id="X" …></tag> (or one holding only a
// "Loading…" placeholder) gets the markers. Later runs replace
// whatever sits between the markers.
function inject(html, file, id, content) {
  const open = `<!--static:${id}-->`, close = `<!--/static:${id}-->`;
  const block = `${open}\n${content}\n${close}`;
  const marked = new RegExp(`${open}[\\s\\S]*?${close}`);
  if (marked.test(html)) return html.replace(marked, () => block);
  const empty = new RegExp(`(<(div|section)\\b[^>]*\\bid="${id}"[^>]*>)(\\s*(?:<div style="[^"]*">[^<]*</div>\\s*)?)(</\\2>)`);
  if (!empty.test(html)) throw new Error(`${file}: container #${id} not found (or not empty)`);
  return html.replace(empty, (_, a, _t, _inner, z) => `${a}${block}${z}`);
}

(async () => {
  const news = await loadNews();
  const jobs = [];
  for (const [lang, sfx] of [['en', ''], ['ja', '-j']]) {
    jobs.push([`publications${sfx}.html`, { 'pub-list': pubsHTML(lang) }]);
    jobs.push([`publications-top-confs${sfx}.html`, { sections: topConfsHTML(lang) }]);
    jobs.push([`news${sfx}.html`, { 'news-list': newsHTML(news.all, lang) }]);
    jobs.push([`awards${sfx}.html`, { 'awards-list': awardsHTML(lang) }]);
    jobs.push([`activity${sfx}.html`, { roles: rolesHTML(lang), timeline: activitiesHTML(lang), reviewing: reviewingHTML() }]);
    jobs.push([`lecture${sfx}.html`, { current: lectureHTML(lang, true), timeline: lectureHTML(lang, false) }]);
    jobs.push([`index${sfx}.html`, { 'news-feed': newsHTML(news.front, lang), 'awards-feed': awardsHTML(lang, 6) }]);
  }

  // Pages that only need the shared menu (no baked data).
  for (const f of fs.readdirSync(ROOT).filter(f => /\.html$/.test(f))) {
    if (!jobs.some(j => j[0] === f) && /<nav class="site-nav"/.test(read(f))) jobs.push([f, {}]);
  }

  let stale = 0;
  for (const [file, parts] of jobs) {
    const before = read(file);
    let after = applyNav(before, file);
    for (const [id, content] of Object.entries(parts)) after = inject(after, file, id, content);
    if (after === before) continue;
    stale++;
    if (CHECK) console.log(`out of date: ${file}`);
    else { fs.writeFileSync(path.join(ROOT, file), after); console.log(`updated: ${file}`); }
  }
  // sitemap.xml: all modern pages, with hreflang pairs and <lastmod>.
  const sm = sitemapXML();
  if (sm !== read('sitemap.xml')) {
    stale++;
    if (CHECK) console.log('out of date: sitemap.xml');
    else { fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm); console.log('updated: sitemap.xml'); }
  }
  if (!stale) console.log('static content is up to date');
  if (CHECK && stale) process.exit(1);
})().catch(e => { console.error('build-static failed:', e.message); process.exit(2); });
