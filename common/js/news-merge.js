// ────────────────────────────────────────────────────────────
//  news-merge.js
//
//  Single-source workflow for news generated from publications.bib.
//
//  ── Paper acceptances ──────────────────────────────────────
//  Add this field to any bib entry to publish it as a
//  "paper accepted" news item — no need to edit news.json:
//
//      accepted = {2026-05-17}              % ISO date
//
//  ── Invited talks ──────────────────────────────────────────
//  Add this field to an @invitedtalk entry to publish it as a
//  "talk" news item (tag = talk):
//
//      newsdate = {2026-08-10}              % ISO date of the talk
//
//  The Japanese body is derived from `note` automatically
//  (role prefix kept, author and trailing date stripped), so
//  `news-ja` is only needed to override the wording. Because bib
//  notes for domestic talks are Japanese-only, add `news-en` to
//  give the English News page a proper translation.
//  If the entry has `url=`, it is linked from the news item.
//
//  ── Body-text overrides (both kinds) ───────────────────────
//
//      news-ja = {論文採択：… <em>Venue</em>、場所}
//      news-en = {Paper accepted: … <em>Venue</em>, place}
//
//  De-dup with news.json: if a news.json entry includes
//      "bibkey": "gao2026kdd"
//  it is suppressed when the matching bib entry is published here.
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
      important: rankOf(e, venue),
      _bibkey: e._key,
    };
  }

  // "招待講演, 伊藤孝行, 「題目」, 会場…, 2026.08.10."
  //   →  "招待講演：「題目」, 会場…"
  // Used only when the entry has no explicit news-ja override.
  // Separators in the bib notes are inconsistent: ASCII ",", fullwidth
  // "，" and ideographic "、" all appear, so every split accepts all three.
  const ROLE_WORDS = /(講演|講師|パネル|チュートリアル|セミナー|基調|招待|Invited|Keynote|Speaker|Tutorial|Lecture|Panel)/i;

  function deriveTalkText(raw) {
    let s = cleanTeX(raw);
    // drop the trailing date (2026.08.10. / 2026.1.27 / 2026年1月27日)
    s = s.replace(/[,，、]?\s*\d{4}\s*[.\-\/年]\s*\d{1,2}\s*[.\-\/月]\s*\d{1,2}\s*日?\s*\.?\s*$/, '');

    let role = '';
    // preferred shape: "ROLE, 伊藤孝行, …" — drop the author, keep the role
    const withAuthor = /^([^,，、]{2,16})[,，、]\s*(?:伊藤孝行|Takayuki Ito)\s*[,，、]?\s*/.exec(s);
    if (withAuthor) {
      role = withAuthor[1].trim();
      s = s.slice(withAuthor[0].length);
    } else {
      // author omitted: only treat the lead segment as a role if it reads like one
      const lead = /^([^,，、]{2,16})[,，、]\s*/.exec(s);
      if (lead && ROLE_WORDS.test(lead[1])) {
        role = lead[1].trim();
        s = s.slice(lead[0].length);
      }
    }
    s = s.replace(/^[\s.,，、]+/, '').replace(/[\s.,，、]+$/, '');
    return role ? `${role}：${s}` : s;
  }

  function talkToNews(e) {
    const overrideJa = e['news-ja'] || e.news_ja;
    const overrideEn = e['news-en'] || e.news_en;
    const derived = deriveTalkText(e.note || e.title || '');

    const ja = `🎤 ${overrideJa ? cleanTeX(overrideJa) : derived}`;
    // No English text on file → fall back to the Japanese body rather
    // than dropping the item from the English page.
    const en = `🎤 ${overrideEn ? cleanTeX(overrideEn)
                   : (overrideJa ? cleanTeX(overrideJa) : derived)}`;

    const item = {
      date: e.newsdate,
      tag: 'talk',
      ja,
      en,
      important: (e.newsrank || '').toLowerCase() === 'top',
      _bibkey: e._key,
    };
    if (e.url) item.link = e.url;
    return item;
  }

  // ── Front-page retention policy ────────────────────────────
  // The top page keeps major results visible for a year, while
  // everything else rolls off after about a month. The full list
  // always remains on news.html / news-j.html.
  const FRONT_PAGE = {
    max:            10,   // 最大表示件数
    importantDays:  365,  // 難関国際会議・難関論文誌・受賞の掲載期間
    otherDays:      31,   // その他（一般の論文採択・招待講演など）
    minItems:       5,    // 期間で絞った結果が少なすぎる場合の下限
  };

  // 難関国際会議：publications-top-confs.html の VENUE_RULES と同じ範囲
  const TOP_CONF = /\b(AAAI|IJCAI|AAMAS|ACL|EMNLP|ICML|KDD|SIGKDD|SIGMOD|PODS)\b|Autonomous Agents and Multi|Association for Computational Linguistics|Empirical Methods in Natural Language Processing|International Conference on Machine Learning|Knowledge Discovery and Data Mining|Collective Intelligence/i;

  const JP_CHARS = /[ぁ-んァ-ヶ一-龥]/;

  function isTopConf(text) {
    if (!text) return false;
    if (/\bWorkshop\b/i.test(text)) return false;   // ワークショップは対象外
    return TOP_CONF.test(text);
  }

  // 英文論文誌の論文はすべて重要扱い。和文誌の除外は lang={ja} と
  // 誌名の日本語文字の両方で判定する（bib 上では両者が一致している）。
  function isEnglishJournal(e) {
    if (e._type !== 'article') return false;
    const journal = e.journal || '';
    if (!journal) return false;
    if ((e.lang || '').toLowerCase() === 'ja') return false;
    return !JP_CHARS.test(journal);
  }

  // bib 側は `newsrank = {top}` / `{normal}` で自動判定を上書きできる
  function rankOf(e, venue) {
    const r = (e.newsrank || '').toLowerCase();
    if (r === 'top') return true;
    if (r === 'normal') return false;
    return isEnglishJournal(e) || isTopConf(venue);
  }

  function bibNewsItems(entries) {
    const out = [];
    entries.forEach(e => {
      if (e.accepted) out.push(bibToNews(e));
      else if (e._type === 'invitedtalk' && e.newsdate) out.push(talkToNews(e));
    });
    return out;
  }

  async function loadMergedNews() {
    const bibPromise = fetch('publications.bib')
      .then(r => r.ok ? r.text() : '')
      .then(src => src ? bibNewsItems(parseBib(src)) : [])
      .catch(() => []);

    const jsonPromise = fetch('news.json')
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    const [fromBib, fromJson] = await Promise.all([bibPromise, jsonPromise]);

    const suppressed = new Set(fromBib.map(e => e._bibkey));
    const filteredJson = fromJson
      .filter(e => !(e.bibkey && suppressed.has(e.bibkey)))
      .map(e => ({
        ...e,
        // news.json は "important": true / false で明示指定する。指定が無い
        // 場合は受賞を重要扱いとし、それ以外は本文から難関会議名のみ判定する
        // （手書き本文からは論文誌かどうかを確実に判定できないため、英文誌の
        //   エントリには "important": true を明記すること）。
        important: typeof e.important === 'boolean'
          ? e.important
          : (e.tag === 'award' || isTopConf(e.en || e.ja || '')),
      }));

    return [...fromBib, ...filteredJson]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // Front-page selection: important items for a year, the rest for a
  // month, capped at FRONT_PAGE.max. `items` must already be sorted
  // newest-first (loadMergedNews returns them that way).
  function selectFrontPageNews(items, now) {
    const today = now || new Date();
    const ageDays = iso => {
      const t = Date.parse(iso);
      return isNaN(t) ? Infinity : (today - t) / 86400000;
    };

    const kept = items.filter(e =>
      ageDays(e.date) <= (e.important ? FRONT_PAGE.importantDays : FRONT_PAGE.otherDays));

    // 静かな時期でも見出しが空にならないよう、最低件数までは直近から補う
    if (kept.length < FRONT_PAGE.minItems) {
      const seen = new Set(kept);
      for (const e of items) {
        if (kept.length >= FRONT_PAGE.minItems) break;
        if (!seen.has(e)) { kept.push(e); seen.add(e); }
      }
      kept.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    return kept.slice(0, FRONT_PAGE.max);
  }

  window.loadMergedNews = loadMergedNews;
  window.selectFrontPageNews = selectFrontPageNews;
})();
