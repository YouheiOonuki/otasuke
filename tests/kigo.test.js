// 季語カレンダーのテスト: 二十四節気の計算（国立天文台 暦要項と照合）・季節の区切り・季語の一覧と辞書での確認・印刷の枚数
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sekki = require('../kigo/sekki.js');
const Sheet = require('../kigo/sheet.js');
const DATA = require('../kigo/kigo-data.js');
const C = require('../constants.js');
const { normKigo } = require('../calc.js');
const VERIFIED = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/kigo/verified.json'), 'utf8'));
const KNOWN = C.sekki.table;

test('二十四節気の計算は、暦要項（2026・2027 年の 48 個）と 3 分以内で合う', () => {
  let worst = 0;
  for (const y of [2026, 2027]) {
    const calc = Sekki.termsOfYear(y);   // 表を使わず計算だけ
    assert.equal(calc.length, 24);
    for (const t of calc) {
      const ref = KNOWN[y][t.name];
      assert.ok(ref, y + t.name);
      const e = (Date.parse(t.date + 'T' + t.time + ':00+09:00') - Date.parse(ref.replace(' ', 'T') + ':00+09:00')) / 60000;
      worst = Math.max(worst, Math.abs(e));
      assert.ok(Math.abs(e) <= 3, y + ' ' + t.name + ' の誤差 ' + e + ' 分');
    }
  }
  assert.ok(worst <= 3);
});

test('暦要項の表がある年は表の値を使う（2026 年の立秋は 8 月 7 日、2027 年は 8 月 8 日）', () => {
  const a = Sekki.termsOfYear(2026, KNOWN).find((t) => t.name === '立秋');
  assert.deepEqual([a.date, a.time, a.from], ['2026-08-07', '20:43', 'table']);
  const b = Sekki.termsOfYear(2027, KNOWN).find((t) => t.name === '立秋');
  assert.equal(b.date, '2027-08-08');
  assert.equal(Sekki.termsOfYear(2030, KNOWN)[0].from, 'calc');
});

test('季節の区切り: 立春・立夏・立秋・立冬の日から', () => {
  const cases = [
    ['2026-09-25', '秋', '2026-08-07', '2026-11-07', '立冬'],
    ['2026-02-03', '冬', '2025-11-07', '2026-02-04', '立春'],
    ['2026-02-04', '春', '2026-02-04', '2026-05-05', '立夏'],
    ['2026-05-05', '夏', '2026-05-05', '2026-08-07', '立秋'],
    ['2026-08-06', '夏', '2026-05-05', '2026-08-07', '立秋'],
    ['2027-08-07', '夏', '2027-05-06', '2027-08-08', '立秋'],
    ['2027-01-03', '冬', '2026-11-07', '2027-02-04', '立春'],
  ];
  for (const [iso, season, start, next, nextName] of cases) {
    const s = Sekki.seasonOf(iso, KNOWN);
    assert.deepEqual([s.season, s.start, s.next, s.nextName], [season, start, next, nextName], iso);
  }
  assert.equal(Sekki.seasonOf('2027-01-03', KNOWN).newYear, true);
  assert.equal(Sekki.seasonOf('2027-01-08', KNOWN).newYear, false);
});

test('季節の期間（印刷の見出し）: 冬は立冬から翌年の立春の前日まで', () => {
  assert.deepEqual(Sheet.period('冬', '2026-09-25', KNOWN), { season: '冬', from: '2026-11-07', to: '2027-02-03', fromName: '立冬', toName: '立春', calc: false });
  assert.deepEqual(Sheet.period('秋', '2026-09-25', KNOWN).to, '2026-11-06');
  // 1 月（立春より前）は、前の年の立春からの 1 年
  assert.equal(Sheet.period('春', '2027-01-10', KNOWN).from, '2026-02-04');
  assert.equal(Sheet.period('新年', '2026-09-25', KNOWN), null);
});

test('季語の一覧: 139 語・重複なし・季節ごとの数', () => {
  assert.equal(DATA.length, 139);
  const words = DATA.map((r) => r[1]);
  assert.equal(new Set(words).size, words.length);
  const n = {};
  for (const r of DATA) n[r[0]] = (n[r[0]] || 0) + 1;
  assert.deepEqual(n, { 春: 29, 夏: 30, 秋: 34, 冬: 29, 新年: 17 });
});

