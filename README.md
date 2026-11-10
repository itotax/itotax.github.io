# takayuki-ito.com — サイト構成と保守ドキュメント

伊藤孝行（京都大学 情報学研究科 教授）の個人ホームページのソース。
本ドキュメントは**現状の完全な記録**であり、保守の際の参照点とする。

最終更新: 2026-09-25

---

## 1. 概要・デプロイ

- **公開URL**: https://takayuki-ito.com/
- **ホスティング**: GitHub Pages、`main` ブランチからデプロイ。
- **独自ドメイン**: `CNAME`（`takayuki-ito.com`）で設定。
- **ビルド不要**: フレームワーク・バンドラなし。素のHTML + 各ファイルにインライン `<style>`。
- **更新フロー**: `main` に直接コミット → `git push` でデプロイ反映。
- **言語**: バイリンガル（日本語 / 英語）。EN = `name.html` / JA = `name-j.html` で対をなす。

---

## 2. ページ一覧（現存21ページ）

### モダン版（本番・SEO対応・sitemap掲載）

| 機能 | 英語 | 日本語 |
|------|------|--------|
| トップ | `index.html` | `index-j.html` |
| 論文一覧 | `publications.html` | `publications-j.html` |
| 難関国際会議 | `publications-top-confs.html` | `publications-top-confs-j.html` |
| News | `news.html` | `news-j.html` |
| 受賞歴 | `awards.html` | `awards-j.html` |
| 学会活動 | `activity.html` | `activity-j.html` |
| 担当講義 | `lecture.html` | `lecture-j.html` |

### 研究概要（ResearchStatement、4年分・日英ペア完備）

| 年 | 英語 | 日本語 |
|----|------|--------|
| 2020 | `ResearchStatement2020.html` | `researchstatement-j2020.html` |
| 2018 | `ResearchStatement2018.html` | `researchstatement-j2018.html` |
| 2016 | `ResearchStatement2016.html` | `researchstatement-j2016.html` |
| 2009 | `ResearchStatement2009.html` | `research-j.html`（※2009 JAのみ旧URL名を維持） |

各ResearchStatementページにも共通ナビ（`common/css/site-nav.css` + `common/js/site-nav.js`、ページ側は `<main class="rs-wrap">` で本文を包む）を導入済み（2026-11-08）。言語切替はナビの EN/JA ピルで行う。
サブページと研究概要ページのナビには「🔬 Research / 研究概要」項目があり、`index(-j).html#research` の研究概要ボタン群へ飛ぶ。

**命名規約**: EN = `ResearchStatementYYYY.html`、JA = `researchstatement-jYYYY.html`。
新しい年版を追加する場合もこの規約に従い、`index.html` / `index-j.html` の研究概要リンク（`.research-links` 内）に両言語分を追加すること。

---

## 3. ディレクトリ構成

```
/                       … 全HTMLページ、データファイル、ルート資産
  CNAME                 … 独自ドメイン設定
  robots.txt            … 全許可 + sitemap参照
  sitemap.xml           … 14 URL（モダン版のみ、hreflang・lastmod 付き。build-static.js が生成）
  llms.txt              … AI 向けのサイト要約と主要ページ一覧（手書き。役職・受賞などが変わったら更新）
  favicon.svg, apple-touch-icon.png
  publications.bib      … BibTeX（News生成にも使用、`accepted={YYYY-MM-DD}` フィールド）
  news.json             … News手動エントリ（bibkeyでbibと重複排除）
  awards.json           … 受賞データ
  activity.json         … 学会活動データ（日英1本化、EN/JA両ページが参照）
  lecture.json          … 担当講義データ（年度別＋英訳辞書、lecture.html / lecture-j.html が参照）
  FIXES.md              … 保守・修正履歴
  README.md             … 本ドキュメント
  *.pdf (7)             … CV、受賞状・業績紹介、講演チラシ等（全件がページまたは bib から参照）
  *.jpg/.jpeg (9)       … プロフィール写真（Web用縮小版＋OG画像）、受賞写真
common/js/
  news-merge.js         … News生成スクリプト
  site-nav.js           … 共通ナビの動作（ドロップダウン・ハンバーガー・scroll-spy）
common/css/
  site-nav.css          … 共通ナビのスタイル
tools/
  build-static.js       … bib / JSON の内容を各ページに静的HTMLとして焼き込む（Node.js）
papers/  (54 PDF)       … 論文PDF（全件が bib の url= から参照されている）
oldfiles/               … アーカイブ（.gitignore 対象で非公開・ローカル保管のみ。media/ に新聞記事スキャン、photos/ に旧写真）
```

