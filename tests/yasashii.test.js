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
  assert.match(html, /<details class="card opt" lang="en" id="en">/, "英語の段落は折りたたみ（段 3。画面の文を置かない）");
});

test('読み上げ（K165、D515）: 押すと読む → 読んでいる間に押すと止める → 読み終えれば元に戻る', () => {
  assert.deepEqual(YFlow.speakStep('idle', 'press'), { state: 'playing', action: 'play' });
  assert.deepEqual(YFlow.speakStep('playing', 'press'), { state: 'idle', action: 'stop' }, '読んでいる間に押すと止める');
  assert.deepEqual(YFlow.speakStep('playing', 'ended'), { state: 'idle', action: null });
  assert.deepEqual(YFlow.speakStep('playing', 'error'), { state: 'idle', action: null });
  assert.deepEqual(YFlow.SPEAK_LABEL, { idle: '🔊 読んでもらう', playing: '■ 止める' });
  assert.deepEqual(Object.keys(YFlow.SPEAK), ['ja', 'en', 'zh', 'vi', 'pt'], '5 言語とも、端末に声があれば読む');
  assert.deepEqual(YFlow.RATE, { normal: 1, slow: 0.75 });
});

test('読み上げ（K165、D515）: 声は言語で選ぶ。端末の中の声だけ（ネットの声は文を外に送るので使わない）。合うタグが先。無ければ null（ボタンを出さない）', () => {
  const v = (lang, localService = true, name = lang) => ({ lang, localService, name });
  const voices = [v('en-GB'), v('en-US', false), v('ja_JP', false, 'net'), v('ja-JP', true, 'local'), v('zh-TW'), v('pt-PT'), v('pt-BR')];
  assert.equal(YFlow.pickVoice(voices, 'ja').name, 'local', 'ja-JP の端末の中の声が先（ja_JP の書き方も ja として見る）');
  assert.equal(YFlow.pickVoice(voices, 'en').name, 'en-GB', 'en-US はネットの声なので使わず、端末の中の en-GB');
  assert.equal(YFlow.pickVoice([v('ja-JP', false)], 'ja'), null, 'ネットの声しか無い → 出さない');
  assert.equal(YFlow.pickVoice(voices, 'zh').name, 'zh-TW', 'zh-CN が無ければほかの zh');
  assert.equal(YFlow.pickVoice(voices, 'pt').name, 'pt-BR');
  assert.equal(YFlow.pickVoice(voices, 'vi'), null, 'ベトナム語の声が無い → 出さない');
  assert.equal(YFlow.pickVoice([], 'ja'), null);
  assert.equal(YFlow.pickVoice([v('jam')], 'ja'), null, '前の 2 字が同じだけの別の言語は数えない');
});

test('読み上げ（K165、D515）: 読む文。ふりがなを外し、1 字の漢字の言葉だけ読みに置き換える。数字・日付はかなに直さない', () => {
  assert.equal(YFlow.speechText('納付《のうふ》の期限《きげん》は10月《がつ》13日《にち》です。'), '納付の期限は10月13日です。', '数字の後ろの 1 字は置き換えない');
  assert.equal(YFlow.speechText('月《つき》が変《か》わる。12か月《げつ》の間《あいだ》。'), 'つきがかわる。12かげつのあいだ。', '「か月《げつ》」の月は前がかななので置き換わる（正しい読み）');
  assert.equal(YFlow.speechText('医療費《いりょうひ》は30万《まん》円《えん》でした。'), '医療費は30万えんでした。');
  assert.equal(YFlow.speechText('令和《れいわ》8年《ねん》4月《がつ》1日《ついたち》から'), '令和8年4月1日から', 'かなに直す手当て（toSpeech）は持ち越さない');
  assert.equal(YFlow.speechText('前納《ぜんのう》（＝先《さき》に払《はら》うこと）'), '前納（＝さきにはらうこと）');
  assert.equal(YFlow.speechText('前《まえ》に人《ひと》がいます。'), 'まえにひとがいます。');
  assert.equal(YFlow.speechText('金《きん》額《がく》'), '金がく', '後ろに漢字が続く 1 字は置き換えない（前の版の toSpeech と同じ決まり）');
  assert.equal(YFlow.speechText('マイナンバーカード《カード》'), 'マイナンバーカード');
  assert.deepEqual(YFlow.speechParts('今日《きょう》は晴《は》れ。明日《あした》は雨《あめ》！\n3.7 million yen. It is due. 你好。'),
    ['今日ははれ。', '明日はあめ！', '3.7 million yen.', 'It is due.', '你好。'], '行と文の終わりで区切る。3.7 の点では切らない');
});