test('季語の季節は、辞書（デジタル大辞泉・精選版 日本国語大辞典）の最初の季語の印と同じ（tools/kigo/verified.json）', () => {
  for (const [season, word] of DATA) {
    const v = VERIFIED.words[word];
    assert.ok(v, word + ' の確認の記録が無い');
    assert.equal(v.season, season, word);
    const firsts = Object.values(v.dicts).map((t) => t[0]);
    assert.ok(firsts.includes(season), word + ' の辞書の印: ' + JSON.stringify(v.dicts));
    assert.match(v.url, /^https:\/\/kotobank\.jp\/word\//);
  }
  assert.equal(Object.keys(VERIFIED.words).length, DATA.length);
});

test('夏と間違えやすい語は秋・冬・春に入っている', () => {
  const s = Object.fromEntries(DATA.map((r) => [r[1], r[0]]));
  for (const w of ['七夕', '天の川', '朝顔', '西瓜', '盆踊', '稲妻']) assert.equal(s[w], '秋', w);
  for (const w of ['小春', '落葉', '時雨']) assert.equal(s[w], '冬', w);
  for (const w of ['凧', '蛙']) assert.equal(s[w], '春', w);
});

test('説明は自作の短い 1 文（40 字以内・句点で終わる・例句や「／」を含まない）', () => {
  for (const [, word, yomi, expl] of DATA) {
    if (/^[ァ-ンー]+$/.test(word)) assert.equal(yomi, '', word + ' はカタカナなので読みを付けない');
    else assert.match(yomi, /^[ぁ-んー]+$/, word + ' の読み');
    assert.ok(expl.length <= 40, word + ' の説明が長い: ' + expl.length);
    assert.match(expl, /。$/, word);
    assert.doesNotMatch(expl, /[／\/]|「[^」]{12,}」/, word + ' の説明に句のようなものがある');
  }
});

test('今日の季語: 今の季節の語から選ぶ。1/1〜1/7 は新年の語。日付が同じなら同じ語', () => {
  const a = Sheet.today('2026-09-25', DATA, KNOWN);
  assert.equal(a.season, '秋');
  assert.equal(a.pick.length, 4);
  for (const r of a.pick) assert.equal(r[0], '秋');
  assert.equal(new Set(a.pick.map((r) => r[1])).size, 4);
  assert.deepEqual(Sheet.today('2026-09-25', DATA, KNOWN).pick, a.pick);
  assert.notDeepEqual(Sheet.today('2026-09-26', DATA, KNOWN).pick[0], a.pick[0]);
  const ny = Sheet.today('2027-01-03', DATA, KNOWN);
  assert.equal(ny.season, '新年');
  for (const r of ny.pick) assert.equal(r[0], '新年');
});

test('印刷の枚数: 説明つきの表は 1 枚 18 語（大きい字 12 語）、季語だけは 1 季節 1 枚', () => {
  const base = { form: 'table', yomi: true, size: 'normal', credit: true };
  const count = (s) => DATA.filter((r) => r[0] === s).length;
  for (const s of ['春', '夏', '秋', '冬', '新年']) {
    assert.equal(Sheet.buildSheets({ ...base, season: s }, DATA, '2026-09-25', KNOWN, '').sheets, Math.ceil(count(s) / 18), s);
    assert.equal(Sheet.buildSheets({ ...base, season: s, size: 'large' }, DATA, '2026-09-25', KNOWN, '').sheets, Math.ceil(count(s) / 12), s);
    assert.equal(Sheet.buildSheets({ ...base, season: s, form: 'words' }, DATA, '2026-09-25', KNOWN, '').sheets, 1, s);
  }
  const all = Sheet.buildSheets({ ...base, season: 'all' }, DATA, '2026-09-25', KNOWN, '');
  assert.equal(all.sheets, 2 + 2 + 2 + 2 + 1);
  const r = Sheet.buildSheets({ ...base, season: '秋' }, DATA, '2026-09-25', KNOWN, '<div class="credit">X</div>');
  assert.match(r.html, /立秋（2026年8月7日）から、立冬の前日（11月6日）まで/);
  assert.match(r.html, /class="credit"/);
  assert.doesNotMatch(Sheet.buildSheets({ ...base, season: '秋', credit: false }, DATA, '2026-09-25', KNOWN, '<div class="credit">X</div>').html, /credit/);
  assert.doesNotMatch(Sheet.buildSheets({ ...base, season: '秋', yomi: false }, DATA, '2026-09-25', KNOWN, '').html, /kg-y/);
});

test('normKigo: 知らない値は既定に戻す', () => {
  assert.deepEqual(normKigo(null), { season: 'now', form: 'table', yomi: true, size: 'normal', credit: true });
  assert.deepEqual(normKigo({ season: '秋', form: 'words', yomi: false, size: 'large', credit: false }), { season: '秋', form: 'words', yomi: false, size: 'large', credit: false });
  assert.equal(normKigo({ season: '梅雨' }).season, 'now');
});

test('出典と確認日（暦要項・コトバンク）', () => {
  assert.equal(C.sekki.checked, C.CHECKED);
  assert.match(C.sekki.url, /eco\.mtk\.nao\.ac\.jp\/koyomi\/yoko\/2026\//);
  assert.equal(Object.keys(C.sekki.table[2026]).length, 24);
  assert.equal(Object.keys(C.sekki.table[2027]).length, 24);
  assert.equal(VERIFIED.checked, C.CHECKED);
});
