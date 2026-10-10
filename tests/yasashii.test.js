// やさしい日本語（yasashii/。yorozu-plans K147）: ふりがなの表示と、ページの決まり（保存しない・送る先は yorozu-ai だけ・D117 の文）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ruby = require('../yasashii/ruby.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('ふりがな: 直前の漢字の並びにだけ <ruby>。カタカナの後ろの《》は捨てる。HTML は逃がす', () => {
  assert.equal(Ruby.toHtml('年金《ねんきん》を払《はら》う', true), '<ruby>年金<rt>ねんきん</rt></ruby>を<ruby>払<rt>はら</rt></ruby>う');
  assert.equal(Ruby.toHtml('マイナンバーカード《カード》です', true), 'マイナンバーカードです');
  assert.equal(Ruby.toHtml('お金《かね》', true), 'お<ruby>金<rt>かね</rt></ruby>');
  assert.equal(Ruby.toHtml('年金《ねんきん》', false), '年金');
  assert.equal(Ruby.toHtml('<b>年《とし》</b>', true), '&lt;b&gt;<ruby>年<rt>とし</rt></ruby>&lt;/b&gt;');
  assert.equal(Ruby.plain('前納《ぜんのう》（＝先《さき》に払《はら》うこと）'), '前納（＝先に払うこと）');
});

test('ページ: 送り先は yorozu-ai の 1 つだけ・保存しない（localStorage を使わない）・D117 の文・2,000 字', () => {
  const app = read('yasashii/app.js').replace(/^\s*\/\/.*$/gm, ''); // 行頭の注釈の語は数えない（URL の // は残す）
  const urls = app.match(/https:\/\/[^'"\s]+/g) || [];
  assert.deepEqual(urls, ['https://yorozu-ai.oonuki-youhei.workers.dev/v1/yasashii']);
  assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/);
  const html = read('yasashii/index.html');
  assert.ok(html.includes('AI による言い換えです。原文と意味が違うことがあります。手続きや期限は原文で確かめてください。'));
  assert.ok(html.includes('maxlength="2000"'));
});
