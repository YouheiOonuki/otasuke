// 脳トレの本の PDF（tools/notore/book-pdf.mjs）を実際に作り、ページ数と各ページの大きさ（裁ち落としあり・なし）、
// はみ出し、埋め込みフォントを確かめる。Playwright（Chromium）が無い環境（GitHub Actions）では飛ばす。
//   NODE_PATH=$(npm root -g) node --test tests/book-pdf.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const V = require('../notore/book-values.js');

let hasPw = true;
try { require.resolve('playwright'); } catch (e) { hasPw = false; }

for (const bleed of [false, true]) {
  test('PDF（' + (bleed ? '裁ち落としあり' : '裁ち落としなし') + '）: 154 ページ、判型の大きさ、はみ出しなし、フォントは埋め込み', { skip: hasPw ? false : 'playwright が無い', timeout: 240000 }, async () => {
    const mod = await import(pathToFileURL(path.join(__dirname, '../tools/notore/book-pdf.mjs')).href);
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notore-book-')), 'book.pdf');
    const r = await mod.makeBookPdf({ seed: '12345-67890', bleed, out });
    assert.deepEqual(r.over, [], 'はみ出し');
    assert.deepEqual(mod.checkPdf(r.info, bleed, 154), []);
    const s = V.pageSizeIn(bleed);
    for (const b of r.info.boxes) {
      assert.ok(Math.abs((b[2] - b[0]) / 72 - s.w) < 0.0002 && Math.abs((b[3] - b[1]) / 72 - s.h) < 0.0002, JSON.stringify(b));
    }
    assert.equal(r.info.pages, 154);
    // 裁ち落としありは、なしより幅 0.125・高さ 0.25 インチ大きい
    if (bleed) {
      const b = r.info.boxes[0];
      assert.ok(Math.abs((b[2] - b[0]) / 72 - V.TRIM.widthIn - 0.125) < 0.0002);
      assert.ok(Math.abs((b[3] - b[1]) / 72 - V.TRIM.heightIn - 0.25) < 0.0002);
    }
  });
}
