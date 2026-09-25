// 画面から切り離した関数のテスト（日付・時計・台帳・共有リンク・保存データの正規化・出典）
const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../calc.js');
const C = require('../constants.js');

test('dayRows: 開始日から n 日（月末・うるう年をまたぐ）、空なら手書きの行', () => {
  const r = Calc.dayRows('2028-02-27', 4);
  assert.deepEqual(r.map((x) => x.m + '/' + x.d + x.w), ['2/27日', '2/28月', '2/29火', '3/1水']);
  assert.equal(Calc.dayRows('', 7).length, 7);
  assert.equal(Calc.dayRows('', 7)[0].iso, '');
  assert.equal(Calc.parseISO('2026-02-30'), null);
});

test('clockParts: 12 時間表示は 0〜11 時（正午からは午後 0 時）、24 時間表示は午前・午後なし', () => {
  const p = (h, m, o) => Calc.clockParts(new Date(2026, 8, 25, h, m, 5), Object.assign({ reiwaStart: C.reiwa.start }, o));
  assert.deepEqual([p(0, 5).ampm, p(0, 5).time], ['午前', '0:05']);
  assert.deepEqual([p(11, 59).ampm, p(11, 59).time], ['午前', '11:59']);
  assert.deepEqual([p(12, 0).ampm, p(12, 0).time], ['午後', '0:00']);
  assert.deepEqual([p(15, 7).ampm, p(15, 7).time], ['午後', '3:07']);
  assert.deepEqual([p(15, 7, { h24: true }).ampm, p(15, 7, { h24: true }).time], ['', '15:07']);
  assert.equal(p(9, 0).date, '9月25日');
  assert.equal(p(9, 0).week, '金曜日');
  assert.equal(p(9, 0).year, '2026年');
  assert.equal(p(9, 0, { wareki: true }).year, '令和8年');
  assert.equal(p(9, 0).sec, '05');
  assert.equal(Calc.reiwaYear(new Date(2019, 4, 1), C.reiwa.start), '令和元年');
  assert.equal(Calc.reiwaYear(new Date(2019, 3, 30), C.reiwa.start), null);
});

test('looksLikePassword: 英字と数字の混ざった 8 字以上・「パスワード: …」を知らせる。場所の説明やメールは知らせない', () => {
  for (const s of ['Abc12345', 'hanako2024x', '控え: Pa55word!', 'パスワード：hanako']) assert.equal(Calc.looksLikePassword(s), true, s);
  for (const s of ['', '青い手帳', '金庫の封筒の中', 'パスワード管理アプリ', 'hanako@example.com', 'https://example.com/a1b2c3d4', '1234', 'iPhone 13']) assert.equal(Calc.looksLikePassword(s), false, s);
});

test('共有リンク: 日本語を含む往復、壊れたものは null', () => {
  const o = { t: 'tejun', title: 'LINE で写真を送る', steps: ['LINE を開く', '「トーク」を押す'] };
  const h = Calc.encodeShare(o);
  assert.match(h, /^#s=[A-Za-z0-9_-]+$/);
  assert.deepEqual(Calc.decodeShare(h), o);
  for (const bad of ['', '#s=', '#s=!!!', '#s=' + Buffer.from('[1,2]').toString('base64'), '#x=abc']) assert.equal(Calc.decodeShare(bad), null, bad);
});

test('正規化: 変な値・欠けた値は既定値に、長すぎる字は切る', () => {
  assert.deepEqual(Calc.normShakyo({ kind: 'x', size: 'huge', name: 'あ'.repeat(50), credit: 'yes' }),
    { kind: 'trace', size: 'std', spacing: 'normal', shade: 'normal', title: 'with', prayer: '', name: 'あ'.repeat(12), today: false, credit: false });
  const r = Calc.normReizoko({ kind: 'kyukyu', kyukyu: { name: 'x', bogus: 'y' }, fukuyaku: { days: 99, times: ['moon'] }, ketsuatsu: { days: 7 } });
  assert.equal(r.kyukyu.bogus, undefined);
  assert.equal(r.fukuyaku.days, 7);
  assert.deepEqual(r.fukuyaku.times, ['morning']);
  assert.equal(r.ketsuatsu.days, 14);
  const d = Calc.normDaicho({ rows: [{ kind: '???', service: 'x', password: 'secret' }, null] });
  assert.equal(d.rows.length, 2);
  assert.equal(d.rows[0].kind, 'その他');
  assert.equal(d.rows[0].password, undefined);   // パスワードの欄は持たない
  const t = Calc.normTejun({ steps: new Array(9).fill({ text: 'a', photo: 'javascript:alert(1)' }) });
  assert.equal(t.steps.length, 6);
  assert.equal(t.steps[0].photo, '');
  assert.equal(Calc.normTejun({ steps: [{ text: 'a', photo: 'data:image/jpeg;base64,AAAA' }] }).steps[0].photo, 'data:image/jpeg;base64,AAAA');
  assert.deepEqual(Calc.normTokei(null), { h24: false, wareki: false, seconds: false, theme: 'dark' });
});

test('constants: 出典つきの値はすべて出典・URL・確認日（YYYY-MM-DD）を持つ。CHECKED は check-site が読める形', () => {
  assert.match(C.CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  for (const [k, v] of Object.entries(C)) {
    if (k === 'CHECKED') continue;
    assert.ok(v.source && v.url && v.checked, k + ' に source / url / checked が無い');
    assert.match(v.checked, /^\d{4}-\d{2}-\d{2}$/, k);
    assert.match(v.url, /^https:\/\//, k);
  }
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'constants.js'), 'utf8'), /var CHECKED = '\d{4}-\d{2}-\d{2}'/);
});

test('手順カードのひな形: 1 行 40 字まで、6 行まで', () => {
  for (const [k, t] of Object.entries(C.steps.templates)) {
    assert.ok(t.steps.length <= 6, k);
    for (const s of t.steps) assert.ok(s.length <= 40, k + ': ' + s);
  }
});
