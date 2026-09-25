// 写経用紙のテスト: 経文 262 字の照合と、用紙の並び
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../constants.js');
const { shakyoLayout, shakyoDate, kanjiNum } = require('../calc.js');

// 照合用の写し（2026-09-25 に各ページから取り出した本文。句読点と空白を除いた）
// 1) 文化デジタルライブラリー「読経」の天台宗・真言宗豊山派の経文（2 宗派で本文は同じ）
const NTJ = '観自在菩薩行深般若波羅蜜多時照見五蘊皆空度一切苦厄舎利子色不異空空不異色色即是空空即是色受想行識亦復如是舎利子是諸法空相不生不滅不垢不浄不増不減是故空中無色無受想行識無眼耳鼻舌身意無色声香味触法無眼界乃至無意識界無無明亦無無明尽乃至無老死亦無老死尽無苦集滅道無智亦無得以無所得故菩提薩埵依般若波羅蜜多故心無罣礙無罣礙故無有恐怖遠離一切顚倒夢想究竟涅槃三世諸仏依般若波羅蜜多故得阿耨多羅三藐三菩提故知般若波羅蜜多是大神咒是大明咒是無上咒是無等等咒能除一切苦真実不虚故説般若波羅蜜多咒即説咒曰羯諦羯諦波羅羯諦波羅僧羯諦菩提薩婆訶';
// 2) Wikisource「般若心経」の玄奘訳テキスト（小林正盛 編『真言宗聖典』大正 15 年）
const WIKISOURCE = '観自在菩薩行深般若波羅蜜多時照見五蘊皆空度一切苦厄舎利子色不異空空不異色色即是空空即是色受想行識亦復如是舎利子是諸法空相不生不滅不垢不浄不増不減是故空中無色無受想行識無眼耳鼻舌身意無色声香味触法無眼界乃至無意識界無無明亦無無明尽乃至無老死亦無老死尽無苦集滅道無智亦無得以無所得故菩提薩埵依般若波羅蜜多故心無罜礙無罜礙故無有恐怖遠離一切顛倒夢想究竟涅槃三世諸仏依般若波羅蜜多故得阿耨多羅三藐三菩提故知般若波羅蜜多是大神呪是大明呪是無上呪是無等等呪能除一切苦真実不虚故説般若波羅蜜多呪即説呪曰羯諦羯諦波羅羯諦波羅僧羯諦菩提薩婆訶';

test('経文: 本文は 262 字で、文化デジタルライブラリーの経文と一字ずつ同じ', () => {
  assert.equal(Array.from(C.sutra.body).length, 262);
  assert.equal(C.sutra.bodyLength, 262);
  assert.equal(C.sutra.body, NTJ);
});

test('経文: Wikisource（真言宗聖典）とは字体の 3 種（咒/呪・罣/罜・顚/顛）だけが違う', () => {
  const norm = WIKISOURCE.replace(/呪/g, '咒').replace(/罜/g, '罣').replace(/顛/g, '顚');
  assert.equal(norm, C.sutra.body);
  assert.notEqual(WIKISOURCE, C.sutra.body);
});

test('経文: 題と尾題（仏説の有無は宗派の違い）', () => {
  assert.equal(C.sutra.titleWith, '仏説' + C.sutra.titleWithout);
  assert.equal(C.sutra.titleWithout, '摩訶般若波羅蜜多心経');
  assert.equal(C.sutra.endTitle, '般若心経');
});

function body(L) {
  return L.pages.flat().filter((c) => c.kind === 'body').map((c) => c.cells.join('')).join('');
}

test('並び: 標準は A4 横 1 枚・1 行 17 字、本文を欠けなく順に並べる', () => {
  const L = shakyoLayout({ size: 'std' }, C.sutra);
  assert.equal(L.orient, 'land');
  assert.equal(L.perCol, 17);
  assert.equal(L.pages.length, 1);
  assert.equal(body(L), C.sutra.body);
  const cols = L.pages.flat();
  assert.equal(cols[0].cells.join(''), '仏説摩訶般若波羅蜜多心経');
  assert.equal(cols.filter((c) => c.kind === 'body').length, 16);   // 17 字 × 15 行 + 7 字
  for (const c of cols) assert.equal(c.cells.length, 17);
});

test('並び: 大きいは A4 縦 2 枚、特大は 1 行 14 字で 3 枚、行間ひろいは枚数が増える', () => {
  const large = shakyoLayout({ size: 'large' }, C.sutra);
  assert.equal(large.orient, 'port'); assert.equal(large.pages.length, 2); assert.equal(body(large), C.sutra.body);
  const xl = shakyoLayout({ size: 'xl' }, C.sutra);
  assert.equal(xl.perCol, 14); assert.equal(xl.pages.length, 3); assert.equal(body(xl), C.sutra.body);
  for (const size of ['std', 'large', 'xl']) {
    const n = shakyoLayout({ size }, C.sutra).pages.length, w = shakyoLayout({ size, spacing: 'wide' }, C.sutra);
    assert.ok(w.pages.length >= n, size);
    assert.equal(body(w), C.sutra.body);
    // 字は列の中に収まる（字の大きさ ≤ マスの高さ・列の幅）
    assert.ok(w.charMm <= w.cellH && w.charMm <= w.colW, size);
    assert.ok(w.colW * w.colsPerPage <= w.pageW - w.margin * 2 + 1e-9, size);
  }
});

test('並び: 書き終わりは 尾題 → 1 行あけ → 日付（1 字下げ）→ 願文（為〜）→ 名前と謹写（下に寄せる）', () => {
  const L = shakyoLayout({ size: 'std', title: 'without', prayer: '家内安全', name: '山田花子', date: '令和八年九月二十五日' }, C.sutra);
  const cols = L.pages.flat();
  assert.equal(cols[0].cells.join(''), '摩訶般若波羅蜜多心経');
  const tail = cols.slice(-5);
  assert.deepEqual(tail.map((c) => c.kind), ['end', 'blank', 'date', 'prayer', 'name']);
  assert.equal(tail[0].cells.join(''), '般若心経');
  assert.equal(tail[2].cells[0], '');
  assert.equal(tail[2].cells.join(''), '令和八年九月二十五日');
  assert.equal(tail[3].cells.join(''), '為家内安全');
  assert.equal(tail[4].cells.slice(-2).join(''), '謹写');
  assert.equal(tail[4].cells.join(''), '山田花子謹写');
  // 空欄なら手で書く欄（日付は「令和　年　月　日」の形だけ）
  const blank = shakyoLayout({ size: 'std' }, C.sutra).pages.flat().slice(-3);
  assert.equal(blank[0].cells.join(''), '令和年月日');
  assert.equal(blank[1].cells.join(''), '');
  assert.equal(blank[2].cells.join(''), '謹写');
});

test('日付: 漢数字（令和元年・十・二十五）', () => {
  assert.equal(kanjiNum(1), '一'); assert.equal(kanjiNum(10), '十'); assert.equal(kanjiNum(12), '十二'); assert.equal(kanjiNum(25), '二十五'); assert.equal(kanjiNum(30), '三十');
  assert.equal(shakyoDate(new Date(2026, 8, 25), C.reiwa.start), '令和八年九月二十五日');
  assert.equal(shakyoDate(new Date(2019, 4, 1), C.reiwa.start), '令和元年五月一日');
  assert.equal(shakyoDate(new Date(2019, 3, 30), C.reiwa.start), '');
});
