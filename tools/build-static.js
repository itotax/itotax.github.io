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
//  activity.json or lecture.json. tools/pre-commit does that for you
//  once the clone is set up with `git config core.hooksPath tools`.
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
  if (/^papers\/[^/]+\.pdf$/i.test(e.url || '')) bits.push(`<a href="${attr(e.url.replace(/\.pdf$/i, '.html'))}">Details</a>`);
  if (e.abstract) bits.push(`<br><small><strong>${lang === 'ja' ? '要旨' : 'Abstract'}:</strong> ${esc(e.abstract)}</small>`);
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
// Name the file in the error: a broken data file stops the build (and with it the commit hook and the CI rebuild).
const readJSON = f => { try { return JSON.parse(read(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); } };
const BIB = parseBib(read('publications.bib'));
const AWARDS = readJSON('awards.json');
const ACTIVITY = readJSON('activity.json');
const LECTURE = readJSON('lecture.json');

// News: reuse the site's own merge logic so the baked list matches the page.
async function loadNews() {
  readJSON('news.json');   // news-merge.js swallows a file it cannot parse; fail here rather than bake an empty list
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

// ── research statements ────────────────────────────────────
// [year, EN file, JA file]. Each page gets a generated <head> block
// (canonical, hreflang, Open Graph, JSON-LD) between <!--seo--> markers.
const SITE = 'https://takayuki-ito.com/';
const STATEMENTS = [
  [2026, 'ResearchStatement2026.html', 'researchstatement-j2026.html'],
  [2020, 'ResearchStatement2020.html', 'researchstatement-j2020.html'],
  [2018, 'ResearchStatement2018.html', 'researchstatement-j2018.html'],
  [2016, 'ResearchStatement2016.html', 'researchstatement-j2016.html'],
  [2009, 'ResearchStatement2009.html', 'research-j.html'],
];
const PERSON_REF = { '@type': 'Person', '@id': SITE + '#person', name: 'Takayuki Ito', alternateName: '伊藤孝行', url: SITE };
const ldScript = graph => '<script type="application/ld+json">\n'
  + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2) + '\n</script>';

function statementSeo(html, year, en, ja, lang) {
  const file = lang === 'ja' ? ja : en;
  const url = SITE + file;
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [, ''])[1].trim();
  const own = /<meta name="description" content="([^"]*)">(?![\s\S]*<!--\/seo-->)/.exec(html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, ''));
  const desc = own ? own[1] : (lang === 'ja'
    ? `伊藤孝行（京都大学）の研究概要（${year}年版）。`
    : `Research statement (${year}) by Takayuki Ito, Professor at Kyoto University.`);
  const home = lang === 'ja' ? SITE + 'index-j.html' : SITE;
  // 本文に <time class="rs-date" datetime="YYYY-MM-DD"> があればその日付を公開日にする
  const published = (/<time class="rs-date" datetime="(\d{4}-\d{2}-\d{2})"/.exec(html) || [, String(year)])[1];
  const lines = [
    own ? '' : `<meta name="description" content="${attr(desc)}">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" hreflang="en" href="${SITE + en}">`,
    `<link rel="alternate" hreflang="ja" href="${SITE + ja}">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE + en}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}ito20210307.jpeg">`,
    `<meta name="twitter:card" content="summary">`,
    ldScript([
      { '@type': 'Article', '@id': url + '#article', headline: title, description: desc, url, inLanguage: lang,
        datePublished: published, author: PERSON_REF, about: PERSON_REF,
        isPartOf: { '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: 'Takayuki Ito' },
        breadcrumb: { '@id': url + '#breadcrumb' } },
      { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
        { '@type': 'ListItem', position: 1, name: lang === 'ja' ? '伊藤孝行' : 'Takayuki Ito', item: home },
        { '@type': 'ListItem', position: 2, name: lang === 'ja' ? `研究概要 ${year}` : `Research Statement ${year}`, item: url }] },
    ]),
  ].filter(Boolean);
  const block = `<!--seo-->\n${lines.join('\n')}\n<!--/seo-->`;
  if (/<!--seo-->[\s\S]*?<!--\/seo-->/.test(html)) return html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, () => block);
  if (!/<\/title>/.test(html)) throw new Error(`${file}: <title> not found`);
  return html.replace(/<\/title>/, m => `${m}\n${block}`);
}