---

## 4. スタイル・技術規約

- スタイルは各HTMLのインライン `<style>` が基本（例外はナビの `common/css/site-nav.css` のみ）。
- CSS変数: `--primary:#0f2044`（濃紺）、`--accent:#2563eb`（青）、`--text:#1f2937`。
- フォント: Inter + Noto Sans JP（Google Fonts）。
- レスポンシブ: 680px ブレークポイント（ナビのみ 920px で切替、下記）。
- **ナビゲーション（全モダンページ共通）**: スタイルは `common/css/site-nav.css`、動作は `common/js/site-nav.js` に集約
  （サイトで唯一の共通CSS）。マークアップ `<nav class="site-nav">` は各ページに静的HTMLで記述する。
  - **トップページ**（`index.html` / `index-j.html`）: ページ内セクション6項目（お知らせ〜連絡先）を横並びにし、
    表示中のセクションを強調表示（scroll-spy）。他ページは「ページ / Pages ▾」ドロップダウン（`.nav-dropdown`、アイコン＋説明付き）。
    ナビは `position: fixed`（ページ側で上書き）。
  - **サブページ**（論文一覧・難関国際会議・お知らせ・受賞歴・学会活動・担当講義）: サイトの各ページを横並び
    （`.nav-menu--pages`）にし、表示中のページに `aria-current="page"` を付けて下線表示。ナビは `position: sticky`。
  - 920px 以下はハンバーガーメニューになり、パネル表示（ページはアイコン付きカード）。
  - **サブページを追加したら**: 両 index の `.nav-dropdown` と、全サブページの `.nav-menu--pages` に1行ずつ追加する。
  - 研究概要（ResearchStatement 系8ページ）は文書ページのため対象外（← Home と言語トグルのみ）。
- サブページの見出しは各ページ先頭の `<h1>`（`.page-hero` / `.hero` / `.page-title`）。
- フレームワーク・jQuery・ビルドツールはすべて不使用（レガシー資産は2026-06-15に撤去済み）。

---

## 5. データ駆動コンテンツ（重要：更新方法）

### 静的コピーの焼き込み（検索エンジン・AI クローラー対策）

各ページはブラウザ上で bib / JSON から描画するが、JavaScript を実行しないクローラー（多くの AI クローラー）には
中身が見えない。そこで `tools/build-static.js` が、同じ内容の素の HTML を各ページのコンテナ内
（`<!--static:NAME-->` 〜 `<!--/static:NAME-->`）に書き込む。ページの JS は読み込み時にこれを置き換えるので、
訪問者にはこれまでどおりの表示・絞り込み・検索が出る。

- **bib / JSON を編集したら、コミット前に `node tools/build-static.js` を実行する**（何度実行しても同じ結果）。
  実行し忘れても訪問者の表示は正しいままだが、クローラーに見える内容が古くなる。
- `node tools/build-static.js --check` は、焼き込みが古い場合に終了コード1を返す（確認用）。
- 対象は 14 ページ（index / publications / publications-top-confs / news / awards / activity / lecture の日英）。
  **マーカーの間は手で編集しない**（次のビルドで上書きされる）。
- News は `news-merge.js`、難関国際会議は `publications-top-confs.html` の `VENUE_RULES` をそのまま読んで使うので、
  判定ルールの定義は増えていない。
- トップページの「お知らせ」は掲載期間のルールがあるため、焼き込み内容はビルド時点のもの。

**News・受賞・学会活動は HTML を直接編集しない。** クライアント側で生成される。

### News の更新
News は3系統をマージして表示（`common/js/news-merge.js`）:
1. **論文採択**: `publications.bib` の各エントリに `accepted = {YYYY-MM-DD}` フィールドを追加すると、その論文が自動的にNewsに出る（tag=`paper`、本文は「論文採択：/Paper accepted:」）。
2. **招待講演**: `@invitedtalk` エントリに `newsdate = {YYYY-MM-DD}`（講演日）を追加すると自動的にNewsに出る（tag=`talk`）。
   - 日本語本文は `note` から自動生成される（役割プレフィクスを残し、著者名と末尾の日付を除去）。文言を変えたい場合のみ `news-ja` で上書き。
   - **`news-en` は実質必須**。bib の note は国内講演だと日本語のみで、無い場合は英語Newsページにも日本語が出るため。
   - エントリに `url =` があれば News からリンクされる。
   - 掲載範囲は「Newsが扱っている時期」に合わせる方針。古い講演まで一括で出すとNewsが講演一覧になってしまうため、`newsdate` は該当時期の講演にだけ付ける（過去分は論文一覧の招待講演フィルタで参照）。
