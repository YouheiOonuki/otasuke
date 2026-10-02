// 脳トレの本（K127）の原稿 PDF を作る。Playwright（Chromium）で notore/book.html を開き、ページの大きさのまま PDF に保存する。
// 保存の前に「はみ出し」（枠より中身が大きいページ）を調べ、保存の後に PDF のページ数と各ページの大きさを KDP の値と照らす。
//
//   node tools/notore/book-pdf.mjs --seed 12345-67890 [--bleed] [--title "題名"] [--out book.pdf] [--shots dir --pages 1,2,3,5]
//
// Playwright はこのリポジトリの依存に入れていない（公開物に入らない道具）。グローバルに入れたものを NODE_PATH で読む:
//   NODE_PATH=$(npm root -g) node tools/notore/book-pdf.mjs ...
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const V = require(path.join(ROOT, 'notore/book-values.js'));
const { pdfInfo, setMediaBox } = require(path.join(ROOT, 'tools/notore/pdf-info.cjs'));

function args(argv) {
  const o = { seed: '1', bleed: false, title: '', out: '', shots: '', pages: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bleed') o.bleed = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  return o;
}

export async function makeBookPdf(o) {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { throw new Error('playwright が読めません。NODE_PATH=$(npm root -g) を付けて走らせてください'); }
  const url = pathToFileURL(path.join(ROOT, 'notore/book.html')).href + '?seed=' + encodeURIComponent(o.seed) + (o.bleed ? '&bleed=1' : '') + (o.title ? '&title=' + encodeURIComponent(o.title) : '');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // 外へは出ない（Cloudflare のビーコンなど）。ファイルだけ読む
    await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(url);
    await page.waitForSelector('html[data-book-ready]');
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    // はみ出し: ページの中の枠（.bk-in・答えの 1 日分）より中身が大きいもの
    const over = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('.bk-page').forEach((p) => {
        const pr = p.getBoundingClientRect();
        p.querySelectorAll('.bk-in, .bk-ablock, .bk-body').forEach((b) => {
          if (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1) bad.push(p.dataset.page + ':' + b.className + ' ' + b.scrollWidth + 'x' + b.scrollHeight + ' > ' + b.clientWidth + 'x' + b.clientHeight);
        });
        const inr = p.querySelector('.bk-in').getBoundingClientRect();
        const out = [...p.querySelectorAll('.bk-in *')].find((e) => {
          const r = e.getBoundingClientRect();
          return r.width && (r.right > inr.right + 1 || r.bottom > inr.bottom + 1 || r.left < inr.left - 1);
        });
        if (out) bad.push(p.dataset.page + ':' + out.tagName + '.' + (out.getAttribute('class') || '') + ' が枠の外');
        if (Math.abs(pr.height - p.offsetHeight) > 1) bad.push(p.dataset.page + ': 高さ');
      });
      return bad;
    });
    const out = o.out || path.join(process.cwd(), 'notore-book-' + o.seed.replace(/\D/g, '') + (o.bleed ? '-bleed' : '') + '.pdf');
    // 大きさは CSS の @page に任せず、値ファイルのインチをそのまま渡す（@page はピクセルに丸められて 0.5pt ほどずれるため）
    const size = V.pageSizeIn(o.bleed);
    // KDP の提出ガイドラインの「よくある問題」（ブックマーク・注釈・メタデータ）に当たらないよう、題名を空にし、しおりと構造タグを付けない
    await page.evaluate(() => { document.title = ''; });
    await page.pdf({ path: out, width: size.w + 'in', height: size.h + 'in', margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true, preferCSSPageSize: false, tagged: false, outline: false });
    // Chromium は大きさを 1/75 インチ刻みに切り上げるので、MediaBox を判型ちょうどに直す
    fs.writeFileSync(out, setMediaBox(fs.readFileSync(out), size.w * 72, size.h * 72));
    const pages = Number(await page.getAttribute('html', 'data-book-ready'));
    // 見本の画像（画面の見本ではなく、印刷と同じ大きさのページを 1 枚ずつ）
    const shots = [];
    if (o.shots) {
      fs.mkdirSync(o.shots, { recursive: true });
      await page.emulateMedia({ media: 'print' });
      for (const n of String(o.pages || '1,2,3,5,6,7,8,105,106').split(',').map(Number)) {
        const el = await page.$('.bk-page[data-page="' + n + '"]');
        if (!el) continue;
        const f = path.join(o.shots, 'book-p' + String(n).padStart(3, '0') + (o.bleed ? '-bleed' : '') + '.png');
        await el.screenshot({ path: f });
        shots.push(f);
      }
    }
    const info = pdfInfo(fs.readFileSync(out));
    return { out, pages, over, info, shots };
  } finally {
    await browser.close();
  }
}

export const FONT_OK = /^(BIZUD|NotoSans(CJK)?JP|NotoSerif(CJK)?JP|IPA)/;

/** PDF の大きさとページ数を KDP の値と照らす。合わなければ理由の配列 */
export function checkPdf(info, bleed, expectedPages) {
  const errs = [];
  const s = V.pageSizeIn(bleed);
  const want = [s.w * 72, s.h * 72];
  if (info.pages !== expectedPages) errs.push('ページ数 ' + info.pages + '（期待 ' + expectedPages + '）');
  if (info.pages < V.PAGES.min || info.pages > V.PAGES.max) errs.push('ページ数が KDP の範囲 ' + V.PAGES.min + '〜' + V.PAGES.max + ' の外');
  info.boxes.forEach((b, i) => {
    const w = b[2] - b[0], h = b[3] - b[1];
    if (Math.abs(w - want[0]) > 0.01 || Math.abs(h - want[1]) > 0.01) errs.push((i + 1) + ' ページめの大きさ ' + w.toFixed(2) + '×' + h.toFixed(2) + 'pt（期待 ' + want[0].toFixed(2) + '×' + want[1].toFixed(2) + '）');
  });
  if (!info.fonts.length) errs.push('埋め込みフォントが見つからない');
  // 埋め込みが許されている書体だけ（BIZ UD・Noto・IPA）。ほかの書体（中国語の字形の代わりの書体など）が混ざったら止める
  for (const f of info.fonts) if (!FONT_OK.test(f.replace(/^[A-Z]{6}\+/, ''))) errs.push('想定外の書体: ' + f);
  return errs;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = args(process.argv.slice(2));
  const r = await makeBookPdf(o);
  const errs = checkPdf(r.info, o.bleed, r.pages).concat(r.over);
  console.log(JSON.stringify({ out: r.out, pages: r.info.pages, size: r.info.boxes[0], fonts: r.info.fonts, shots: r.shots }, null, 1));
  if (errs.length) { console.error('合わないところ:\n' + errs.join('\n')); process.exit(1); }
  console.log('OK: 大きさ・ページ数・はみ出しなし');
}
