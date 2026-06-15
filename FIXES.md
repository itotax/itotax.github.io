# 壊れたリンク修正記録

---

## 追記: 2026-06-15 レガシー退役・死んだ参照除去・研究概要パリティ

### 1. レガシークラスタの完全削除（孤立 noindex ページ）
モダンサイトからリンクされていない（互いに参照し合うのみ）ことを確認のうえ削除:
`menu.html` / `menu-j.html` / `selfintro.html` / `selfintro-j.html` / `selfintro-j-modern.html` / `selfintro-c.html` / `top-j.html`

→ 2026-06-06 時点で「未対応」としていた残り35件の壊れリンクは、その大半がこれらのページ上にあったため一括解消。

### 2. 孤立レガシーアセットの削除
削除ページ専用だった資産（現存HTMLからの参照ゼロを確認）を削除:
`javascript/`（prototype.js, effects.js, lightwindow.js）/ `Scripts/` / `css/default.css` / `css/lightwindow.css` / `common/swf/`（Flash 一式）/ `common/js/beautifulJapanese.js`

### 3. 現役ページの死んだ外部参照を除去
- `activity.html`: 動かない `code.jquery.com/jquery-latest.js`（タイポ `tupe`）と空コメントを除去（jQuery 未使用）
- `research-j.html`: 廃止された `google-analytics.com/urchin.js` 旧トラッカーを除去（GA4 へ一本化済み）
- `lecture-j.html`: Flash フォント置換スクリプト（`replaceFonts` / `*.swf`）を除去、旧 JAIST/nitech メールを現行 `ito (at) i.kyoto-u.ac.jp` に更新

### 4. ResearchStatement 日英パリティの確立
命名規約を統一（EN=`ResearchStatementYYYY.html` / JA=`researchstatement-jYYYY.html`、2009 JA のみ既存 URL `research-j.html` を維持）。
- `ResearchStatement2020.html`（中身は日本語だった）→ `researchstatement-j2020.html` にリネーム
- 不足版を翻訳して新規作成: `ResearchStatement2020.html`(EN) / `ResearchStatement2018.html`(EN) / `researchstatement-j2016.html`(JA)
- 全4年分（2009/2016/2018/2020）で日英ペアが揃い、各ページに相互の言語トグル + ホームリンクを設置
- `researchstatement-j2018.html` の `<title>` 誤り（"Research Statement 2016"）を修正
- `index.html`(EN) の研究概要リンクに 2020/2018 を追加、`index-j.html`(JA) は 2020/2016 を日本語版へ向け直し

### 5. SEO 整合
`index.html` の canonical をルート `https://takayuki-ito.com/` に変更したのに合わせ、index 双方の hreflang(en/x-default) と og:url、`sitemap.xml` の該当 `<loc>`/hreflang もルート URL に統一。

→ 結果: 全現存 HTML の内部参照リンク切れ **0 件**。

---

調査日: 2026-06-06
対象: `publications.bib` および全 HTML ファイルの参照リンク

## 修正結果サマリ

- BIB の壊れた `url=` 参照: **4 → 0** (✅ 完全解消)
- HTML の壊れた参照: **46 → 35** (11 件解消)
- 残り 35 件はファイル/フォルダが完全紛失で復元不可能、かつ全て noindex なレガシーページ上のみ

## 調査方法

```bash
# bib の url={...} フィールド抽出 → ファイル存在確認
# HTML の href="..." / src="..." 抽出 → ファイル存在確認
```

## 修正方針

| 状態 | 対応 |
|---|---|
| ファイルが `oldfiles/` にある（移動時に誤判定） | `papers/` に復元 + 参照名のタイポを修正 |
| ファイルが完全に存在しない（紛失/未デジタル化） | `url={}` フィールド削除、または `<a>` タグを外して本文化 |
| パスのタイポ | パスを修正 |
| 削除済みフォルダ参照 | リンクのみ削除（本文は残す） |
| noindex なレガシーページの壊れリンク | 上記基準に従う（noindex でも訪問者には影響するので fix） |

## カテゴリ別修正一覧

### A. oldfiles から `papers/` に復元（3件）

| 参照（selfintro 系HTMLにあるタイポ） | 実ファイル名 | 復元元 |
|---|---|---|
| `papers/itota-ECRA1.pdf` | `itota-ECRA.pdf` | oldfiles/papers/ |
| `papers/fujita-ITSSA2009.pdf` | `fujita-ITSSA2008.pdf` | oldfiles/papers/ |
| `papers/fukuta-JSSST2008.pdf` | `fukuta-jssst2008.pdf` | oldfiles/papers/ |

