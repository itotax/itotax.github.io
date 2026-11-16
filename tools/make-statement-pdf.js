#!/usr/bin/env node
// 研究概要ページから印刷用 PDF を作る（Playwright + Chromium が必要）。
//   node tools/make-statement-pdf.js ResearchStatement2026.html researchstatement-j2026.html
//   （引数なしなら研究概要の全10ページ）
// 出力は同名の .pdf。ページの @media print（ナビ・PDFリンクを隠す）で組版し、
// 日本語は Noto Sans JP（Google Fonts）で埋め込む。本文を直したら作り直すこと。
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const ALL = ['ResearchStatement2026.html', 'researchstatement-j2026.html', 'ResearchStatement2020.html', 'researchstatement-j2020.html',
    'ResearchStatement2018.html', 'researchstatement-j2018.html', 'ResearchStatement2016.html', 'researchstatement-j2016.html',
    'ResearchStatement2009.html', 'research-j.html'];
  const files = process.argv.length > 2 ? process.argv.slice(2) : ALL;
  const browser = await chromium.launch();
  for (const file of files) {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(ROOT, file), { waitUntil: 'networkidle' });
    await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=block' });
    await page.addStyleTag({ content: "body,.rs-wrap{font-family:'Inter','Noto Sans JP',sans-serif !important;}" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const title = await page.title();
    // 2009 年の日本語版だけ HTML が旧名（research-j.html）なので、PDF は命名規約どおりの名前にする
    const out = file === 'research-j.html' ? 'researchstatement-j2009.pdf' : file.replace(/\.html$/, '.pdf');
    await page.pdf({
      path: path.join(ROOT, out), format: 'A4', printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 20mm;display:flex;justify-content:space-between;font-family:sans-serif">`
        + `<span>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    console.log('wrote', out);
    await page.close();
  }
  await browser.close();
})();