3. **手動エントリ**（受賞・メディア等）: `news.json` に追記。`bibkey` を指定すると bib 側と重複排除される。各エントリは `date` / `tag` / `ja` / `en`（必要に応じ `link`）を持つ。

`tag` は `paper` / `award` / `talk` / `media` / `other` の5種（news.html 側にフィルタと配色あり）。

#### トップページの掲載ポリシー

`news.html` / `news-j.html` は**全件**を表示するが、トップページの「お知らせ」欄は
`selectFrontPageNews()`（`news-merge.js`）で新しい順に絞り込む。設定は同ファイル先頭の
`FRONT_PAGE` 定数（`max` / `importantDays` / `otherDays` / `minItems`）で変更できる。

| 種別 | 掲載期間 |
|------|----------|
| **重要**（英文論文誌・難関国際会議・受賞） | 365日 |
| その他（和文誌・一般の国際会議・招待講演など） | 31日 |

最大10件。期間で絞った結果が5件を下回る場合のみ、見出しが空にならないよう直近から補う。

**重要判定**（`rankOf()`）:

1. **英文論文誌はすべて重要**。`@article` かつ `lang` が `ja` でなく、誌名に日本語文字を
   含まないものを英文誌とみなす（`isEnglishJournal()`）。bib の @article 152件は
   `lang={ja}` の72件と和文誌名の72件が完全に一致しているため、この2条件で確実に分離できる。
   和文誌（人工知能学会論文誌・情報処理学会論文誌など）は通常扱い。
2. **難関国際会議**は誌名・会議名の正規表現 `TOP_CONF` で判定。範囲は
   `publications-top-confs.html` の `VENUE_RULES` と同じ
   （AAAI / IJCAI / AAMAS / ACL / EMNLP / ICML / KDD / SIGMOD / ACM CI、Workshop は除外）。
   **両者は独立した定義なので、難関会議の範囲を変えるときは2箇所とも直すこと。**
3. **受賞**（`tag: award`）は重要扱い。

判定を個別に上書きしたい場合:
- bib エントリ: `newsrank = {top}` または `{normal}`
- `news.json`: `"important": true` / `false`。手書きの本文からは論文誌かどうかを確実に
  判定できないため、**英文論文誌の手動エントリには `"important": true` を明記すること**
  （無指定の場合は受賞と難関会議名のみ自動で重要扱いになる）。

### トップページ「主な論文」（Selected Papers）
`index.html` / `index-j.html` の `<section id="papers">`（お知らせの直下）に**静的HTML**で記述。
JSON駆動ではないので、追加・変更は両ファイルを直接編集する（`.paper` ブロックを1件分コピー）。
各件は venue・年・受賞バッジ（任意）・タイトル（DOI/PDFリンク）・著者・2〜3文の説明・リンクボタンで構成。
2026-09-16 時点で4件（Communications Psychology 2024、GDN 2021、IJCAI 2007、AAMAS 2006）。

### 受賞の更新
`awards.json` に追記。`year` / `tag` / `ja` / `en` / 任意で `link`（`link_en`・`link_ja` で言語別リンク文言可）。年降順で表示、トップページは上位6件。

### 学会活動の更新
`activity.json` を編集。日英で内容が重複していた旧 `activity.html` / `activity-j.html` を
2026-07-27 に1本化し、両ページとも同じ JSON をレンダリングする方式にした。構造は3ブロック:

- `standing[]` … 継続的な役職（学会理事・運営委員・編集委員・研究助成機関など）。
  `period`（表示用の期間文字列）/ `tag` / `en` / `ja`。年次リストには重複掲載しない。
- `activities[]` … 年次別の会議・委員会活動。`year`（数値）/ `tag` / `en` / `ja`。
- `reviewing[]` … 査読・ゲストエディタの誌名（言語非依存の文字列配列）。

`tag` は `chair` / `spc` / `pc` / `editor` / `steering` / `other` の6種。
表示順は 年降順 → tag順（chair→spc→steering→pc→editor→other）→ 本文順。
`en` / `ja` は簡単なインラインHTML（`<strong>` 等）を含められる。

