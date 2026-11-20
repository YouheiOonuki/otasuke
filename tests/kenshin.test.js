// 健診結果の経年グラフ（kenshin/）のテスト: node --test tests/*.test.js
// 線の値は、厚生労働省「標準的な健診・保健指導プログラム（令和6年度版）」の PDF の表から、この試験のために別に写した期待値と照らす
//   別紙5 p.125: https://www.mhlw.go.jp/content/10900000/001231392.pdf
//   第2編第3章 p.57（階層化 ステップ1）: https://www.mhlw.go.jp/content/10900000/001081570.pdf
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../kenshin/kenshin-values.js');
const K = require('../kenshin/kenshin-calc.js');
const C = require('../calc.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// PDF の表（別紙5）から写した値。[項目, 保健指導判定値, 受診勧奨判定値]（"－" は値なし）
const PDF_TABLE = {
  sbp: ['≧130', '≧140'], dbp: ['≧85', '≧90'], fbs: ['≧100', '≧126'], hba1c: ['≧5.6', '≧6.5'], ldl: ['≧120', '≧140'],
  hdl: ['＜40', '－'], ast: ['≧31', '≧51'], alt: ['≧31', '≧51'], ggt: ['≧51', '≧101'], egfr: ['＜60＊', '＜45＊'],
};

function col(it, kind) {
  const ls = it.lines.filter((l) => l.kind === kind);
  return ls.length ? ls.map((l) => l.op + l.v + (l.star ? '＊' : '') + (l.when ? '/' + l.when : '')).join(' ') : '－';
}

test('線の値: 別紙5 の表と一致（血圧・血糖・HbA1c・LDL・HDL・肝機能・eGFR）', () => {
  for (const [key, [g, r]] of Object.entries(PDF_TABLE)) {
    const it = V.ITEMS.find((i) => i.key === key);
    assert.equal(col(it, 'guide'), g, key + ' 保健指導判定値');
    assert.equal(col(it, 'refer'), r, key + ' 受診勧奨判定値');
  }
});

test('線の値: 中性脂肪は空腹時 ≧150・随時 ≧175（保健指導判定値）、≧300（受診勧奨判定値）', () => {
  const tg = V.ITEMS.find((i) => i.key === 'tg');
  assert.equal(col(tg, 'guide'), '≧150/fasting ≧175/random');
  assert.equal(col(tg, 'refer'), '≧300');
});

test('線の値: 腹囲 男性85・女性90、BMI 25（階層化 ステップ1）。身長・体重・尿酸は線なし', () => {
  const by = (k) => V.ITEMS.find((i) => i.key === k);
  assert.deepEqual(by('waist').lines.map((l) => [l.kind, l.op, l.v, l.sex]), [['strat', '≧', 85, 'm'], ['strat', '≧', 90, 'f']]);
  assert.deepEqual(by('bmi').lines.map((l) => [l.kind, l.op, l.v]), [['strat', '≧', 25]]);
  for (const k of ['height', 'weight', 'ua']) assert.equal(by(k).lines.length, 0, k);
});

test('項目は 15（BMI は計算）、線の名前は資料の語、出典は厚労省の PDF で確認日つき', () => {
  assert.deepEqual(V.ITEMS.map((i) => i.key), ['height', 'weight', 'bmi', 'waist', 'sbp', 'dbp', 'fbs', 'hba1c', 'ldl', 'hdl', 'tg', 'ast', 'alt', 'ggt', 'egfr', 'ua']);
  assert.deepEqual(V.KINDS, { guide: '保健指導判定値', refer: '受診勧奨判定値', strat: '内臓脂肪蓄積のリスク判定' });
  assert.match(V.CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(read('kenshin/kenshin-values.js'), /var CHECKED = '\d{4}-\d{2}-\d{2}'/);   // check-site が読む形
  for (const s of Object.values(V.SOURCES)) { assert.match(s.url, /^https:\/\/www\.mhlw\.go\.jp\//); assert.equal(s.checked, V.CHECKED); }
  assert.deepEqual(C.KENSHIN_KEYS.slice().sort(), V.ITEMS.filter((i) => !i.calc).map((i) => i.key).sort());
});

test('BMI: 体重 ÷ 身長(m) の 2 乗、小数 1 桁', () => {
  assert.equal(K.bmi(170, 65), 22.5);
  assert.equal(K.bmi(154.2, 52.1), 21.9);
  assert.equal(K.bmi(160, 64), 25);
  assert.equal(K.bmi(null, 60), null);
  assert.equal(K.bmi(160, undefined), null);
});

const P = (sex, records) => C.normKenshin({ people: [{ name: '例', sex, records }] }).people[0];
const shorts = (key, p) => { const it = K.itemOf(key); return K.linesFor(it, p, K.series(p, key)).map((l) => l.short); };

test('腹囲の線は性別で選ぶ（選んでいなければ男女とも）', () => {
  const recs = [{ when: '2024', v: { waist: 80 } }];
  assert.deepEqual(shorts('waist', P('m', recs)), ['85（男性）']);
  assert.deepEqual(shorts('waist', P('f', recs)), ['90（女性）']);
  assert.deepEqual(shorts('waist', P('', recs)), ['85（男性）', '90（女性）']);
});

test('中性脂肪の線は採血の空腹時・随時で選ぶ。白抜きの点は中性脂肪と血糖だけ', () => {
  assert.deepEqual(shorts('tg', P('', [{ when: '2024', v: { tg: 100 } }])), ['150（空腹時）', '300']);
  assert.deepEqual(shorts('tg', P('', [{ when: '2024', random: true, v: { tg: 100 } }])), ['175（随時）', '300']);
  assert.deepEqual(shorts('tg', P('', [{ when: '2023', v: { tg: 100 } }, { when: '2024', random: true, v: { tg: 100 } }])), ['150（空腹時）', '175（随時）', '300']);
  const p = P('', [{ when: '2024', random: true, v: { tg: 100, fbs: 95, ldl: 120, height: 160, weight: 60 } }]);
  assert.equal(K.series(p, 'tg')[0].random, true);
  assert.equal(K.series(p, 'fbs')[0].random, true);
  assert.equal(K.series(p, 'ldl')[0].random, false);
  assert.equal(K.series(p, 'bmi')[0].random, false);
  assert.match(K.linesFor(K.itemOf('fbs'), p, K.series(p, 'fbs'))[0].full, /随時血糖も同じ値/);
});

test('線の名前（凡例）は資料の語のまま', () => {
  const p = P('m', [{ when: '2024', v: { sbp: 120, hdl: 50, egfr: 70, waist: 80, height: 170, weight: 70 } }]);
  const full = (k) => K.linesFor(K.itemOf(k), p, K.series(p, k)).map((l) => l.full);
  assert.deepEqual(full('sbp'), ['保健指導判定値 ≧130', '受診勧奨判定値 ≧140']);
  assert.deepEqual(full('hdl'), ['保健指導判定値 ＜40']);
  assert.deepEqual(full('egfr'), ['保健指導判定値 ＜60＊', '受診勧奨判定値 ＜45＊']);
  assert.deepEqual(full('waist'), ['内臓脂肪蓄積のリスク判定（腹囲 男性85cm以上）']);
  assert.deepEqual(full('bmi'), ['内臓脂肪蓄積のリスク判定（BMI≧25）']);
});

test('保存の正規化: 年月の形・範囲の外の値・同じ年月・並び・人数', () => {
  const d = C.normKenshin({
    people: [{ name: 'あ', sex: 'x', records: [
      { when: '2025-06', v: { sbp: '135', dbp: 'abc', tg: 99999, hba1c: 5.55 } },
      { when: '2023', v: { sbp: 120 } },
      { when: '2025-06', v: { sbp: 140 } },
      { when: '2025-13', v: { sbp: 120 } },
      { when: '1949', v: { sbp: 120 } },
      { when: '2024-01-05', v: { sbp: 120 } },
    ] }],
    cur: 5,
  });
  const p = d.people[0];
  assert.equal(p.sex, '');
  assert.deepEqual(p.records.map((r) => r.when), ['2023', '2025-06']);
  assert.deepEqual(p.records[1].v, { sbp: 140 });
  assert.equal(d.cur, 0);
  assert.deepEqual(C.normKenshin({}).people, [{ name: '', sex: '', records: [] }]);
  assert.equal(C.normKenshin({ people: Array.from({ length: 20 }, () => ({})) }).people.length, C.KENSHIN_MAX_PEOPLE);
  assert.equal(C.kenshinNum('hba1c', '5.55'), 5.6);
});

const SAMPLE = C.normKenshin({ people: [
  { name: '母', sex: 'f', records: [
    { when: '2021-06', v: { height: 152.3, weight: 50.2, waist: 82, sbp: 128, dbp: 78, fbs: 98, hba1c: 5.6, ldl: 131, hdl: 62, tg: 110, ast: 22, alt: 18, ggt: 25, egfr: 68.2, ua: 4.9 } },
    { when: '2022-07', random: true, v: { height: 152.1, weight: 51, sbp: 134, tg: 180, fbs: 104 } },
    { when: '2024', v: { weight: 52.4, sbp: 141, hdl: 38, egfr: 59.5 } },
  ] },
  { name: '父', sex: 'm', records: [{ when: '2025-05', v: { height: 168, weight: 70, waist: 90, sbp: 150 } }] },
], cur: 0 });

function allCharts(data) {
  return data.people.map((p) => V.ITEMS.map((it) => {
    const pts = K.series(p, it.key);
    return K.chartSVG({ item: it, points: pts, lines: K.linesFor(it, p, pts), years: K.yearRange(p), w: 300, h: 250, font: 15, labels: 'all' });
  }).join('')).join('|');
}

test('CSV: 書き出し → 読み込みで同じデータ・同じグラフ', () => {
  const csv = K.buildCSV(SAMPLE);
  assert.ok(csv.startsWith('﻿名前,性別,受けた年月,採血,身長(cm)'));
  assert.equal(csv.trim().split('\r\n').length, 1 + 4);
  const r = K.parseCSV(csv);
  assert.equal(r.ok, true);
  assert.equal(r.count, 4);
  assert.deepEqual(r.errors, []);
  const back = K.mergeImport(C.normKenshin({}), r.people);
  assert.deepEqual(back, SAMPLE);
  assert.equal(allCharts(back), allCharts(SAMPLE));
});

test('CSV: Excel で直した形（日付・全角・単位なしの見出し・空行）も読める。読めない欄は行と欄を知らせる', () => {
  const text = '氏名,受診日,血圧(上),LDL,HbA1c,γ-GTP\r\n母,2023/6/12,１３２,140,5.8,30\r\n\r\n母,2024年7月,1300,120,,\r\n母,令和6年,120,,,\r\n';
  const r = K.parseCSV(text);
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.deepEqual(r.people[0].records, [
    { when: '2023-06', random: false, v: { sbp: 132, ldl: 140, hba1c: 5.8, ggt: 30 } },
    { when: '2024-07', random: false, v: { ldl: 120 } },
  ]);
  assert.match(r.errors.join('\n'), /4 行目: 収縮期血圧「1300」は読めないので空にしました/);
  assert.match(r.errors.join('\n'), /5 行目: 受けた年月「令和6年」が読めない/);
  assert.equal(K.parseCSV('a,b\r\n1,2').ok, false);
});

test('CSV: 表計算ソフトの式として動く名前は先頭に \' を付ける', () => {
  const csv = K.buildCSV(C.normKenshin({ people: [{ name: '=HYPERLINK("x")', records: [{ when: '2024', v: { sbp: 120 } }] }] }));
  assert.match(csv, /\r\n"'=HYPERLINK\(""x""\)",/);
});

test('CSV の読み込み: 同じ名前の人の同じ年月は置き換え、名前の違う人は足す', () => {
  const add = { name: '母', sex: '', records: [{ when: '2024', random: false, v: { sbp: 120 } }, { when: '2025', random: false, v: { sbp: 125 } }] };
  const m = K.mergeImport(SAMPLE, [add, { name: '祖母', sex: 'f', records: [{ when: '2020', random: false, v: { sbp: 150 } }] }]);
  assert.deepEqual(m.people.map((p) => p.name), ['母', '父', '祖母']);
  assert.deepEqual(m.people[0].records.map((r) => r.when), ['2021-06', '2022-07', '2024', '2025']);
  assert.deepEqual(m.people[0].records[2].v, { sbp: 120 });
});

test('グラフ: 線・点・値の字があり、目盛りの字が切れないよう左の余白を取る', () => {
  const p = SAMPLE.people[0];
  const it = K.itemOf('sbp');
  const pts = K.series(p, 'sbp');
  const svg = K.chartSVG({ item: it, points: pts, lines: K.linesFor(it, p, pts), years: K.yearRange(p), w: 300, h: 250, font: 15, labels: 'all' });
  assert.equal((svg.match(/<circle /g) || []).length, 3);
  assert.equal((svg.match(/class="k-line k-guide"/g) || []).length, 1);
  assert.equal((svg.match(/class="k-line k-refer"/g) || []).length, 1);
  assert.match(svg, /aria-label="収縮期血圧（mmHg）の推移。2021年6月 128、2022年7月 134、2024年 141。線: 保健指導判定値 ≧130、受診勧奨判定値 ≧140"/);
  assert.match(K.chartSVG({ item: it, points: [], lines: [], years: null, w: 300, h: 250, font: 15 }), /記録なし/);
  assert.equal(K.fmt(K.itemOf('ua'), 5), '5.0');
  assert.equal(K.fmt(it, 130), '130');
});

test('グラフ: 点の値の字は縦軸の目盛りの字と重ならない（1・3・10 回、最初の回が 1 月）', () => {
  for (const n of [1, 3, 10]) {
    const recs = [];
    for (let i = 0; i < n; i++) recs.push({ when: (2025 - n + 1 + i) + (i === 0 ? '-01' : '-06'), v: { height: 154.2 + i / 10, waist: 78, sbp: 130 + i } });
    const p = C.normKenshin({ people: [{ name: '', sex: 'f', records: recs }], cur: 0 }).people[0];
    for (const key of ['height', 'waist', 'sbp']) {
      const it = K.itemOf(key), pts = K.series(p, key);
      for (const o of [{ w: 320, h: 150, font: 13, labels: 'last' }, { w: 300, h: 250, font: 15, labels: 'all' }]) {
        const svg = K.chartSVG(Object.assign({ item: it, points: pts, lines: K.linesFor(it, p, pts), years: K.yearRange(p) }, o));
        // 縦軸の目盛りの字（右寄せ。x はどれも同じ）。右端の年の字も右寄せになることがある（Q-490）ので、いちばん左のものを取る
        const tickRight = Math.min(...[...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="end" class="k-muted">/g)].map((m) => Number(m[1])));
        const vals = [...svg.matchAll(/<text x="([\d.]+)" text-anchor="(start|middle|end)" y="[\d.]+" class="k-val">([^<]+)<\/text>/g)];
        assert.ok(vals.length >= 1, n + ' 回 ' + key);
        for (const [, x, a, t] of vals) {
          // 数字 1 字 ＝ 0.6 字幅で見た字の左端
          const left = a === 'start' ? Number(x) : Number(x) - t.length * o.font * 0.6 / (a === 'end' ? 1 : 2);
          assert.ok(left > tickRight, n + ' 回 ' + key + ' ' + t + ': 字の左端 ' + left + ' ＞ 目盛りの右端 ' + tickRight);
        }
      }
    }
  }
});

test('グラフ: 字は図の箱の左右を超えない（10・30・60 回 × 全項目 × 画面と紙、Q-490）', () => {
  // 年が多いと年の幅が字より狭くなり、右端の年の字と最後の点の値の字が図の右へ出ていた（紙の 30 回で 21・60 回で 24）
  const ROWS = [
    [154.2, 52.1, 78.0, 124, 76, 92, 5.5, 128, 66, 98, 21, 17, 24, 72.4, 4.6],
    [153.8, 54.2, 81.0, 131, 80, 98, 5.7, 141, 61, 126, 24, 22, 29, 69.5, 5.0],
    [153.4, 55.1, 82.0, 133, 82, 99, 5.8, 132, 63, 120, 22, 20, 28, 65.0, 5.0],
  ];
  const keys = V.ITEMS.filter((i) => !i.calc).map((i) => i.key);
  let checked = 0;
  for (const n of [10, 30, 60]) {
    const recs = [];
    for (let i = 0; i < n; i++) {
      const v = {};
      keys.forEach((k, j) => { v[k] = ROWS[i % 3][j]; });
      recs.push({ when: (2025 - n + 1 + i) + '-06', v });
    }
    const p = C.normKenshin({ people: [{ name: '', sex: 'f', records: recs }], cur: 0 }).people[0];
    assert.equal(p.records.length, n);
    for (const it of V.ITEMS) {
      const pts = K.series(p, it.key);
      assert.equal(pts.length, n, n + ' 回 ' + it.key + ' の点の数');
      for (const o of [{ w: 320, h: 150, font: 13, labels: 'last' }, { w: 300, h: 250, font: 15, labels: 'all' }]) {
        const svg = K.chartSVG(Object.assign({ item: it, points: pts, lines: K.linesFor(it, p, pts), years: K.yearRange(p) }, o));
        assert.equal((svg.match(/<circle /g) || []).length, n, n + ' 回 ' + it.key + ' の点の数（図）');
        for (const m of svg.matchAll(/<text x="([\d.]+)"(?: y="[\d.]+")? text-anchor="(start|middle|end)"[^>]*>([^<]+)<\/text>/g)) {
          let tw = 0;
          for (const ch of m[3]) tw += ch.charCodeAt(0) > 0xff ? o.font : o.font * 0.6;
          const x = Number(m[1]), l = m[2] === 'start' ? x : m[2] === 'end' ? x - tw : x - tw / 2;
          assert.ok(l >= 0 && l + tw <= o.w, n + ' 回 ' + it.key + ' ' + o.w + ': 「' + m[3] + '」が ' + l.toFixed(1) + '〜' + (l + tw).toFixed(1) + '（箱 0〜' + o.w + '）');
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 0);
});

test('グラフ: 点の値の字は資料の線の名前と重ならない（1・3・10 回 × 全項目 × 画面と紙、Q-394）', () => {
  // 例の 6 行（app.js の「例」と同じ値）を回して 10 回分。1・3 回は後ろから
  const ROWS = [
    [154.2, 52.1, 78.0, 124, 76, 92, 5.5, 128, 66, 98, 21, 17, 24, 72.4, 4.6],
    [154.0, 53.0, 79.5, 128, 78, 95, 5.6, 134, 64, 112, 22, 19, 26, 70.8, 4.8],
    [153.8, 54.2, 81.0, 131, 80, 98, 5.7, 141, 61, 126, 24, 22, 29, 69.5, 5.0],
    [153.7, 54.8, 82.5, 136, 83, 101, 5.8, 146, 60, 138, 25, 24, 31, 67.9, 5.1],
    [153.5, 55.6, 83.0, 138, 84, 104, 5.9, 139, 62, 131, 23, 21, 30, 66.2, 5.2],
    [153.4, 55.1, 82.0, 133, 82, 99, 5.8, 132, 63, 120, 22, 20, 28, 65.0, 5.0],
  ];
  const keys = V.ITEMS.filter((i) => !i.calc).map((i) => i.key);
  // 字の箱（基線から 1.15 字上・0.35 字下。数字・記号 1 字 0.6 字幅、全角 1 字幅。ブラウザの getBoundingClientRect で見た箱に合わせた見積もり）
  const boxOf = (x, a, y, t, f) => {
    let tw = 0;
    for (const ch of t) tw += ch.charCodeAt(0) > 0xff ? f : f * 0.6;
    const l = a === 'start' ? x : a === 'end' ? x - tw : x - tw / 2;
    return { l, r: l + tw, t: y - f * 1.15, b: y + f * 0.35 };
  };
  let n0 = 0;
  for (const n of [1, 3, 10]) {
    const recs = [];
    for (let i = 10 - n; i < 10; i++) {
      const v = {};
      keys.forEach((k, j) => { v[k] = ROWS[i % 6][j]; });
      recs.push({ when: (2015 + i) + '-06', random: i === 2, v });
    }
    const p = C.normKenshin({ people: [{ name: '', sex: 'f', records: recs }], cur: 0 }).people[0];
    for (const it of V.ITEMS) {
      const pts = K.series(p, it.key);
      for (const o of [{ w: 320, h: 150, font: 13, labels: 'last' }, { w: 300, h: 250, font: 15, labels: 'all' }]) {
        const svg = K.chartSVG(Object.assign({ item: it, points: pts, lines: K.linesFor(it, p, pts), years: K.yearRange(p) }, o));
        const vals = [...svg.matchAll(/<text x="([\d.]+)" text-anchor="(start|middle|end)" y="([\d.]+)" class="k-val">([^<]+)<\/text>/g)].map((m) => boxOf(+m[1], m[2], +m[3], m[4], o.font));
        const labels = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(start|end)" class="k-linelabel">([^<]+)<\/text>/g)].map((m) => [m[4], boxOf(+m[1], m[3], +m[2], m[4], o.font)]);
        n0 += labels.length;
        for (const a of vals) for (const [t, b] of labels) {
          const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          assert.ok(!(ox > 1 && oy > 1), n + ' 回 ' + it.key + ' ' + o.w + ': 値の字と線の名前 ' + t + ' が重なる');
        }
      }
    }
  }
  assert.ok(n0 > 0);
});

test('画面と紙に「異常」「正常」・医療の NG 語・判定の文を出さない', () => {
  const NG = /異常|正常|診断|改善|予防|効果|治る|若返/;
  for (const f of ['kenshin/index.html', 'kenshin/guide.html', 'kenshin/app.js', 'kenshin/kenshin-calc.js', 'kenshin/kenshin-values.js']) {
    // 画面に出る文字だけを見る（コメントと、meta の属性・JSON-LD は除く。meta の description には検索語の「健康診断」がある）
    let s = read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, '');
    if (f.endsWith('.html')) s = s.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '').replace(/<meta [^>]*>/g, '');
    assert.doesNotMatch(s, NG, f);
    assert.doesNotMatch(s, /超えています|下回っています|要注意|注意が必要|高めです|低めです/, f);
  }
  assert.doesNotMatch(allCharts(SAMPLE), NG);
  assert.doesNotMatch(K.buildCSV(SAMPLE), NG);
});

test('定型文「医療の検査ではありません」が結果（#result-card）より前にあり、印刷する紙にも入る', () => {
  const html = read('kenshin/index.html');
  const at = html.indexOf('これは健診の結果を並べて見る道具で、医療の検査ではありません。');
  assert.ok(at > 0 && at < html.search(/\sid="result-card"/));
  assert.ok(html.indexOf('このページは広告なし・登録なし・入力は端末の外に出ません。') < at);
  assert.match(read('kenshin/app.js'), /医療の検査ではありません。/);
  const g = read('kenshin/guide.html');
  assert.ok(g.indexOf('医療の検査ではありません') < g.indexOf('id="howto"'));
});

test('保存のキーは otasuke_kenshin。バックアップ（common.js）に入り、消すボタンがある', () => {
  assert.match(read('common.js'), /var KEYS = \[[^\]]*'kenshin'/);
  assert.match(read('common.js'), /kenshin: Calc\.normKenshin/);
  assert.match(read('kenshin/app.js'), /var KEY = 'kenshin';/);
  assert.match(read('kenshin/index.html'), /data-reset-storage="otasuke_kenshin"/);
  assert.match(read('kenshin/index.html'), /キー <code>otasuke_kenshin<\/code>/);
  // 外部のライブラリ・外への送信を使わない
  for (const f of ['kenshin/app.js', 'kenshin/kenshin-calc.js']) assert.doesNotMatch(read(f), /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|import\(/, f);
  assert.doesNotMatch(read('kenshin/index.html'), /<script[^>]+src="https?:\/\/(?!static\.cloudflareinsights\.com)/);
});

// --- 図の上で回を選ぶ（Q-580）。画面だけ。紙は pick を渡さないので、縦の線も選んだ値も出ない ---
const pickKeys = V.ITEMS.filter((i) => !i.calc).map((i) => i.key);
function pickPerson(whens, valueOf) {
  const recs = whens.map((when, i) => {
    const v = {};
    pickKeys.forEach((k, j) => { const x = valueOf(i, k, j); if (x !== undefined) v[k] = x; });
    return { when, v };
  });
  return C.normKenshin({ people: [{ name: '', sex: 'f', records: recs }], cur: 0 }).people[0];
}
const pickSvg = (p, it, pick, o) => {
  const pts = K.series(p, it.key);
  return K.chartSVG(Object.assign({ item: it, points: pts, lines: K.linesFor(it, p, pts), years: K.yearRange(p), w: 320, h: 150, font: 13, labels: 'last', pick }, o));
};
const attrOf = (svg, name) => Number(new RegExp(' data-' + name + '="([0-9.]+)"').exec(svg)[1]);

test('回を選ぶ: 押した横の位置 → いちばん近い回（回 10 の記録で 5 通り。同じ近さなら古いほう）', () => {
  const whens = [];
  for (let y = 2015; y <= 2024; y++) whens.push(y + '-06');
  const p = pickPerson(whens, () => 1);
  const t = (y, m) => y + (m - 0.5) / 12;   // 年の目盛りの上の位置
  assert.equal(K.nearestWhen(p.records, t(2015, 1)), '2015-06');
  assert.equal(K.nearestWhen(p.records, t(2018, 6)), '2018-06');
  assert.equal(K.nearestWhen(p.records, 2019.2), '2019-06');   // 2019 年の 1 月ごろ → 2019-06 の方が 2018-06 より近い
  assert.equal(K.nearestWhen(p.records, 2022.55), '2022-06');
  assert.equal(K.nearestWhen(p.records, 2030), '2024-06');
  // 同じ近さ（2 回のまんなか）は古いほう
  assert.equal(K.nearestWhen(p.records.slice(0, 2), (K.whenT('2015-06') + K.whenT('2016-06')) / 2), '2015-06');
  assert.equal(K.nearestWhen([], 2020), '');
});

test('回を選ぶ: 全項目の縦の線の横の位置 ＝ その回の X(t)（点の横と同じ）。図の箱は Tab で 1 つ止まる', () => {
  const p = pickPerson(['2016-03', '2019-10', '2022-06'], (i, k, j) => 50 + i * 7 + j);
  for (const pick of ['2016-03', '2019-10', '2022-06']) {
    for (const it of V.ITEMS) {
      const svg = pickSvg(p, it, pick);
      const lines = [...svg.matchAll(/<line x1="([\d.]+)" x2="([\d.]+)" y1="[\d.]+" y2="[\d.]+" class="k-sel"\/>/g)];
      assert.equal(lines.length, 1, it.key + ' ' + pick + ': 縦の線は 1 本');
      assert.equal(lines[0][1], lines[0][2]);
      const x = attrOf(svg, 'pl') + (K.whenT(pick) - attrOf(svg, 'x0')) / (attrOf(svg, 'x1') - attrOf(svg, 'x0')) * attrOf(svg, 'pw');
      assert.ok(Math.abs(Number(lines[0][1]) - x) <= 0.1, it.key + ' ' + pick + ': ' + lines[0][1] + ' ≒ ' + x);
      // 点があれば、点の横と同じ
      const k = K.series(p, it.key).findIndex((q) => q.when === pick);
      const cx = [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => m[1]);
      if (k >= 0) assert.equal(cx[k], lines[0][1], it.key);
      assert.equal((svg.match(/tabindex="0"/g) || []).length, 1, it.key + ': Tab の止まりは図ごとに 1 つ');
    }
  }
});

test('回を選ぶ: 出る値 ＝ series のその回の値（15 項目 × 3 回。無い項目は値なし。判定の言葉なし）', () => {
  // 3 回目の身長と 2 回目の腹囲は無い
  const p = pickPerson(['2018-06', '2020-06', '2023-06'], (i, k, j) => (k === 'height' && i === 2) || (k === 'waist' && i === 1) ? undefined : 80 + i * 3 + j / 2);
  for (const pick of ['2018-06', '2020-06', '2023-06']) {
    for (const it of V.ITEMS) {
      const svg = pickSvg(p, it, pick);
      const shown = [...svg.matchAll(/class="k-val">([^<]+)<\/text>/g)].map((m) => m[1]);
      const pt = K.series(p, it.key).find((q) => q.when === pick);
      assert.deepEqual(shown, pt ? [K.fmt(it, pt.y)] : [], it.key + ' ' + pick);
    }
  }
  assert.equal(V.ITEMS.length, 16);   // 身長・体重・BMI ほか。BMI は身長と体重が揃う回だけ
});

test('回を選ぶ: 紙（pick なし）は縦の線も Tab の止まりも data も出さず、前と同じ字', () => {
  const p = pickPerson(['2018-06', '2020-06'], (i, k, j) => 60 + i + j);
  for (const it of V.ITEMS) {
    const svg = pickSvg(p, it, undefined, { w: 300, h: 250, font: 15, labels: 'all' });
    assert.doesNotMatch(svg, /k-sel|tabindex|data-/, it.key);
  }
  // 画面と紙で図の組み立ては同じ関数。紙は app.js の renderSheet が pick を渡さない
  const app = read('kenshin/app.js');
  assert.match(app, /labels: 'all' \}\)/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderSheet')), /pick/);
});

test('回を選ぶ: 記録が 0・1 回でも落ちない。60 回でも値の字は図の外へ出ない（画面・390 と 1,280 の図の幅）', () => {
  assert.doesNotThrow(() => K.chartSVG({ item: K.itemOf('sbp'), points: [], lines: [], years: null, w: 320, h: 150, font: 13, pick: '' }));
  const one = pickPerson(['2024-06'], () => 120);
  assert.doesNotThrow(() => V.ITEMS.forEach((it) => pickSvg(one, it, '2024-06')));
  const whens = [];
  for (let i = 0; i < 60; i++) whens.push((2018 + Math.floor(i / 12)) + '-' + String(i % 12 + 1).padStart(2, '0'));
  const p = pickPerson(whens, (i, k, j) => 90 + (i * (j + 3)) % 40);
  for (const w of [320, 300]) for (const it of V.ITEMS) for (const pick of [whens[0], whens[30], whens[59]]) {
    const svg = pickSvg(p, it, pick, { w, font: w === 320 ? 13 : 15, h: w === 320 ? 150 : 250 });
    for (const m of svg.matchAll(/<text x="([\d.]+)" text-anchor="(start|middle|end)" y="([\d.]+)" class="k-val">([^<]+)<\/text>/g)) {
      const f = w === 320 ? 13 : 15, tw = m[4].length * f * 0.62;
      const l = m[2] === 'start' ? +m[1] : m[2] === 'end' ? +m[1] - tw : +m[1] - tw / 2;
      assert.ok(l >= 0 && l + tw <= w, it.key + ' ' + pick + ' ' + m[4] + ': ' + l + '〜' + (l + tw));
    }
  }
});

test('回を選ぶ: 選んだ年月は図の上に 1 か所（whenLabel の形）、保存しない。使い方に 1 文、更新履歴に 1 行', () => {
  const app = read('kenshin/app.js');
  assert.match(app, /\$\('pick-when'\)\.textContent = pick \? K\.whenLabel\(pick\)/);
  assert.equal((read('kenshin/index.html').match(/id="pick-when"/g) || []).length, 1);
  assert.ok(read('kenshin/index.html').indexOf('id="pick-when"') < read('kenshin/index.html').indexOf('id="charts"'));
  assert.doesNotMatch(app, /store\.set\([^)]*selWhen|selWhen[^;\n]*save\(/);
  const g = read('kenshin/guide.html');
  assert.ok(g.indexOf('<p>図を押すと、その回の値がすべての図に出ます。</p>') > g.indexOf('</ol>'));
  assert.ok(g.indexOf('<p>図を押すと、その回の値がすべての図に出ます。</p>') < g.indexOf('グラフの線（保健指導判定値'));
  assert.match(g, /<time datetime="2026-11-21">2026-11-21<\/time> 図の上で回を選べるようにした/);
});