test('読み上げ（K165、D515）: 訳文に残した日本語の括弧は読まない（企画書 81 の 6 章）。やさしい日本語の括弧は読む', () => {
  assert.equal(YFlow.stripJaParens('It varies by age (年齢), from April (4月), 3.7 million yen (約370万円).'), 'It varies by age, from April, 3.7 million yen.');
  assert.equal(YFlow.stripJaParens('年龄（年齢）和收入'), '年龄和收入');
  assert.equal(YFlow.stripJaParens('Pay by June 30 (see page 2).'), 'Pay by June 30 (see page 2).', 'かなも漢字も無い括弧は残す');
  assert.deepEqual(YFlow.speechParts('It varies by age (年齢). Pay it.', 'en'), ['It varies by age.', 'Pay it.']);
  assert.deepEqual(YFlow.speechParts('前納《ぜんのう》（＝先《さき》に払《はら》うこと）', 'ja'), ['前納（＝さきにはらうこと）'], 'やさしい日本語の説明の括弧は外さない');
  assert.match(read('yasashii/app.js'), /speechParts\(t\.text, t\.lang\)/);
});

test('読み上げ（K165、D515）: 画面のつなぎ（端末の speechSynthesis で読む・サーバーに送らない・声の一覧は後からも見る・言語を変えたら止める）', () => {
  const app = read('yasashii/app.js');
  const code = app.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\/speak'|new Audio|audioUrl/, '読み上げで外に送らない・音のファイルを作らない');
  assert.match(code, /new window\.SpeechSynthesisUtterance\(text\)/);
  assert.match(code, /addEventListener\('voiceschanged', loadVoices\)/, 'Chrome は声の一覧が後から届く');
  assert.match(code, /if \(!last \|\| !voiceFor\('ja'\)\) return null;/, '日本語の声が無ければ、どの言語でも出さない');
  assert.match(code, /return hit && voiceFor\(lang\) \?/, 'その言語の声が無ければ出さない');
  assert.match(code, /r\.addEventListener\('change', function \(\) \{ stopSpeak\(\); showLang\(\); \}\)/);
  const html = read('yasashii/index.html');
  assert.ok(html.includes('id="speak"') && html.includes('name="rate" value="slow"'));
  assert.ok(html.includes('読む文は端末の外に出ません'));
});
test('AI の枠切れ（D298）: サーバーの文（error quota の message）をそのまま出す。文を画面に写さない', () => {
  const js = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'yasashii', 'app.js'), 'utf8');
  assert.match(js, /j\.error === 'quota' && j\.message/);
  assert.equal((js.match(/[(=] ?errText\(j\)/g) || []).length, 1, '言い換え・写真・訳（post）の 1 か所で使う');
  assert.doesNotMatch(js, /枠を使い切りました/);
});

// 使い方ページの「1 日の上限」の数は yorozu-ai の wrangler.jsonc の vars が正本（DAILY_LIMIT・PHOTO_DAILY_LIMIT）。
// 2 か所に持つので突き合わせる（yorozu-plans CLAUDE.md「値を 2 箇所に持ってよいのは機械が突き合わせられるときだけ」）。
// PC で隣に yorozu-ai があるときだけ見る（無ければ飛ばす）
test('使い方の 1 日の上限の数が yorozu-ai の設定と同じ。プライバシーポリシーの 7.7 へのリンク', (t) => {
  const guide = read('yasashii/guide.html');
  assert.match(guide, /privacy-policy\.html#yasashii/);
  const wf = path.join(__dirname, '..', '..', 'yorozu-ai', 'wrangler.jsonc');
  if (!fs.existsSync(wf)) return t.skip('yorozu-ai が隣に無い');
  const w = fs.readFileSync(wf, 'utf8');
  const v = (k) => Number((w.match(new RegExp(`"${k}":\\s*"(\\d+)"`)) || [])[1]);
  assert.ok(guide.includes(`合わせて 1 日 ${v('DAILY_LIMIT')} 回`), `DAILY_LIMIT ${v('DAILY_LIMIT')}`);
  assert.ok(guide.includes(`写真は 1 日 ${v('PHOTO_DAILY_LIMIT')} 回`), `PHOTO_DAILY_LIMIT ${v('PHOTO_DAILY_LIMIT')}`);
});
