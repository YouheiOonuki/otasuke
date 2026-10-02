// 脳トレの本（notore/book.js、ROADMAP K127）のテスト: 100 日の並び、同じ問題番号で同じ本、目次とページ番号、
// KDP の判型・余白・ページ数（book-values.js）、文の長さ（1 文 40 字以内）、効果・医療の語が 0、字の大きさ
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../notore/gen.js');
const B = require('../notore/book.js');
const V = require('../notore/book-values.js');
const KANJI = require('../notore/kanji-data.js');
const KANA = require('../notore/kana-data.js');
const { pdfInfo, setMediaBox } = require('../tools/notore/pdf-info.cjs');

const ROOT = path.join(__dirname, '..');
const DATA = { kanji: KANJI, kana: KANA };
const SEEDS = [0, 1, 1234567890, 4294967295, 2654435761];
const books = new Map();
function book(seed, bleed) {
  const k = seed + ':' + !!bleed;
  if (!books.has(k)) books.set(k, B.buildBook({ seed, bleed }, DATA));
  return books.get(k);
}
const text = (html) => html.replace(/<[^>]+>/g, ' ');
const IN = 25.4;

test('値ファイル: KDP のヘルプの値（B5・裁ち落とし 0.125 インチ・ページ数 24〜828・ノドの表）と確認日', () => {
  assert.match(V.CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual([V.TRIM.widthIn, V.TRIM.heightIn, V.TRIM.widthMm, V.TRIM.heightMm], [7.17, 10.12, 182, 257]);
  assert.equal(V.BLEED_IN, 0.125);
  assert.deepEqual([V.PAGES.min, V.PAGES.max], [24, 828]);
  assert.deepEqual(V.pageSizeIn(false), { w: 7.17, h: 10.12 });
  assert.deepEqual(V.pageSizeIn(true), { w: 7.295, h: 10.37 });   // 幅 +0.125、高さ +0.25（ノド側には足さない）
  assert.deepEqual([24, 150, 151, 300, 301, 500, 501, 700, 701, 828].map(V.gutterIn), [0.375, 0.375, 0.5, 0.5, 0.625, 0.625, 0.75, 0.75, 0.875, 0.875]);
  assert.equal(V.gutterIn(23), null);
  assert.equal(V.gutterIn(829), null);
  assert.deepEqual(V.OUTSIDE_MIN_IN, { noBleed: 0.25, bleed: 0.375 });
  for (const s of Object.values(V.SOURCES)) { assert.match(s.url, /^https:\/\/kdp\.amazon\.co\.jp\//); assert.equal(s.checked, V.CHECKED); }
});

test('100 日: 間違い探し・計算・漢字の読み・かなクロスワードを 25 日ずつ、順に。1〜50 日めはやさしい、51〜100 日めはふつう', () => {
  const days = book(1).days;
  assert.equal(days.length, 100);
  for (const k of B.ORDER) assert.equal(days.filter((d) => d.kind === k).length, 25, k);
  days.forEach((d, i) => {
    assert.equal(d.day, i + 1);
    assert.equal(d.kind, B.ORDER[i % 4]);
    assert.equal(d.level, i < 50 ? 'easy' : 'normal');
    if (d.kind === 'calc') assert.equal(d.probs.length, 20);
    if (d.kind === 'kanji') assert.equal(d.items.length, 20);
    if (d.kind === 'machigai') assert.equal(d.m.diffs.length, G.MACHIGAI[d.level].diffs);
    if (d.kind === 'cross') assert.ok(d.cw.across.length + d.cw.down.length >= 4, 'クロスワードの語が少ない ' + d.day);
  });
  // 漢字の読みは、同じむずかしさの中で語が重ならない（語が一巡するまで）
  for (const lv of ['easy', 'normal']) {
    const words = days.filter((d) => d.kind === 'kanji' && d.level === lv).flatMap((d) => d.items.map((w) => w.word));
    assert.equal(new Set(words).size, words.length, lv);
  }
  // クロスワードの語も、本の中でなるべく重ならない（前の日の語はうしろへ回す）
  const cw = days.filter((d) => d.kind === 'cross').flatMap((d) => d.cw.across.concat(d.cw.down).map((w) => w.word));
  assert.ok(new Set(cw).size / cw.length > 0.6, '重なりが多い ' + new Set(cw).size + '/' + cw.length);
});

test('問題は gen.js の関数で作っている（同じ seed・同じ種から同じ問題）', () => {
  const s = 1234567890, days = book(s).days;
  const d2 = days[1], d1 = days[0];
  assert.deepEqual(d2.probs, G.calcPage('easy', 'mix', G.makeRng(s, G.SALT.calc * 1000 + 2)));
  assert.deepEqual(d1.m, G.machigai('easy', G.makeRng(s, G.SALT.machigai * 1000 + 1)));
});

test('同じ問題番号から同じ本、ちがう番号からはちがう本', () => {
  for (const s of SEEDS) {
    const a = B.buildBook({ seed: s }, DATA), b = B.buildBook({ seed: s }, DATA);
    assert.equal(a.html, b.html);
    assert.equal(a.css, b.css);
  }
  assert.notEqual(book(1).html, book(2).html);
  // 裁ち落としの有無で中身は変わらない（ページの大きさと余白の CSS だけ）
  assert.equal(book(1, true).html, book(1, false).html);
  assert.notEqual(book(1, true).css, book(1, false).css);
});

test('ページ: 154 ページ（扉・使い方・目次 2・問題 100・答え 50）。KDP の 24〜828 の中。ページ番号は 2 ページめから連番', () => {
  const b = book(1);
  assert.equal(b.pages, 154);
  assert.ok(b.pages >= V.PAGES.min && b.pages <= V.PAGES.max);
  const secs = [...b.html.matchAll(/<section class="bk-page (bk-odd|bk-even) ([^"]*)" data-page="(\d+)"(?: data-day="(\d+)")?>([\s\S]*?)<\/section>/g)];
  assert.equal(secs.length, 154);
  secs.forEach((m, i) => {
    const n = i + 1;
    assert.equal(Number(m[3]), n);
    assert.equal(m[1], n % 2 ? 'bk-odd' : 'bk-even');   // 奇数ページが右（ノドは左）
    const folio = m[5].match(/<div class="bk-folio">(\d+)<\/div>$/);
    if (n === 1) assert.equal(folio, null, '扉にはページ番号を出さない');
    else assert.equal(Number(folio[1]), n);
    if (n >= 5 && n <= 104) assert.equal(Number(m[4]), n - 4, n + ' ページめは ' + (n - 4) + ' 日め');
  });
});

test('目次: 100 日すべて、問題と答えのページが本の中の位置と合う', () => {
  const b = book(1234567890);
  const rows = [...b.html.matchAll(/<tr><td class="bk-td-day">(\d+) 日め<\/td><td>([^<]+)<\/td><td class="bk-td-p">(\d+)<\/td><td class="bk-td-p">(\d+)<\/td><\/tr>/g)];
  assert.equal(rows.length, 100);
  const pages = new Map([...b.html.matchAll(/<section [^>]*data-page="(\d+)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => [Number(m[1]), m[2]]));
  for (const r of rows) {
    const day = Number(r[1]), kind = r[2], p = Number(r[3]), a = Number(r[4]);
    assert.match(pages.get(p), new RegExp('<span class="bk-day">' + day + ' 日め</span><span class="bk-kind">' + kind + '・'), '問題 ' + day);
    assert.ok(pages.get(a).includes(day + ' 日め　' + kind + '（' + p + ' ページ）'), '答え ' + day);
  }
});

test('余白: KDP の最小以上（ノドはこの本のページ数の行、上・下・外側は裁ち落としありの 9.6 mm）。ページ番号も最小より内側', () => {
  const b = book(1);
  assert.equal(b.gutterMinIn, 0.5);   // 151〜300 ページ
  assert.ok(B.MARGIN.inside >= b.gutterMinIn * IN, 'ノド ' + B.MARGIN.inside + 'mm');
  assert.ok(B.MARGIN.inside >= V.gutterIn(301) * IN - 0.01, 'ページ数が 301〜500 に増えても足りる');
  for (const k of ['outside', 'top', 'bottom']) assert.ok(B.MARGIN[k] >= V.OUTSIDE_MIN_IN.bleed * IN, k);
  assert.ok(B.FOLIO_BOTTOM >= V.OUTSIDE_MIN_IN.bleed * IN);
  // CSS: 裁ち落としなしは判型どおり、ありは上・下・外側に 0.125 インチ（3.175 mm）を足す
  const n = B.pageCss(false), y = B.pageCss(true);
  assert.match(n, /@page \{ size: 7\.17in 10\.12in; margin: 0; \}/);
  assert.match(y, /@page \{ size: 7\.295in 10\.37in; margin: 0; \}/);
  assert.match(n, /\.bk-odd \.bk-in \{ top: 12mm; bottom: 18mm; left: 16mm; right: 12mm; \}/);
  assert.match(n, /\.bk-even \.bk-in \{ top: 12mm; bottom: 18mm; left: 12mm; right: 16mm; \}/);
  assert.match(y, /\.bk-odd \.bk-in \{ top: 15\.18mm; bottom: 21\.18mm; left: 16mm; right: 15\.18mm; \}/);
  assert.match(y, /\.bk-even \.bk-in \{ top: 15\.18mm; bottom: 21\.18mm; left: 15\.18mm; right: 16mm; \}/);
});

// check-site（youheioonuki.github.io の tools/check-site.mjs）の MEDICAL_NG と同じ語。本では打ち消しの文も置かないので 0 件
const MEDICAL_NG_CHECK_SITE = ['診断', '改善', '予防', '効果', '治る', '若返'];
test('効果・医療の語: check-site の MEDICAL_NG の語と「認知症」が本のどこにも無い（5 つの問題番号）', () => {
  for (const w of MEDICAL_NG_CHECK_SITE.concat(['認知症'])) assert.match(w, B.NG, w + ' を book.js の NG が拾わない');
  for (const s of SEEDS) {
    const t = text(book(s).html);
    for (const w of MEDICAL_NG_CHECK_SITE.concat(['認知症', '脳の若', '老化', 'ボケ'])) assert.ok(!t.includes(w), s + ' に「' + w + '」');
  }
  // 語の表の側にはある語（治る）を、本では外している
  assert.ok(KANJI.easy.some((w) => w[0] === '治る'));
  assert.ok(!B.cleanKanji(KANJI).easy.some((w) => w[0] === '治る'));
});

test('文の長さ: 本の文はすべて 1 文 40 字以内（5 つの問題番号）', () => {
  for (const s of SEEDS) {
    const long = B.sentences(book(s).html).filter((x) => Array.from(x).length > 40);
    assert.deepEqual(long, [], s + ' に 40 字を超える文');
  }
  // 区切り方の確かめ
  assert.deepEqual(B.sentences('<p>一つめ。二つめ。</p><li>三つめ</li>'), ['一つめ。', '二つめ。', '三つめ']);
});

test('字の大きさ: book.css の字は 11pt 以上（KDP の最小 7pt）。図の中の番号も縮めたあと 7pt 以上', () => {
  const css = fs.readFileSync(path.join(ROOT, 'notore/book.css'), 'utf8');
  const pts = [...css.matchAll(/font-size:\s*([\d.]+)pt/g)].map((m) => Number(m[1]));
  assert.ok(pts.length > 20);
  for (const p of pts) assert.ok(p >= 11, p + 'pt');
  assert.ok(Math.min(...pts) >= V.MIN_FONT_PT);
  // 問題の字は 20pt 以上（計算の式・漢字）
  assert.match(css, /\.bk-page \.nt-expr \{ font-size: 21pt; \}/);
  assert.match(css, /\.bk-page \.nt-kanji \{ font-size: 22pt;/);
  // SVG の番号の字（gen.js は 4.94 単位 = A4 で 14pt）。本の中の縮み方で 7pt（2.47 mm）以上か
  const PT = 25.4 / 72;
  const minScaled = (html, cls) => Math.min(...[...html.matchAll(new RegExp('<svg class="' + cls + '" viewBox="0 0 ([\\d.]+) [\\d.]+" width="([\\d.]+)mm"', 'g'))].map((m) => Number(m[2]) / Number(m[1])));
  const b = book(1);
  assert.ok(4.94 * minScaled(b.html, 'nt-cross') >= 7 * PT, 'クロスワードの番号');
  const ansPanel = Number(css.match(/\.bk-ans \.nt-panel \{ width: ([\d.]+)mm/)[1]);
  assert.ok(4.94 * ansPanel / 182 >= 7 * PT, '間違い探しの答えの番号');
});

test('書体: 埋め込みが許される書体（BIZ UD・Noto・IPA）だけを並べる。Windows の教科書体などは使わない', () => {
  const css = fs.readFileSync(path.join(ROOT, 'notore/book.css'), 'utf8');
  for (const m of css.matchAll(/font-family:\s*([^;]+);/g)) {
    for (const f of m[1].split(',').map((x) => x.trim().replace(/"/g, ''))) assert.match(f, /^(BIZ UD|Noto Sans|Noto Serif|IPA|sans-serif|serif)/, f);
  }
});

test('PDF の読み取り: ページ数・MediaBox・埋め込みフォント、MediaBox を同じ長さで判型ちょうどに直す', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type /Page\n/MediaBox [0 0 516.95996 729.12]\n/Parent 3 0 R>>\nendobj\n2 0 obj\n<</Type /Page\n/MediaBox [0 0 516.95996 729.12]>>\nendobj\n3 0 obj\n<</Type /Pages\n/Count 2>>\nendobj\n4 0 obj\n<</Type /FontDescriptor /FontName /AAAAAA+IPAPGothic /FontFile2 5 0 R>>\nendobj\n', 'latin1');
  const a = pdfInfo(pdf);
  assert.equal(a.pages, 2);
  assert.deepEqual(a.boxes[0], [0, 0, 516.95996, 729.12]);
  assert.deepEqual(a.fonts, ['AAAAAA+IPAPGothic']);
  const fixed = setMediaBox(pdf, 7.17 * 72, 10.12 * 72);
  assert.equal(fixed.length, pdf.length);   // xref の位置が変わらない
  const b = pdfInfo(fixed);
  for (const box of b.boxes) {
    assert.ok(Math.abs(box[2] - box[0] - 516.24) < 0.001 && Math.abs(box[3] - box[1] - 728.64) < 0.001, JSON.stringify(box));
    assert.equal(box[3], 729.12);   // 上の端は動かさない（下と右の余りを切る）
  }
  assert.throws(() => setMediaBox(pdf, 600, 800), /判型より小さい/);
});

test('本のページ（book.html）: noindex、どこからもリンクしない、sitemap に載せない、Service Worker の先読みに入れない', () => {
  const h = fs.readFileSync(path.join(ROOT, 'notore/book.html'), 'utf8');
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'), /book\.html/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /book/);
  for (const f of ['index.html', 'notore/index.html', 'notore/guide.html', 'print/index.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /book\.html/, f);
  }
  // 読む順: 語 → gen.js → 値 → book.js → 画面
  const order = ['kanji-data.js', 'kana-data.js', 'gen.js', 'book-values.js', 'book.js', 'book-app.js'].map((s) => h.indexOf('src="./' + s + '"'));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), JSON.stringify(order));
});
