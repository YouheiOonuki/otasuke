// 救急情報シートの紙は、字が多くても下端で切らず、次の枚へ流す（yorozu-plans QUEUE 2026-11-19 朝 (2) の条件 31・Q-597）。
// 前は .sheet の height: 297mm と overflow: hidden で、4 欄 × 300 字の中身が紙の下端を 1,010px 超えて切れていた（print-measure の clippedBottom）。
// 紙の版（@media print）だけを替える。画面の見本は A4 1 枚の大きさのまま
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// @media print { … } の中身（入れ子の {} を数えて取り出す）
function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out.join('\n');
}
function rule(css, selector) {
  const i = css.indexOf(selector + ' {');
  assert.ok(i >= 0, selector + ' の規則が無い');
  return css.slice(i, css.indexOf('}', i));
}

test('救急情報シートの用紙だけが flow（服薬・血圧・QR・貼り紙は A4 1 枚に固定のまま）', () => {
  const js = read('reizoko/app.js');
  assert.match(js, /var out = sheet\(html, d, 'flow'\);/);
  assert.equal((js.match(/'flow'/g) || []).length, 1);
});

test('紙の版の .sheet.flow は、高さを固定せず切らない。枚が替わった先にも余白', () => {
  const p = printBlocks(read('style.css'));
  const r = rule(p, '.sheet.flow');
  assert.match(r, /height: auto/);
  assert.match(r, /min-height: 297mm/);
  assert.match(r, /overflow: visible/);
  assert.match(r, /(^|[^-])box-decoration-break: clone/);
});

test('紙の版の救急情報シート: 中身は箱の流れに乗り、欄の途中で枚を替えない', () => {
  const p = printBlocks(read('reizoko/reizoko.css'));
  assert.match(rule(p, '.sheet.flow > .pz'), /position: static/);
  assert.match(rule(p, '.kq tr, .kq-agree, .pz .foot'), /break-inside: avoid/);
});

// Q-695: 見本の値（何も入れない時）で 1 枚目の余りが約 10px（2.7mm）しかなく、端末の字の幅で見出しの折り返しが 1 つ増えると 2 枚目が出た。
// 1 行の欄を 9.2mm → 8.8mm にして余りを 8.7mm に（Noto Sans JP・Meiryo・Yu Gothic で同じ）。字の大きさと背の高い欄は変えない
test('救急情報シートの 1 行の欄は 8.8mm。字は 14pt、背の高い欄は 17mm のまま', () => {
  const css = read('reizoko/reizoko.css');
  const td = rule(css, '.kq td');
  assert.match(td, /height: 8\.8mm/);
  assert.match(td, /font-size: 14pt/);
  assert.match(rule(css, '.kq td.tall'), /height: 17mm/);
});