### 担当講義の更新
`lecture.json` の `years[]` 先頭に年度を追加する（`fy`（西暦年度）/ `label`（和暦表記）/ `inst`（`kyoto` / `nitech` / `jaist`）/ `courses[]`）。
各科目は `name` / `target`（対象）/ `term`（`前期`・`後期`・`前期・後期`・`第3ターム` など、無ければ省略）/ 任意で `detail`。
「他」がある年度は `"more": true`、客員研究員などの注記は `notes[]`、英語で実施する科目は `"english": true`（「英語で実施 / Taught in English」バッジ）。ページ上部の「Now teaching」には最新年度が自動で表示される。

英語版（`lecture.html`）は、データ本体（日本語）を `lecture.json` 末尾の `en` 辞書で英訳して表示する（`courses` / `targets` / `terms` / `details` / `notes` の各辞書は「日本語 → 英語」の対応表）。**新しい科目名・対象・注記を追加したら、`en` の該当辞書にも1行追加する**（未登録の語は英語ページに日本語のまま出る）。同じ科目は何年分あっても辞書登録は1回でよい。

### 論文の更新
`publications.bib` を編集。PDFは `papers/` に置き、bib の `url={papers/xxx.pdf}` で参照。
各年の中は**採択日の新しい順**に表示する（論文一覧・難関国際会議ページ共通）。日付は `accepted`（Newsにも掲載）を使い、News は `news.json` 側に手動エントリがあるなどの理由で bib から出したくない場合は、並び順だけに効く `acceptdate = {YYYY-MM-DD}` を使う。日付のないエントリは各年の後ろに、従来の順で並ぶ。
`url` が `.pdf` で終わる場合、論文一覧では「PDF ↗」バッジとして表示される（難関国際会議ページでは DOI があっても併記）。
2026-09-25 に未参照だった52本を該当エントリへ紐付け、内容が同一の重複10本（`jsai94/96/97/98`・`ipsj95/96/97/98-1`・`icmas-poster`・`ieaaie-poster`。`itota-` 付きの同名版を残した）を削除した。

---

## 6. SEO

- 各モダンページに meta description / canonical / hreflang(en/ja/x-default) / OG / Twitter Card を完備。
- **トップの canonical はサイトルート** `https://takayuki-ito.com/`（`index.html` 自身）。これに合わせて `index.html`・`index-j.html` の hreflang(en/x-default)・og:url、および `sitemap.xml` の該当 `<loc>`/hreflang もルートURLに統一済み。
- `sitemap.xml` は `tools/build-static.js` が生成する（**手で編集しない**）。モダン版14ページを掲載し、
  各ページに日英の hreflang と `lastmod`（そのページの最終コミット日。未コミットの変更があれば当日）を付ける。
  ResearchStatement 系は意図的に非掲載。ページを増やしたらスクリプト内の `PAGES` に追加する。
- **構造化データ（JSON-LD）**: トップ2ページに ProfilePage + Person（所属・受賞・`sameAs` で外部プロフィール）+ 主な論文4本、
  サブページ12ページに CollectionPage + BreadcrumbList を `<head>` に静的に記述。役職・所属・主な受賞・主な論文を
  変えたらトップ2ページの JSON-LD と `llms.txt` も合わせて直す。
- `robots.txt` は全許可 + sitemap 参照。

---

## 7. アナリティクス

- Google Analytics 4、計測ID **`G-L4QF5K46LC`**、全ページに gtag.js を設置。
- 旧 Urchin / UA トラッカーは撤去済み。

---

## 8. 保守履歴・既知事項

- 詳細な修正・整理の履歴は `FIXES.md` を参照。
- 2026-06-15 に、モダンサイトから未リンクの孤立レガシーページ群（`menu*` / `selfintro*` / `top-j`）と、それ専用だった旧資産（Prototype/Scriptaculous、Flash `.swf`、旧 `css/`、`Scripts/` 等）を一括撤去。
- 現存全HTMLの**内部参照リンク切れは0件**（最終確認 2026-06-15）。
- `oldfiles/` はアーカイブ。`.gitignore` 対象のため公開されず、サイト本体からも参照しない。
- 2026-09-25 にルート直下の未参照ファイルを整理: 賞状・業績紹介・講演チラシは bib / `awards.json` の該当エントリから `link`（受賞）/ `url`（講演）で参照、新聞・雑誌記事スキャン11点（著作権が掲載元にあるため）と未使用写真4点は `oldfiles/` へ移して非公開化、未使用の `test.js` は削除。これでルート直下・`papers/` とも未参照の公開ファイルは0件。
- bib の `@award` は `link` / `link_en` / `link_ja` で賞状等へのリンクを付けられる（`url` があれば併記される）。

---

## 9. 連絡先

`ito (at) i.kyoto-u.ac.jp`
