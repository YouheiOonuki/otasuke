// 下へ送れない全画面のページは、自分の <body> の data-fullscreen で名乗る（yorozu-plans QUEUE 2026-11-19 朝の条件 28・Q-563）。
// root の build-near.mjs は、この印のあるページに「近い道具」の欄を差し込まない（Q-564）。
// FULLSCREEN は、全ページの <body> の終わりへ scrollIntoView で送って見えなかったページ（390・1,280 幅、2026-11-19 に測った。24 ページ中 1）。
// 全画面のページを足す・やめるときは、測り直してここと <body> の両方を直す
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FULLSCREEN = ['tokei/index.html'];

function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const bodyTag = (html) => (html.match(/<body\b[^>]*>/) || [''])[0];

test('data-fullscreen の在るページ ＝ 終わりへ送っても見えないページ', () => {
  const marked = htmlFiles(ROOT)
    .filter((f) => /\sdata-fullscreen(?=[\s>])/.test(bodyTag(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .sort();
  assert.deepStrictEqual(marked, FULLSCREEN);
});

test('印は値を持たない（data-fullscreen だけ）', () => {
  for (const f of FULLSCREEN) {
    assert.match(bodyTag(fs.readFileSync(path.join(ROOT, f), 'utf8')), /\sdata-fullscreen>$|\sdata-fullscreen\s/);
  }
});
