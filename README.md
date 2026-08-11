# takayuki-ito.com — サイト構成と保守ドキュメント

伊藤孝行（京都大学 情報学研究科 教授）の個人ホームページのソース。
本ドキュメントは**現状の完全な記録**であり、保守の際の参照点とする。

最終更新: 2026-06-15

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
| 担当講義 | — | `lecture-j.html` |

### 研究概要（ResearchStatement、4年分・日英ペア完備）

| 年 | 英語 | 日本語 |
|----|------|--------|
| 2020 | `ResearchStatement2020.html` | `researchstatement-j2020.html` |
| 2018 | `ResearchStatement2018.html` | `researchstatement-j2018.html` |
| 2016 | `ResearchStatement2016.html` | `researchstatement-j2016.html` |
| 2009 | `ResearchStatement2009.html` | `research-j.html`（※2009 JAのみ旧URL名を維持） |

各ResearchStatementページの本文先頭に「← Home / 日本語(English)」の相互言語トグルを設置済み。

**命名規約**: EN = `ResearchStatementYYYY.html`、JA = `researchstatement-jYYYY.html`。
新しい年版を追加する場合もこの規約に従い、`index.html` / `index-j.html` の研究概要リンク（`.research-links` 内）に両言語分を追加すること。

---

## 3. ディレクトリ構成

```
/                       … 全HTMLページ、データファイル、ルート資産
  CNAME                 … 独自ドメイン設定
  robots.txt            … 全許可 + sitemap参照
  sitemap.xml           … 12 URL（モダン版のみ掲載、hreflang付き）
  favicon.svg, apple-touch-icon.png
  publications.bib      … BibTeX（News生成にも使用、`accepted={YYYY-MM-DD}` フィールド）
  news.json             … News手動エントリ（bibkeyでbibと重複排除）
  awards.json           … 受賞データ
  activity.json         … 学会活動データ（日英1本化、EN/JA両ページが参照）
  FIXES.md              … 保守・修正履歴
  README.md             … 本ドキュメント
  *.pdf (16)            … CV、受賞状、新聞掲載スキャン等
  *.jpg/.jpeg (15)      … プロフィール写真、受賞・メディア写真
common/js/
  news-merge.js         … News生成スクリプト（唯一の現役共通JS）
papers/  (64 PDF)       … 論文PDF
oldfiles/               … アーカイブ（過去の論文・画像。サイトからは原則未参照）
```

---

## 4. スタイル・技術規約

- 共通CSSファイルは持たず、各HTMLにインライン `<style>`。
- CSS変数: `--primary:#0f2044`（濃紺）、`--accent:#2563eb`（青）、`--text:#1f2937`。
- フォント: Inter + Noto Sans JP（Google Fonts）。
- レスポンシブ: 680px ブレークポイント。
- フレームワーク・jQuery・ビルドツールはすべて不使用（レガシー資産は2026-06-15に撤去済み）。

---

## 5. データ駆動コンテンツ（重要：更新方法）

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

### 論文の更新
`publications.bib` を編集。PDFは `papers/` に置き、bib の `url={papers/xxx.pdf}` で参照。

---

## 6. SEO

- 各モダンページに meta description / canonical / hreflang(en/ja/x-default) / OG / Twitter Card を完備。
- **トップの canonical はサイトルート** `https://takayuki-ito.com/`（`index.html` 自身）。これに合わせて `index.html`・`index-j.html` の hreflang(en/x-default)・og:url、および `sitemap.xml` の該当 `<loc>`/hreflang もルートURLに統一済み。
- `sitemap.xml` 掲載は**モダン版12ページのみ**。activity は2026-07-27のモダン化に伴い掲載に変更。
  ResearchStatement・lecture は意図的に非掲載（インデックス方針）。
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
- `oldfiles/` はアーカイブ。サイト本体からは原則参照していない。

---

## 9. 連絡先

`ito (at) i.kyoto-u.ac.jp`