// ── paper landing pages ────────────────────────────────────
// One small page per PDF in papers/ (papers/NAME.html), carrying the
// citation_* meta tags Google Scholar reads plus ScholarlyArticle JSON-LD.
const PAPER_MARK = '<!-- generated by tools/build-static.js: paper page -->';
const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-L4QF5K46LC"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-L4QF5K46LC');
</script>`;
const paperPageOf = e => /^papers\/[^/]+\.pdf$/i.test(e.url || '') ? e.url.replace(/\.pdf$/i, '.html') : null;

function paperPageHTML(e) {
  const page = paperPageOf(e);
  const url = SITE + page, pdf = SITE + e.url;
  const title = cleanTeX(e.title || '');
  const authors = cleanTeX(e.author || '').split(/\s+and\s+/).filter(Boolean);
  const venue = cleanTeX(e.journal || e.booktitle || e.school || '');
  const lang = (e.lang || '').toLowerCase() === 'ja' ? 'ja' : 'en';
  const pages = cleanTeX(e.pages || '').split(/[–-]+/);
  const venueTag = e._type === 'article' ? 'citation_journal_title'
    : (e._type === 'phdthesis' || e._type === 'mastersthesis') ? 'citation_dissertation_institution' : 'citation_conference_title';
  const meta = [
    ['citation_title', title], ...authors.map(a => ['citation_author', a]),
    ['citation_publication_date', e.year], [venueTag, venue],
    ['citation_volume', e.volume], ['citation_issue', e.number],
    ['citation_firstpage', pages[0]], ['citation_lastpage', pages[1]],
    ['citation_doi', e.doi], ['citation_language', lang], ['citation_pdf_url', pdf],
  ].filter(([, v]) => v).map(([k, v]) => `<meta name="${k}" content="${attr(v)}">`).join('\n');
  const desc = `${authors.join(', ')}. ${title}. ${venue}${e.year ? ', ' + e.year : ''}.`;
  const ld = ldScript([{
    '@type': e._type.endsWith('thesis') ? 'Thesis' : 'ScholarlyArticle', '@id': url + '#paper', headline: title, name: title, url,
    inLanguage: lang, datePublished: e.year,
    author: authors.map(a => /^(Takayuki Ito|伊藤孝行)$/.test(a) ? PERSON_REF : { '@type': 'Person', name: a }),
    ...(venue ? { isPartOf: { '@type': e._type === 'article' ? 'Periodical' : 'CreativeWork', name: venue } } : {}),
    ...(e.pages ? { pagination: cleanTeX(e.pages) } : {}),
    ...(e.doi ? { sameAs: 'https://doi.org/' + e.doi } : {}),
    ...(e.abstract ? { abstract: e.abstract } : {}),
    encoding: { '@type': 'MediaObject', contentUrl: pdf, encodingFormat: 'application/pdf' },
  }]);
  const cite = [venue && `<em>${esc(venue)}</em>`, e.volume && `vol. ${esc(e.volume)}${e.number ? `(${esc(e.number)})` : ''}`,
                e.pages && `pp. ${esc(cleanTeX(e.pages))}`, e.year && esc(e.year)].filter(Boolean).join(', ');
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${PAPER_MARK}
${GTAG}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Takayuki Ito</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${url}">
${meta}
<meta property="og:type" content="article">
<meta property="og:title" content="${attr(title)}">
<meta property="og:url" content="${url}">
${ld}
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<style>
  body { font-family: Inter, 'Noto Sans JP', system-ui, -apple-system, sans-serif; color: #1f2937; background: #fff; margin: 0; line-height: 1.7; -webkit-font-smoothing: antialiased; }
  main { max-width: 760px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
  a { color: #2563eb; text-decoration: none; } a:hover { text-decoration: underline; }
  .crumb { font-size: .85rem; color: #6b7280; margin-bottom: 1.75rem; }
  h1 { font-size: 1.5rem; line-height: 1.4; color: #0f2044; margin: 0 0 .75rem; }
  .authors { font-size: 1rem; margin: 0 0 .35rem; }
  .venue { color: #6b7280; font-size: .95rem; margin: 0 0 1.5rem; }
  .links { display: flex; flex-wrap: wrap; gap: .6rem; }
  .btn { display: inline-block; padding: .5rem 1.1rem; border-radius: 10px; font-size: .9rem; font-weight: 600; border: 1px solid #e5e7eb; background: #f9fafb; color: #1f2937; }
  .btn.fill { background: #2563eb; border-color: #2563eb; color: #fff; }
  .btn:hover { text-decoration: none; filter: brightness(.97); }
</style>
</head>
<body>
<main>
  <p class="crumb"><a href="../${lang === 'ja' ? 'index-j.html' : 'index.html'}">${lang === 'ja' ? '伊藤孝行' : 'Takayuki Ito'}</a> › <a href="../${lang === 'ja' ? 'publications-j.html' : 'publications.html'}">${lang === 'ja' ? '論文一覧' : 'Publications'}</a></p>
  <h1>${esc(title)}</h1>
  <p class="authors">${esc(authors.join(', '))}</p>
  <p class="venue">${cite}</p>
  ${e.abstract ? `<h2 style="font-size:1rem;color:#0f2044;margin:0 0 .4rem">Abstract</h2>\n  <p style="margin:0 0 1.5rem">${esc(e.abstract)}</p>` : ''}
  <p class="links">
    <a class="btn fill" href="${esc(path.basename(e.url))}">PDF</a>
    ${e.doi ? `<a class="btn" href="https://doi.org/${attr(e.doi)}">DOI</a>` : ''}
  </p>
</main>
</body>
</html>
`;
}