調査の結果、これら3つのタイポは publications.bib にはなく、selfintro 系 HTML のみ。

**操作**:
1. 3ファイルを `oldfiles/papers/` → `papers/` に `mv` ✅
2. `selfintro.html`, `selfintro-j.html`, `selfintro-j-modern.html` の `href="..."` を実ファイル名に修正 → C で実施

### B. bib の壊れた賞画像参照を `url=` フィールドから除去（4件）

これらの画像ファイルは `oldfiles/` にも存在せず、復元不可能。bib エントリ自体は意味があるので残し、画像へのリンクのみ削除：

| BibTeX key（推定） | 削除する url 値 | 賞名 |
|---|---|---|
| `award2004_*` 等 | `65thIPSJaward.jpg` | 第66回情報処理学会全国大会奨励賞 |
| `award2004_*` 等 | `CertificateAwardIEAAIE2004s.jpg` | IEA/AIE-2004 最優秀論文賞ノミネート |
| `award2005_*` 等 | `JSSSTAward.jpg` | 平成17年度ソフトウェア科学会論文賞 |
| `award2001_*` 等 | `RoboFestaMedal1.jpg` | RoboFesta 2001 銀メダル |

**操作**: 各エントリの `url = {...}` と `bdsk-url-1 = {...}` の2行を削除（賞のタイトル/年は保持）。

### C. selfintro 系 HTML のタイポ・古参照修正

| 元の参照 | 修正後 | 理由 |
|---|---|---|
| `ResearchStatement.html` (selfintro.html) | `ResearchStatement2009.html` | index.html と同じ fix |
| `CVltd.pdf` (selfintro-c.html) | `CV.pdf` | 旧版CV→現行版へ |
| `paper/itota-ipsj-journal98.pdf` | `papers/itota-ipsj-journal98.pdf` | "papers" のタイポ |
| `papers/itota-ECRA1.pdf` | `papers/itota-ECRA.pdf` | A. の修正に対応 |
| `papers/fujita-ITSSA2009.pdf` | `papers/fujita-ITSSA2008.pdf` | A. の修正に対応 |
| `papers/fukuta-JSSST2008.pdf` | `papers/fukuta-jssst2008.pdf` | A. の修正に対応 |

### D. lecture-j.html の削除済みフォルダ参照

| 元の参照 | 修正後 |
|---|---|
| `<a href="Lecture/IntelligentAlgorithm2014/index.html">講義日程</a>` | `<a>` タグを外し、テキスト「（講義日程）」のみ表示（または削除） |

## 修正しないもの（残存する壊れリンク）

以下は **ファイル/フォルダが完全に存在せず、復元不可能** なため、修正のコストが大きい割に表示先がレガシー (noindex) ページ中心。将来 selfintro 系を完全退役する際に一括対応推奨：

### 完全紛失のため未対応のもの

**画像** (selfintro 系で参照):
- `RoboFestaMedal2.jpg`, `RoboFestaMedal2.JPG`
- `RoboCup2001-plaque.gif`, `RoboCup2001-trophy.gif`
- `nikkan.jpg`, `nikkan0410.gif`, `nikkei.gif`

**論文 PDF** (selfintro 系で参照、紛失):
- `papers/itota-icmas00-poster.pdf`
- `papers/itota-ipsj2001.pdf`, `papers/itota-ipsj98.pdf`
- `papers/itota-jsai99.pdf`, `papers/itota-macc99.pdf`
- `papers/itota-pais2001.pdf`, `papers/itota-pricai2000.pdf`
- `papers/itota-si2001.pdf`, `papers/itota-si2002.pdf`
- `papers/itota-sigkbs55.pdf`, `papers/itota-snpd01.pdf`, `papers/itota-www2002.pdf`
- `papers/jsai-survay2001.pdf`
- `papers/matsuo-ieice1.pdf`, `papers/tora-icmas00-poster.pdf`

**削除済みフォルダ**:
- `top-j.html` の `chirashi.pdf`, `seedschirashi.pdf` (top-j.html は noindex)
- `menu.html`, `menu-j.html` の `./maps/map.html`, `simpleviewer/index.html` (menu* は noindex)
- `selfintro.html` の `Lecture/ComputerArchitecture2004.html`
- `selfintro-j*.html` の `papers/ijcai_ohp/IJCAI.html`, `ijcai_ohp/IJCAI.html`

### 偽陽性（壊れていない）

- `${e.link}`, `${e.url}` — `news-merge.js` の JS テンプレートリテラル、実害なし
- `%28EmptyReference%21%29` — BibTeX の空 URL フィールドが URL エンコードされたもの、対応済み（A. 〜 C. でカバー）
