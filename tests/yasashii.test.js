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

const YFlow = require('../yasashii/flow.js');

test('写真（K163）: 送る前に長辺 1,600px に縮める。小さい写真はそのまま', () => {
  assert.deepEqual(YFlow.fitSize(4032, 3024), { w: 1600, h: 1200 });
  assert.deepEqual(YFlow.fitSize(3024, 4032), { w: 1200, h: 1600 });
  assert.deepEqual(YFlow.fitSize(1200, 900), { w: 1200, h: 900 });
});

test('写真（K163）: 読み取った原文を欄に入れる。直した文で「言い換える」を押せば、その文で言い換え直す（文のときは欄を書き換えない）', () => {
  const photo = YFlow.fromResult({ ok: true, source: '令和∞年度の納付書', output: '令和《れいわ》∞年度《ねんど》', long: [], added: [], missingNumbers: [] }, '');
  assert.equal(photo.textarea, '令和∞年度の納付書', '読み取った原文が欄に入る（読み違いを人が直せる）');
  assert.equal(photo.last.source, '令和∞年度の納付書');
  // 直した文で押すと、文の言い換えとして送られ、結果の原文は直した文になる
  const fixed = YFlow.fromResult({ ok: true, output: '令和《れいわ》8年度《ねんど》' }, '令和8年度の納付書');
  assert.equal(fixed.textarea, null, '文のときは欄を書き換えない');
  assert.equal(fixed.last.source, '令和8年度の納付書');
  assert.deepEqual(fixed.last.tr, {}, '訳は結果ごとに覚え直す');
  const app = read('yasashii/app.js');
  assert.match(app, /post\('', \{ text: src \}/, '「言い換える」は欄の文を /v1/yasashii に送る');
  assert.match(app, /post\('\/photo', \{ image: c\.toDataURL\('image\/jpeg', 0\.85\) \}/, '写真は縮めた JPEG を /photo に');
});

test('多言語（K164）: 4 言語と「やさしい日本語のまま」。ページの選択肢と同じ', () => {
  assert.deepEqual(YFlow.LANGS.map((l) => l.code), ['', 'en', 'zh', 'vi', 'pt']);
  const html = read('yasashii/index.html');
  for (const l of YFlow.LANGS) assert.ok(html.includes(`name="lang" value="${l.code}"`), l.code);
  assert.ok(html.includes('保存はしません（写真も保存しません）'));
  assert.match(html, /<section class="card opt" lang="en" id="en">/);
});

test('読み上げ（K165）: 押すと用意 → 届けば再生 → 再生中に押すと止める → 終われば元に戻る。用意中に押してもやめられる', () => {
  let s = YFlow.speakStep('idle', 'press');
  assert.deepEqual(s, { state: 'loading', action: 'fetch' });
  s = YFlow.speakStep(s.state, 'ready');
  assert.deepEqual(s, { state: 'playing', action: 'play' });
  assert.deepEqual(YFlow.speakStep('playing', 'press'), { state: 'idle', action: 'stop' }, '再生中に押すと止める');
  assert.deepEqual(YFlow.speakStep('playing', 'ended'), { state: 'idle', action: null });
  assert.deepEqual(YFlow.speakStep('loading', 'press'), { state: 'idle', action: 'stop' }, '用意中に押すとやめる');
  assert.deepEqual(YFlow.speakStep('idle', 'ready'), { state: 'idle', action: null }, 'やめた後に音が届いても鳴らさない');
  assert.deepEqual(YFlow.speakStep('loading', 'error'), { state: 'idle', action: null });
  assert.equal(YFlow.SPEAK_LABEL.playing, '■ 止める');
  assert.deepEqual(Object.keys(YFlow.SPEAK), ['ja', 'en', 'zh'], '読めるのは日本語・英語・中国語だけ（ベトナム語・ポルトガル語はボタンを出さない）');
  assert.deepEqual(YFlow.RATE, { normal: 1, slow: 0.8 });
});

test('読み上げ（K165）: 画面のつなぎ（/speak に送る・音はメモリだけで終われば捨てる・言語を変えたら止める）', () => {
  const app = read('yasashii/app.js');
  assert.match(app, /fetch\(API \+ '\/speak'/);
  assert.match(app, /URL\.revokeObjectURL\(audioUrl\)/);
  assert.match(app, /addEventListener\('ended', function \(\) \{ dropAudio\(\); speakDo\('ended'\); \}\)/);
  assert.match(app, /r\.addEventListener\('change', function \(\) \{ stopSpeak\(\); showLang\(\); \}\)/);
  const html = read('yasashii/index.html');
  assert.ok(html.includes('id="speak"') && html.includes('name="rate" value="slow"'));
});
test('AI の枠切れ（D298）: サーバーの文（error quota の message）をそのまま出す。文を画面に写さない', () => {
  const js = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'yasashii', 'app.js'), 'utf8');
  assert.match(js, /j\.error === 'quota' && j\.message/);
  assert.equal((js.match(/[(=] ?errText\(j\)/g) || []).length, 2, '言い換え・写真・訳（post）と読み上げの 2 か所で使う');
  assert.doesNotMatch(js, /枠を使い切りました/);
});
