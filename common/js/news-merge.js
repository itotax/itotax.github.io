// ────────────────────────────────────────────────────────────
//  news-merge.js
//
//  Single-source workflow for paper-acceptance news.
//
//  Add this field to a publications.bib entry to publish it as
//  a "paper accepted" news item — no need to edit news.json:
//
//      accepted = {2026-05-17}              % ISO date
//
//  Optional per-entry overrides for the news body text:
//
//      news-ja = {論文採択：… <em>Venue</em>、場所}
//      news-en = {Paper accepted: … <em>Venue</em>, place}
//
//  De-dup with news.json: if a news.json entry includes
//      "bibkey": "gao2026kdd"
//  it is suppressed when the matching bib entry has `accepted=`.
//
//  Exposes: window.loadMergedNews()  →  Promise<Array<NewsItem>>
//      NewsItem = { date, tag, ja, en, link?, link_ja?, link_en? }
// ────────────────────────────────────────────────────────────

(function () {
  function parseBib(src) {
    const out = [];
    src = src.replace(/^%.*$/gm, '');
    const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const type = m[1].toLowerCase();
      if (['string', 'preamble', 'comment'].includes(type)) continue;
      const key = m[2];
      const start = m.index + m[0].length;
      let depth = 1, i = start;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      const body = src.slice(start, i - 1);
      const entry = { _type: type, _key: key };
      const fre = /([\w-]+)\s*=\s*(?:\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}|"([^"]*)"|(\d+))/g;
      let fm;
      while ((fm = fre.exec(body)) !== null) {
        const fname = fm[1].toLowerCase();
        const fval = (fm[2] ?? fm[3] ?? fm[4] ?? '').trim();
        entry[fname] = fval.replace(/\s+/g, ' ');
      }
      out.push(entry);
    }
    return out;
  }

  function cleanTeX(s) {
    if (!s) return '';
    return String(s)
      .replace(/\\&/g, '&')
      .replace(/\\'(\w)/g, '$1')
      .replace(/\\'/g, '\'')
      .replace(/\{\\"(\w)\}/g, '$1')
      .replace(/\{([^{}]+)\}/g, '$1')
      .replace(/--/g, '–')
      .replace(/~/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function bibToNews(e) {
    const author    = cleanTeX(e.author || e.editor || '');
    const title     = cleanTeX(e.title || '');
    const venue     = cleanTeX(e.booktitle || e.journal || '');
    const year      = e.year || '';
    const address   = cleanTeX(e.address || '');
    const overrideJa = e['news-ja'] || e.news_ja;
    const overrideEn = e['news-en'] || e.news_en;

    const tailJa = (venue ? `<em>${venue}</em>` : '')
                 + (year ? `, ${year}` : '')
                 + (address ? `、${address}` : '');
    const tailEn = (venue ? `<em>${venue}</em>` : '')
                 + (year ? `, ${year}` : '')
                 + (address ? `, ${address}` : '');

    const ja = overrideJa
      ? `論文採択：${cleanTeX(overrideJa)}`
      : `論文採択：${author}, "${title}," ${tailJa}`;
    const en = overrideEn
      ? `Paper accepted: ${cleanTeX(overrideEn)}`
      : `Paper accepted: ${author}, "${title}," ${tailEn}`;

    return {
      date: e.accepted,
      tag:  'paper',
      ja,
      en,
      _bibkey: e._key,
    };
  }

  async function loadMergedNews() {
    const bibPromise = fetch('publications.bib')
      .then(r => r.ok ? r.text() : '')
      .then(src => src
        ? parseBib(src).filter(e => e.accepted).map(bibToNews)
        : [])
      .catch(() => []);

    const jsonPromise = fetch('news.json')
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    const [fromBib, fromJson] = await Promise.all([bibPromise, jsonPromise]);

    const suppressed = new Set(fromBib.map(e => e._bibkey));
    const filteredJson = fromJson.filter(e => !(e.bibkey && suppressed.has(e.bibkey)));

    return [...fromBib, ...filteredJson]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  window.loadMergedNews = loadMergedNews;
})();
