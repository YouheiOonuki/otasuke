// 脳トレプリント（notore/）のテスト: 乱数と問題番号、計算、漢字の読みの語、かなクロスワード、間違い探し、塗り絵カレンダー、用紙の組み立て
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../notore/gen.js');
const KANJI = require('../notore/kanji-data.js');
const KANA = require('../notore/kana-data.js');
const Calc = require('../calc.js');
const C = require('../constants.js');

const ROOT = path.join(__dirname, '..');
const LEVELS = ['easy', 'normal', 'hard'];
const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 2654435761) >>> 0);

test('乱数: 同じ種なら同じ並び、問題番号は 5 桁-5 桁で読み戻せる', () => {
  const a = G.makeRng(123, 4), b = G.makeRng(123, 4), c = G.makeRng(124, 4);
  const xa = [a.next(), a.next(), a.next()], xb = [b.next(), b.next(), b.next()];
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, [c.next(), c.next(), c.next()]);
  assert.equal(G.seedLabel(123), '00000-00123');
  assert.equal(G.seedLabel(4294967295), '42949-67295');
  for (const s of [0, 1, 99999, 1234567890, 4294967295]) assert.equal(G.parseSeedLabel(G.seedLabel(s)), s);
  assert.equal(G.parseSeedLabel('１２３４５－６７８９０'), 1234567890);
  assert.equal(G.parseSeedLabel(' 12345 67890 '), 1234567890);
  for (const bad of ['', 'abc', '4294967296', '12345-6789a']) assert.equal(G.parseSeedLabel(bad), null, bad);
});

test('計算: 1 枚 20 問・重ならない・答えが合う・範囲どおり（3 段階×5 種×40 の種）', () => {
  for (const lv of LEVELS) {
    for (const op of G.OPS) {
      for (const s of SEEDS) {
        const ps = G.calcPage(lv, op, G.makeRng(s, 1));
        assert.equal(ps.length, 20);
        assert.equal(new Set(ps.map((p) => p.a + p.op + p.b)).size, 20);
        for (const p of ps) {
          const ans = { '+': p.a + p.b, '−': p.a - p.b, '×': p.a * p.b, '÷': p.a / p.b }[p.op];
          assert.equal(p.ans, ans);
          assert.ok(Number.isInteger(p.ans) && p.ans >= 0, JSON.stringify(p));
          if (op !== 'mix') assert.equal(p.op, { add: '+', sub: '−', mul: '×', div: '÷' }[op]);
        }
        if (op === 'mix') for (const o of ['+', '−', '×', '÷']) assert.equal(ps.filter((p) => p.op === o).length, 5);
      }
    }
  }
  // やさしいのたし算は 1 けた同士、むずかしいのたし算は 3 けたから
  for (const p of G.calcPage('easy', 'add', G.makeRng(5, 1))) assert.ok(p.a <= 9 && p.b <= 9);
  for (const p of G.calcPage('hard', 'add', G.makeRng(5, 1))) assert.ok(p.a >= 100);
  for (const p of G.calcPage('easy', 'div', G.makeRng(5, 1))) assert.ok(p.b <= 9 && p.ans <= 9);   // 九九の逆
});