// Returns the list of generated pages; writes / removes files unless CHECK.
function buildPaperPages() {
  const want = new Map();
  BIB.forEach(e => { const p = paperPageOf(e); if (p && fs.existsSync(path.join(ROOT, e.url))) want.set(p, paperPageHTML(e)); });
  let changed = 0;
  for (const [p, html] of want) {
    const abs = path.join(ROOT, p);
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === html) continue;
    changed++;
    if (CHECK) console.log(`out of date: ${p}`); else fs.writeFileSync(abs, html);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'papers')).filter(f => f.endsWith('.html'))) {
    const p = `papers/${f}`;
    if (want.has(p) || !read(p).includes(PAPER_MARK)) continue;     // only remove our own stale pages
    changed++;
    if (CHECK) console.log(`stale: ${p}`); else fs.unlinkSync(path.join(ROOT, p));
  }
  if (changed && !CHECK) console.log(`updated: ${changed} paper page(s) in papers/`);
  return { pages: [...want.keys()].sort(), changed };
}

// ── llms-full.txt ──────────────────────────────────────────
// llms.txt (hand-written summary) + generated detail for AI crawlers.
const plain = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&ldquo;|&rdquo;/g, '"').replace(/&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&[a-z]+;/g, ' ').replace(/[ \t]+/g, ' ').trim();
function textCite(e) {
  const a = cleanTeX(e.author || ''), t = cleanTeX(e.title || ''), v = cleanTeX(e.journal || e.booktitle || '');
  return `- ${a}. "${t}." ${v}${e.year ? ', ' + e.year : ''}.${e.doi ? ' https://doi.org/' + e.doi : ''}`
    + (e.abstract ? `\n  Abstract: ${e.abstract}` : '');
}
function llmsFull(news) {
  const out = [read('llms.txt').trim(), ''];
  // Latest research statement (English), as plain text.
  const [year, en] = STATEMENTS[0];
  const m = /<main[^>]*>([\s\S]*?)<\/main>/.exec(read(en));
  if (m) {
    const body = m[1].replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, (_, t) => `\n### ${plain(t)}\n`)
      .replace(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/g, (_, t) => `\n#### ${plain(t)}\n`)
      .replace(/<li[^>]*>/g, '\n- ').replace(/<\/(p|div|li|ul|ol|tr|blockquote)>/g, '\n').replace(/<br\s*\/?>/g, '\n');
    out.push(`## Research statement (${year})`, `Source: ${SITE}${en}`,
             plain(body.replace(/\n/g, '\u0001')).replace(/\u0001/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), '');
  }
  const yearOf = e => e.year || (e.date || '').slice(0, 4);
  out.push('## Awards', ...[...AWARDS].sort((a, b) => yearOf(b).localeCompare(yearOf(a))).map(e => `- ${yearOf(e)}: ${plain(e.en || e.ja)}`), '');
  out.push('## Recent news', ...news.all.slice(0, 20).map(e => `- ${e.date}: ${plain(e.en || e.ja)}`), '');
  const rules = venueRules();
  const top = BIB.filter(e => e._type === 'inproceedings' && !/\bWorkshop\b/i.test(e.booktitle || '') && rules.some(r => r.test(cleanTeX(e.booktitle || ''))))
    .sort(byYearThenAccepted);
  out.push('## Papers at top-tier conferences (AAAI, IJCAI, AAMAS, ACL, EMNLP, ICML, KDD, SIGMOD, ACM CI)', ...top.map(textCite), '');
  const jr = BIB.filter(e => e._type === 'article' && (parseInt(e.year) || 0) >= 2020 && (e.lang || '').toLowerCase() !== 'ja').sort(byYearThenAccepted);
  out.push('## English-language journal articles since 2020', ...jr.map(textCite), '');
  out.push(`The complete record (all years, all types) is at ${SITE}publications.html and ${SITE}publications.bib.`, '');
  return out.join('\n');
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
function sitemapXML(paperPages) {
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
  for (const [year, en, ja] of STATEMENTS) for (const f of [en, ja]) {
    urls.push(`  <url>
    <loc>${SITE}${f}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/>
    <xhtml:link rel="alternate" hreflang="ja" href="${SITE}${ja}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${en}"/>
    <lastmod>${lastmod(f)}</lastmod>
    <priority>${year >= 2026 ? '0.7' : '0.4'}</priority>
  </url>`);
  }
  for (const f of paperPages || []) {
    urls.push(`  <url><loc>${SITE}${f}</loc><priority>0.3</priority></url>`);
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
      ['ResearchStatement2026.html', '📄', 'Research Statement 2026', 'Latest'],
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
      ['researchstatement-j2026.html', '📄', '研究概要 2026', '最新版'],
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
    const st = STATEMENTS.find(x => x[1] === file || x[2] === file);
    if (st) after = statementSeo(after, st[0], st[1], st[2], st[2] === file ? 'ja' : 'en');
    if (after === before) continue;
    stale++;
    if (CHECK) console.log(`out of date: ${file}`);
    else { fs.writeFileSync(path.join(ROOT, file), after); console.log(`updated: ${file}`); }
  }
  // Paper landing pages (papers/NAME.html) and llms-full.txt.
  const papers = buildPaperPages();
  stale += papers.changed;
  const full = llmsFull(news);
  if (!fs.existsSync(path.join(ROOT, 'llms-full.txt')) || full !== read('llms-full.txt')) {
    stale++;
    if (CHECK) console.log('out of date: llms-full.txt');
    else { fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), full); console.log('updated: llms-full.txt'); }
  }
  // sitemap.xml: modern pages, research statements and paper pages.
  const sm = sitemapXML(papers.pages);
  if (sm !== read('sitemap.xml')) {
    stale++;
    if (CHECK) console.log('out of date: sitemap.xml');
    else { fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm); console.log('updated: sitemap.xml'); }
  }
  if (!stale) console.log('static content is up to date');
  if (CHECK && stale) process.exit(1);
})().catch(e => { console.error('build-static failed:', e.message); process.exit(2); });
