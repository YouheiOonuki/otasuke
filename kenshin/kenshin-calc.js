// ===========================
// 健診結果の経年グラフ — 画面から切り離した関数（DOM・localStorage に触らない）
// BMI、項目ごとの点の列、引く線の選び方、CSV の書き出し・読み込み、グラフの SVG（外部のライブラリは使わない）
// ブラウザでは window.KenshinCalc（../calc.js と ./kenshin-values.js のあとに読む）、Node では module.exports
// ===========================
(function (root) {
  'use strict';
  var Calc = typeof module !== 'undefined' && module.exports ? require('../calc.js') : root.Calc;
  var V = typeof module !== 'undefined' && module.exports ? require('./kenshin-values.js') : root.KenshinValues;

  function round1(n) { return Math.round(n * 10) / 10; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function itemOf(key) { for (var i = 0; i < V.ITEMS.length; i++) if (V.ITEMS[i].key === key) return V.ITEMS[i]; return null; }

  /** BMI ＝ 体重（kg）÷ 身長（m）の 2 乗。小数 1 桁。どちらかが無ければ null */
  function bmi(heightCm, weightKg) {
    if (!(heightCm > 0) || !(weightKg > 0)) return null;
    var m = heightCm / 100;
    return round1(weightKg / (m * m));
  }

  /** 'YYYY' / 'YYYY-MM' → 年の中の位置（月が無ければ年の真ん中） */
  function whenT(when) {
    var y = Number(when.slice(0, 4)), m = when.length > 4 ? Number(when.slice(5, 7)) : 0;
    return y + (m ? (m - 0.5) / 12 : 0.5);
  }
  function whenLabel(when) { return when.slice(0, 4) + '年' + (when.length > 4 ? Number(when.slice(5, 7)) + '月' : ''); }

  /** 1 人の、1 項目の点の列（古い順）。BMI はその回の身長と体重から */
  function series(person, key) {
    var out = [];
    person.records.forEach(function (r) {
      var y = key === 'bmi' ? bmi(r.v.height, r.v.weight) : r.v[key];
      if (y === null || y === undefined) return;
      // 白抜きの点（随時の採血）は、空腹時か随時かで値の意味が変わる 2 項目だけ
      out.push({ when: r.when, t: whenT(r.when), y: y, random: r.random && (key === 'tg' || key === 'fbs') });
    });
    return out;
  }

  /** 線の名前（資料の語）。full は凡例、short はグラフの中に書く短い字 */
  function lineText(item, l) {
    var v = l.v + (l.star ? '＊' : '');
    if (l.kind === 'strat') {
      var what = item.key === 'waist' ? '腹囲 ' + V.SEX[l.sex] + l.v + 'cm以上' : 'BMI' + l.op + l.v;
      return { full: V.KINDS.strat + '（' + what + '）', short: l.v + (l.sex ? '（' + V.SEX[l.sex] + '）' : '') };
    }
    var when = l.when ? '（' + V.WHEN[l.when] + '中性脂肪）' : '';
    return { full: V.KINDS[l.kind] + when + ' ' + l.op + v, short: v + (l.when ? '（' + V.WHEN[l.when] + '）' : '') };
  }

  /**
   * この人のこの項目に引く線。腹囲は性別（選んでいなければ男女とも）、中性脂肪は採血が空腹時か随時か
   * （記録に無い方の線は引かない。どちらも無ければ空腹時）
   */
  function linesFor(item, person, points) {
    return item.lines.filter(function (l) {
      if (l.sex && person.sex) return l.sex === person.sex;
      if (l.when) {
        var hasR = points.some(function (p) { return p.random; });
        var hasF = points.some(function (p) { return !p.random; }) || !points.length;
        return l.when === 'random' ? hasR : hasF;
      }
      return true;
    }).map(function (l) {
      var t = lineText(item, l);
      // 随時血糖の判定値は資料で空腹時血糖と同じ値（≧100・≧126）
      if (item.key === 'fbs' && points.some(function (p) { return p.random; })) t.full += '（随時血糖も同じ値）';
      return { kind: l.kind, v: l.v, op: l.op, full: t.full, short: t.short };
    });
  }

  /** グラフの横の範囲（この人の記録の最初の年〜最後の年。全項目でそろえる） */
  function yearRange(person) {
    if (!person.records.length) return null;
    var y0 = Number(person.records[0].when.slice(0, 4)), y1 = Number(person.records[person.records.length - 1].when.slice(0, 4));
    return [y0, y1];
  }

  /** 目盛り: lo〜hi を 1・2・2.5・5 × 10^k の刻みで n 個前後に */
  function niceTicks(lo, hi, n) {
    if (hi <= lo) { hi = lo + 1; }
    var raw = (hi - lo) / Math.max(1, n);
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var steps = [1, 2, 2.5, 5, 10];
    var step = p * 10;
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= raw) { step = steps[i] * p; break; }
    var a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    var out = [];
    for (var x = a; x <= b + step / 1e6; x += step) out.push(Math.round(x * 1000) / 1000);
    return { lo: a, hi: b, step: step, ticks: out };
  }

  /**
   * 1 項目のグラフ（SVG の文字列）。色は class で決める（画面は style.css のトークン、印刷は白黒）
   * o: { item, points, lines, years:[y0,y1], w, h, font, labels:'all'|'last' }
   */
  /** 値の字（小数の項目は 5.0 のように 1 桁を残す） */
  function fmt(item, v) { return item.step < 1 ? Number(v).toFixed(1) : String(v); }

  function chartSVG(o) {
    var w = o.w, h = o.h, f = o.font;
    var item = o.item, pts = o.points, lines = o.lines;
    var title = item.name + '（' + item.unit + '）';
    var label = title + 'の推移。' + (pts.length ? pts.map(function (p) { return whenLabel(p.when) + ' ' + fmt(item, p.y); }).join('、') : '記録なし') +
      (lines.length ? '。線: ' + lines.map(function (l) { return l.full; }).join('、') : '');
    var s = '<svg class="kchart" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(label) + '" font-size="' + f + '">';
    if (!o.years) {
      return s + '<text x="' + w / 2 + '" y="' + h / 2 + '" text-anchor="middle" class="k-muted">記録なし</text></svg>';
    }
    // 縦の範囲: 点と線がすべて入るように
    var vals = pts.map(function (p) { return p.y; }).concat(lines.map(function (l) { return l.v; }));
    var lo, hi;
    if (vals.length) { lo = Math.min.apply(null, vals); hi = Math.max.apply(null, vals); } else { lo = 0; hi = 1; }
    var pad = (hi - lo) * 0.08 || Math.max(1, Math.abs(hi) * 0.05);
    var nt = niceTicks(lo - pad, hi + pad, h >= 150 ? 4 : 3);
    // 左の余白は目盛りの字の長さに合わせる（154.25 などが切れないように）
    var longest = Math.max.apply(null, nt.ticks.map(function (v) { return String(v).length; }));
    var padL = Math.round(f * (0.6 * longest + 0.6)), padR = Math.round(f * 0.6), padT = Math.round(f * 0.9), padB = Math.round(f * 1.7);
    var pw = w - padL - padR, ph = h - padT - padB;
    var X0 = o.years[0], X1 = o.years[1] + 1;
    function X(t) { return padL + (t - X0) / (X1 - X0) * pw; }
    function Y(v) { return padT + (nt.hi - v) / (nt.hi - nt.lo) * ph; }
    function n2(v) { return Math.round(v * 10) / 10; }
    // 目盛りと格子
    nt.ticks.forEach(function (v) {
      var y = n2(Y(v));
      s += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y + '" y2="' + y + '" class="k-grid"/>';
      s += '<text x="' + (padL - 3) + '" y="' + n2(y + f * 0.35) + '" text-anchor="end" class="k-muted">' + v + '</text>';
    });
    var years = X1 - X0, maxLabels = Math.max(1, Math.floor(pw / (f * 2.6)));
    var every = Math.ceil(years / maxLabels);
    for (var yr = X0; yr < X1; yr++) {
      var x = n2(X(yr + 0.5));
      s += '<line x1="' + n2(X(yr)) + '" x2="' + n2(X(yr)) + '" y1="' + padT + '" y2="' + (padT + ph) + '" class="k-grid"/>';
      if ((X1 - 1 - yr) % every === 0) s += '<text x="' + x + '" y="' + (h - f * 0.45) + '" text-anchor="middle" class="k-muted">' + yr + '</text>';
    }
    s += '<rect x="' + padL + '" y="' + padT + '" width="' + pw + '" height="' + ph + '" class="k-frame"/>';
    // 線（資料の値）。値の字は線の右端の上。近い線の字が重なるときは、下の線の字を線の下に
    var placed = [];
    lines.slice().sort(function (a, b) { return b.v - a.v; }).forEach(function (l) {
      var y = n2(Y(l.v));
      s += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y + '" y2="' + y + '" class="k-line k-' + l.kind + '"' +
        (l.kind === 'guide' ? ' stroke-dasharray="' + n2(f * 0.55) + ' ' + n2(f * 0.35) + '"' : l.kind === 'strat' ? ' stroke-dasharray="' + n2(f * 0.18) + ' ' + n2(f * 0.3) + '"' : '') + '/>';
      var ty = n2(y - f * 0.25);
      if (placed.some(function (q) { return Math.abs(q - ty) < f * 1.05; })) ty = n2(y + f * 0.95);
      placed.push(ty);
      s += '<text x="' + (w - padR - 2) + '" y="' + ty + '" text-anchor="end" class="k-linelabel">' + esc(l.short) + '</text>';
    });
    // 点と折れ線
    if (pts.length > 1) {
      s += '<polyline class="k-data" points="' + pts.map(function (p) { return n2(X(p.t)) + ',' + n2(Y(p.y)); }).join(' ') + '"/>';
    }
    pts.forEach(function (p, i) {
      var cx = n2(X(p.t)), cy = n2(Y(p.y));
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + n2(f * 0.32) + '" class="k-pt' + (p.random ? ' k-random' : '') + '"/>';
      var show = o.labels === 'all' ? pts.length <= 6 || i === 0 || i === pts.length - 1 : i === pts.length - 1;
      if (show) {
        // 点の上に値。上が詰まるときは下に
        var above = cy - f * 0.6 > padT + f * 0.4;
        s += '<text x="' + cx + '" y="' + n2(above ? cy - f * 0.55 : cy + f * 1.15) + '" text-anchor="middle" class="k-val">' + fmt(item, p.y) + '</text>';
      }
    });
    return s + '</svg>';
  }

  // --- CSV（表計算ソフトで開ける。1 行 ＝ 1 人の 1 回） ---
  var CSV_HEAD = ['名前', '性別', '受けた年月', '採血'].concat(V.ITEMS.filter(function (i) { return !i.calc; }).map(function (i) { return i.name + '(' + i.unit + ')'; }));
  var CSV_KEYS = V.ITEMS.filter(function (i) { return !i.calc; }).map(function (i) { return i.key; });

  function csvCell(v) {
    v = String(v == null ? '' : v);
    // 表計算ソフトで式として動かないように（= + - @ で始まる文字は先頭に ' を付ける。数は付けない）
    if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v;
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  /** 全員の記録を CSV に（先頭に BOM。Excel で文字化けしないように） */
  function buildCSV(data) {
    var lines = [CSV_HEAD.map(csvCell).join(',')];
    data.people.forEach(function (p, i) {
      var name = p.name || (i + 1) + '人目';
      p.records.forEach(function (r) {
        lines.push([name, p.sex ? V.SEX[p.sex] : '', r.when, r.random ? '随時' : '空腹時']
          .concat(CSV_KEYS.map(function (k) { return r.v[k] === undefined ? '' : r.v[k]; })).map(csvCell).join(','));
      });
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function parseCSVRows(text) {
    var rows = [], row = [], cell = '', q = false, i = 0;
    text = String(text).replace(/^﻿/, '');
    for (; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function toHalf(s) {
    return String(s).replace(/[０-９．－／]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).trim();
  }
  /** 「2025-06」「2025/6」「2025年6月」「2025」「2025-06-12」→ 'YYYY' / 'YYYY-MM' */
  function parseWhen(s) {
    var m = /^(\d{4})(?:\s*[-/年.]\s*(\d{1,2})(?:\s*[-/月.]\s*\d{1,2}\s*日?|\s*月)?)?\s*年?$/.exec(toHalf(s));
    if (!m) return '';
    return Calc.kenshinWhen(m[1] + (m[2] ? '-' + (m[2].length < 2 ? '0' : '') + m[2] : ''));
  }
  // 見出しの名前 → 列。単位の括弧は外して比べる（自分で作った表の「LDL」「γ-GTP」なども拾う）
  var ALIAS = {
    name: ['名前', '氏名'], sex: ['性別'], when: ['受けた年月', '受けた日', '年月', '受診日', '健診日', '年'], random: ['採血'],
    height: ['身長'], weight: ['体重'], waist: ['腹囲'], sbp: ['収縮期血圧', '最高血圧', '血圧(上)'], dbp: ['拡張期血圧', '最低血圧', '血圧(下)'],
    fbs: ['空腹時血糖', '血糖'], hba1c: ['hba1c(ngsp)', 'hba1c'], ldl: ['ldlコレステロール', 'ldl'], hdl: ['hdlコレステロール', 'hdl'], tg: ['中性脂肪', 'tg'],
    ast: ['ast(got)', 'ast', 'got'], alt: ['alt(gpt)', 'alt', 'gpt'], ggt: ['γ-gt(γ-gtp)', 'γ-gt', 'γ-gtp', 'γgtp'], egfr: ['egfr'], ua: ['尿酸'],
  };
  function headKey(h) {
    var x = toHalf(h).toLowerCase().replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/\s/g, '');
    var bare = x.replace(/\((cm|kg|mmhg|mg\/dl|%|u\/l|ml\/min\/1\.73m²|ml\/min\/1\.73m2)\)$/, '');
    for (var k in ALIAS) if (ALIAS[k].indexOf(bare) >= 0 || ALIAS[k].indexOf(x) >= 0) return k;
    return null;
  }

  /**
   * CSV を読む。返り値 { ok, people:[{name, sex, records}], count, errors:[文] }。
   * 読めない数（範囲の外・数でない）はその欄だけ捨てて、何行目のどの欄かを errors に入れる
   */
  function parseCSV(text) {
    // 空の行は飛ばす（行番号は表計算ソフトの行のまま数える）
    var rows = parseCSVRows(text).map(function (r, n) { r.line = n + 1; return r; }).filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
    if (!rows.length) return { ok: false, error: '中身が空です。' };
    var cols = rows[0].map(headKey);
    if (cols.indexOf('when') < 0) return { ok: false, error: '1 行目に「受けた年月」の列がありません。この画面の「CSV に書き出す」で作った形にしてください。' };
    var byName = {}, people = [], errors = [], count = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], o = { v: {} };
      cols.forEach(function (k, j) { if (k) o[k] = (r[j] || '').trim(); });
      var when = parseWhen(o.when || '');
      if (!when) { errors.push(r.line + ' 行目: 受けた年月「' + String(o.when || '').slice(0, 20) + '」が読めないので、この行を飛ばしました'); continue; }
      var name = String(o.name || '').slice(0, 20);
      if (!byName.hasOwnProperty(name)) {
        byName[name] = people.length;
        var sex = o.sex === '男性' || o.sex === '男' ? 'm' : o.sex === '女性' || o.sex === '女' ? 'f' : '';
        people.push({ name: name, sex: sex, records: [] });
      }
      var rec = { when: when, random: /随時/.test(o.random || ''), v: {} };
      CSV_KEYS.forEach(function (k) {
        if (o[k] === undefined || o[k] === '') return;
        var n = Calc.kenshinNum(k, toHalf(o[k]).replace(/,/g, ''));
        if (n === null) errors.push(r.line + ' 行目: ' + itemOf(k).name + '「' + o[k].slice(0, 12) + '」は読めないので空にしました');
        else rec.v[k] = n;
      });
      people[byName[name]].records.push(rec);
      count++;
    }
    if (!count) return { ok: false, error: '読める行がありませんでした。' + (errors[0] || '') };
    return { ok: true, people: people, count: count, errors: errors };
  }

  /**
   * 読み込んだ人を今の記録に足す。名前が同じ人に足し（同じ年月は置き換え）、ほかは新しい人に。
   * 名前の無い人は、いま開いている人に足す
   */
  function mergeImport(data, people) {
    var d = JSON.parse(JSON.stringify(data));
    people.forEach(function (p) {
      var idx = -1;
      if (p.name) { for (var i = 0; i < d.people.length; i++) if (d.people[i].name === p.name) { idx = i; break; } }
      else idx = d.cur;
      if (idx < 0) {
        // 名前の無い 1 人目しかいなくて記録も無いなら、その人に名前を付けて使う
        var only = d.people.length === 1 && !d.people[0].name && !d.people[0].records.length;
        if (only) { idx = 0; d.people[0].name = p.name; }
        else { d.people.push({ name: p.name, sex: p.sex, records: [] }); idx = d.people.length - 1; }
      }
      var t = d.people[idx];
      if (!t.sex && p.sex) t.sex = p.sex;
      p.records.forEach(function (r) {
        t.records = t.records.filter(function (x) { return x.when !== r.when; });
        t.records.push(r);
      });
    });
    return Calc.normKenshin(d);
  }

  var api = {
    bmi: bmi, whenT: whenT, whenLabel: whenLabel, series: series, lineText: lineText, linesFor: linesFor, yearRange: yearRange, niceTicks: niceTicks,
    chartSVG: chartSVG, fmt: fmt, buildCSV: buildCSV, parseCSV: parseCSV, parseCSVRows: parseCSVRows, parseWhen: parseWhen, mergeImport: mergeImport,
    CSV_HEAD: CSV_HEAD, CSV_KEYS: CSV_KEYS, itemOf: itemOf, esc: esc,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KenshinCalc = api;
})(this);