test('漢字の読みの語: 形・重なり・外した語・表から確かめた例', () => {
  const all = [...KANJI.easy, ...KANJI.normal, ...KANJI.hard];
  assert.ok(KANJI.easy.length >= 500 && KANJI.normal.length >= 500 && KANJI.hard.length >= 150, JSON.stringify([KANJI.easy.length, KANJI.normal.length, KANJI.hard.length]));
  assert.equal(new Set(all.map((w) => w[0])).size, all.length, '同じ語が 2 回ある');
  for (const w of all) {
    assert.match(w[0], /[一-鿿]/, w[0]);
    assert.match(w[1], /^[ぁ-ゖ]+$/, w[0] + ' の読み');
    assert.doesNotMatch(w[0], /[死殺葬病癌墓遺骸刑獄罪犯暴盗爆弾銃忘]/, w[0] + ' は配る紙に向かない字を含む');
  }
  const find = (x) => all.find((w) => w[0] === x);
  // 常用漢字表の本表・付表で手で確かめた語（音訓欄・例欄・付表の読み）
  const expected = { 囲む: 'かこむ', 委ねる: 'ゆだねる', 時雨: 'しぐれ', 老舗: 'しにせ', 五月雨: 'さみだれ', 雪崩: 'なだれ', 一般: 'いっぱん', 雨戸: 'あまど', 稲穂: 'いなほ', 久遠: 'くおん' };
  for (const [w, r] of Object.entries(expected)) assert.equal((find(w) || [])[1], r, w);
  assert.deepEqual(find('師走'), ['師走', 'しわす', 'しはす']);   // 付表「（「しはす」とも言う。）」
  // 読みが割れる語・向かない語は外した
  for (const w of ['今日', '明日', '紅葉', '梅雨', '今朝', '二十歳', '上手', '下手', '開く', '一日', '二十', '五月', '浮気', '八百長', '最期']) assert.equal(find(w), undefined, w);
  // むずかしさ: やさしいは小学校の字だけ（配当表は tools/notore/grades.json）
  const G6 = new Set(Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/notore/grades.json'), 'utf8'))).join(''));
  assert.equal(G6.size, 1026);
  for (const w of KANJI.easy) for (const c of w[0]) if (/[一-鿿]/.test(c)) assert.ok(G6.has(c), w[0]);
  // 出典と確認日
  assert.equal(C.joyoKanji.checked, C.CHECKED);
  assert.match(C.joyoKanji.url, /^https:\/\/www\.bunka\.go\.jp\/.+joyokanjihyo_20101130\.pdf$/);
});

test('漢字の読み: 1 枚 20 語・枚の中で重ならない・一巡するまで前の枚と重ならない・同じ種で同じ', () => {
  for (const lv of LEVELS) {
    const pages = G.kanjiPages(lv, 5, 42, KANJI);
    assert.equal(pages.length, 5);
    const seen = new Set();
    for (const p of pages) {
      assert.equal(p.length, 20);
      assert.equal(new Set(p.map((w) => w.word)).size, 20);
      for (const w of p) { assert.ok(!seen.has(w.word), lv + ' ' + w.word); seen.add(w.word); }
    }
    assert.deepEqual(G.kanjiPages(lv, 5, 42, KANJI), pages);
    assert.notDeepEqual(G.kanjiPages(lv, 5, 43, KANJI), pages);
  }
});

test('かなクロスワードの語とカギ: ひらがな 2〜5 字・小さい字と「ー」なし・カギに答えを書かない・重ならない', () => {
  assert.ok(KANA.length >= 200, String(KANA.length));
  assert.equal(new Set(KANA.map((w) => w[0])).size, KANA.length);
  for (const [w, clue, kanji] of KANA) {
    assert.match(w, /^[ぁ-ゖ]{2,5}$/, w);
    assert.doesNotMatch(w, /[ぁぃぅぇぉっゃゅょゎゕゖー]/, w);
    assert.ok(!clue.includes(w), w + ' のカギに答えがある');
    if (kanji) assert.ok(!clue.includes(kanji), w + ' のカギに答えの漢字がある');
    // 〇 の数は答えの字数と同じ（「鶴は千年、〇〇は万年」）
    const blanks = (clue.match(/〇+/) || [''])[0].length;
    if (blanks) assert.equal(blanks, w.length, w);
    assert.ok(clue.length <= 32, w + ' のカギが長い');
  }
});

// ます目の中の 2 字以上の並び（ヨコ・タテ）をすべて取り出す
function runs(cw) {
  const out = [];
  for (let y = 0; y < cw.h; y++) {
    let s = '', x0 = 0;
    for (let x = 0; x <= cw.w; x++) {
      const ch = x < cw.w ? cw.cells[y][x] : '';
      if (ch) { if (!s) x0 = x; s += ch; } else { if (s.length >= 2) out.push({ word: s, r: y, c: x0, dir: 0 }); s = ''; }
    }
  }
  for (let x = 0; x < cw.w; x++) {
    let s = '', y0 = 0;
    for (let y = 0; y <= cw.h; y++) {
      const ch = y < cw.h ? cw.cells[y][x] : '';
      if (ch) { if (!s) y0 = y; s += ch; } else { if (s.length >= 2) out.push({ word: s, r: y0, c: x, dir: 1 }); s = ''; }
    }
  }
  return out;
}

test('かなクロスワード: 語の数・ます目の並びは置いた語だけ・すべてつながる・番号は左上から（3 段階×40 の種）', () => {
  for (const lv of LEVELS) {
    let short = 0;
    for (const s of SEEDS) {
      const cw = G.crossword(lv, G.makeRng(s, 4), KANA, {});
      const words = cw.across.concat(cw.down);
      if (words.length < G.CROSS[lv].target) short++;
      assert.ok(words.length >= G.CROSS[lv].target - 1, lv + ' ' + s + ': ' + words.length);
      assert.ok(cw.w <= G.CROSS[lv].size && cw.h <= G.CROSS[lv].size);
      assert.equal(new Set(words.map((w) => w.word)).size, words.length);
      // 偶然できた並びが無い（並びと置いた語が 1 対 1）
      const key = (w) => w.dir + ':' + w.r + ':' + w.c + ':' + w.word;
      assert.deepEqual(runs(cw).map(key).sort(), words.map(key).sort(), lv + ' ' + s);
      // カギは語の表から
      for (const w of words) assert.equal(KANA.find((k) => k[0] === w.word)[1], w.clue);
      // 番号: 1 から順、ヨコとタテで同じマスから始まる語は同じ番号
      const nums = [...new Set(words.map((w) => w.n))].sort((a, b) => a - b);
      assert.deepEqual(nums, nums.map((_, i) => i + 1));
      // すべての字がつながっている
      const cells = [];
      cw.cells.forEach((row, y) => row.forEach((ch, x) => { if (ch) cells.push(y + ',' + x); }));
      const seen = new Set([cells[0]]), stack = [cells[0]];
      while (stack.length) {
        const [y, x] = stack.pop().split(',').map(Number);
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (y + dy) + ',' + (x + dx);
          if (cells.includes(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
      assert.equal(seen.size, cells.length, lv + ' ' + s + ' がつながっていない');
    }
    assert.ok(short <= 2, lv + ': 目標の語数に届かない種が ' + short);
  }
});

test('間違い探し: ちがいは決めた数だけ・ちがう場所はそこだけ・同じ種で同じ', () => {
  for (const lv of LEVELS) {
    const M = G.MACHIGAI[lv];
    for (const s of SEEDS) {
      const m = G.machigai(lv, G.makeRng(s, 3));
      assert.equal(m.top.length, M.cols * M.rows);
      assert.equal(m.diffs.length, M.diffs);
      assert.equal(new Set(m.diffs.map((d) => d.i)).size, M.diffs);
      const differ = m.top.map((t, i) => JSON.stringify(t) !== JSON.stringify(m.bottom[i]) ? i : -1).filter((i) => i >= 0);
      assert.deepEqual(differ, m.diffs.map((d) => d.i));
      for (const d of m.diffs) {
        const t = m.top[d.i], b = m.bottom[d.i];
        if (d.type === 'remove') assert.ok(!t.empty && b.empty);
        if (d.type === 'add') assert.ok(t.empty && !b.empty);
        if (d.type === 'shape') assert.notEqual(t.shape, b.shape);
        if (d.type === 'fill') assert.notEqual(t.fill, b.fill);
        if (d.type === 'size') assert.ok(b.s < t.s * 0.6);
        assert.ok(M.types.includes(d.type) || d.type === 'shape');
        assert.match(G.describeDiff(m, d), /^上から \d 段目・左から \d つめ: /);
      }
      // 図形は枠の中
      for (const c of m.top) assert.ok(c.x - c.s / 2 >= 0 && c.x + c.s / 2 <= 182 && c.y - c.s / 2 >= 0 && c.y + c.s / 2 <= 104, JSON.stringify(c));
    }
  }
  assert.deepEqual(G.machigai('normal', G.makeRng(9, 3)), G.machigai('normal', G.makeRng(9, 3)));
});

test('塗り絵カレンダー: 月の並び・月の足し算・既定の月・和暦', () => {
  const sep = G.monthGrid(2026, 9);   // 2026-09-25 は金曜日なので 1 日は火曜日
  assert.deepEqual(sep.weeks[0], [null, null, 1, 2, 3, 4, 5]);
  assert.equal(sep.weeks.flat().filter(Boolean).length, 30);
  assert.equal(G.monthGrid(2028, 2).weeks.flat().filter(Boolean).length, 29);   // うるう年
  assert.equal(G.monthGrid(2027, 2).weeks.flat().filter(Boolean).length, 28);
  assert.equal(G.addMonths('2026-12', 1), '2027-01');
  assert.equal(G.addMonths('2026-09', 15), '2027-12');
  assert.equal(G.defaultMonth(new Date(2026, 8, 20)), '2026-09');
  assert.equal(G.defaultMonth(new Date(2026, 8, 25)), '2026-10');
  assert.equal(G.defaultMonth(new Date(2026, 11, 31)), '2027-01');
  assert.equal(G.reiwaLabel(2026, 10), '令和8年');
  assert.equal(G.reiwaLabel(2019, 5), '令和元年');
  assert.equal(G.reiwaLabel(2019, 4), '');
  for (const lv of LEVELS) assert.equal(G.mandala(lv, G.makeRng(1, 5)).rings.length, G.NURIE[lv].rings);
});

const DATA = { kanji: KANJI, kana: KANA, today: new Date(2026, 8, 25) };
test('用紙: 枚数（答えつき・なし）・同じ設定と番号で同じ HTML・名前はエスケープ', () => {
  for (const kind of G.KINDS) {
    for (const answers of [true, false]) {
      const s = Calc.normNotore({ kind, level: 'normal', pages: 3, answers, seed: 777, name: '<山田>' });
      const r = G.buildSheets(s, DATA);
      const n = kind === 'nurie' ? 3 : answers ? 6 : 3;
      assert.equal(r.sheets, n, kind);
      assert.equal((r.html.match(/class="sheet nt-sheet/g) || []).length, n, kind);
      assert.equal(r.html, G.buildSheets(s, DATA).html);
      assert.notEqual(r.html, G.buildSheets(Object.assign({}, s, { seed: 778 }), DATA).html, kind);
      assert.ok(r.html.includes('問題番号 00000-00777'));
      if (kind !== 'nurie') { assert.ok(r.html.includes('&lt;山田&gt;')); assert.ok(!r.html.includes('<山田>')); }
      assert.ok(r.html.includes('yorozu-craft.com/otasuke/print/'));
      assert.ok(!G.buildSheets(Object.assign({}, s, { credit: false }), DATA).html.includes('otasuke/print/'));
    }
  }
  // 塗り絵カレンダーは 1 枚めの月から順に
  const cal = G.buildSheets(Calc.normNotore({ kind: 'nurie', pages: 2, month: '2026-12', seed: 1 }), DATA).html;
  assert.ok(cal.indexOf('>12</span>') < cal.indexOf('>1</span><span class="nt-my">月　2027年'));
});

test('字の大きさ: 用紙の CSS と SVG の字は 14pt 以上', () => {
  const css = fs.readFileSync(path.join(ROOT, 'notore/notore.css'), 'utf8');
  const pts = [...css.matchAll(/font-size:\s*([\d.]+)pt/g)].map((m) => Number(m[1]));
  assert.ok(pts.length > 10);
  for (const p of pts) assert.ok(p >= 14, p + 'pt');
  assert.doesNotMatch(css, /font-size:\s*[\d.]+(px|rem|em)/);
  // SVG の字（単位は mm。14pt = 4.94mm）
  for (const kind of ['machigai', 'cross']) {
    const html = G.buildSheets(Calc.normNotore({ kind, level: 'hard', pages: 1, answers: true, seed: 3 }), DATA).html;
    for (const m of html.matchAll(/font-size="([\d.]+)"/g)) assert.ok(Number(m[1]) >= 4.94, kind + ' ' + m[1]);
  }
});

test('保存データの正規化（normNotore）と共有リンクに名前を入れない', () => {
  assert.deepEqual(Calc.normNotore(null), { kind: 'calc', level: 'normal', pages: 1, answers: true, op: 'mix', month: '', name: '', credit: true, seed: null });
  const d = Calc.normNotore({ kind: 'x', level: 'x', pages: 99, answers: 'yes', op: 'pow', month: '2026-13', name: 'あ'.repeat(40), credit: 1, seed: -1 });
  assert.deepEqual(d, { kind: 'calc', level: 'normal', pages: 1, answers: true, op: 'mix', month: '', name: 'あ'.repeat(12), credit: true, seed: null });
  assert.equal(Calc.normNotore({ seed: 4294967295 }).seed, 4294967295);
  assert.equal(Calc.normNotore({ seed: 4294967296 }).seed, null);
  assert.equal(Calc.normNotore({ seed: 1.5 }).seed, null);
  assert.equal(Calc.normNotore({ month: '2026-10' }).month, '2026-10');
  const app = fs.readFileSync(path.join(ROOT, 'notore/app.js'), 'utf8');
  const share = app.match(/return \{ t: 'notore'[^}]*\}/)[0];
  assert.doesNotMatch(share, /name/);
  // 書き出しのまとめに入る
  assert.match(fs.readFileSync(path.join(ROOT, 'common.js'), 'utf8'), /var KEYS = \[[^\]]*'notore'/);
});
