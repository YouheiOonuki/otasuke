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

// Q-709: 4 欄 300 字で、最後の枚が「下の注意と作成元だけ」になっていた（break-before／break-after: avoid は Chromium の紙で効かない。Q-695）。
// 表の最後の行（救急隊に伝えたいこと）を、同じ列の幅の 1 行だけの表にして、署名の文・下の注意と 1 つの箱に入れ、箱の途中で枚を替えない。
// これで最後の枚には必ず表の行が 1 つ在る。線は、画面では上の表の下の線を消して 1 本、紙では 1 px 重ねて 1 本（箱が次の枚へ行っても両方の枚に線が出る）
test('救急情報シート: 表の最後の行・署名の文・下の注意は 1 つの箱（div.kq-last）で、列の幅は上の表と同じ', () => {
  const js = read('reizoko/app.js');
  const cols = '<colgroup><col style="width:46mm"><col></colgroup>';
  const i = js.indexOf('<div class="kq-last">');
  assert.ok(i >= 0, 'div.kq-last が無い');
  assert.equal((js.match(/<table class="kq">/g) || []).length, 2);
  assert.equal(js.split(cols).length - 1, 2, '2 つの表が同じ colgroup を持つ');
  const box = js.slice(i, js.indexOf("'</div></div>'", i));
  assert.match(box, /^<div class="kq-last"><table class="kq"><colgroup>/);
  assert.match(box, /row\('救急隊に伝えたいこと', k\.message, 'tall'\)/);
  assert.match(box, /class="kq-agree"/);
  assert.match(box, /class="foot"/);
  assert.equal((box.match(/row\(/g) || []).length, 1, '箱の表は 1 行だけ');
  assert.equal((js.match(/row\('救急隊に伝えたいこと'/g) || []).length, 1);
});

test('紙の版: 最後の箱は途中で枚を替えず、上の表と線を 1 px 重ねる。画面では上の表の下の線を消す', () => {
  const css = read('reizoko/reizoko.css');
  const p = printBlocks(css);
  assert.match(rule(p, '.kq-last'), /break-inside: avoid/);
  assert.match(p, /\.kq-last \{ margin-top: -1px; \}/);
  assert.match(css, /@media screen \{\s*\.pz > \.kq tr:last-child > \* \{ border-bottom: 0; \}/);
  assert.match(rule(css, '\n.kq-last'), /display: flex; flex-direction: column/);
});
