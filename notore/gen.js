// ===========================
// 脳トレプリント — 問題を作る関数と、用紙の HTML を組み立てる関数（DOM・localStorage に触らない）
// tests/notore.test.js から node --test で確かめる。ブラウザでは window.NotoreGen、Node では module.exports
// 同じ「問題番号（seed）」と同じ設定からは、いつでも同じプリントができる（乱数は Math.random を使わない）。
// 乱数・問題番号の形は gakushu-print（学習プリントメーカー）の calc.js と同じ
// ===========================
(function (root) {
  'use strict';

  // ---------------------------------------------------------------
  // 乱数（seed つき）
  // ---------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** seed と用途の番号（ページ番号など）を混ぜて、別の 32bit の種にする */
  function mixSeed(seed, salt) {
    var h = ((seed >>> 0) ^ Math.imul((salt | 0) + 1, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function makeRng(seed, salt) {
    var r = mulberry32(mixSeed(seed, salt || 0));
    return {
      next: r,
      int: function (lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); },
      pick: function (a) { return a[Math.floor(r() * a.length)]; },
      shuffle: function (a) {
        a = a.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(r() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
    };
  }
  /** 問題番号（seed を 5 桁-5 桁で。電話で伝えやすい形） */
  function seedLabel(seed) {
    var s = String(seed >>> 0);
    while (s.length < 10) s = '0' + s;
    return s.slice(0, 5) + '-' + s.slice(5);
  }
  /** 「12345-67890」や全角・空白まじりの入力を seed に。読めなければ null */
  function parseSeedLabel(text) {
    var s = String(text || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[\s\-‐－ー—]/g, '');
    if (!/^\d{1,10}$/.test(s)) return null;
    var n = Number(s);
    return n <= 4294967295 ? n : null;
  }

  var LEVELS = ['easy', 'normal', 'hard'];
  var LEVEL_NAMES = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };
  var KINDS = ['calc', 'kanji', 'machigai', 'cross', 'nurie'];
  var KIND_NAMES = { calc: '計算', kanji: '漢字の読み', machigai: '間違い探し', cross: 'かなクロスワード', nurie: '塗り絵カレンダー' };
  var OPS = ['mix', 'add', 'sub', 'mul', 'div'];
  var OP_NAMES = { mix: 'まぜる', add: 'たし算', sub: 'ひき算', mul: 'かけ算', div: 'わり算' };
  var SALT = { calc: 1, kanji: 2, machigai: 3, cross: 4, nurie: 5 };

  // ---------------------------------------------------------------
  // 計算（1 枚 20 問。答えは 0 以上の整数、わり算は割り切れるものだけ）
  // ---------------------------------------------------------------
  var CALC_PER_PAGE = 20;
  // むずかしさごとの数の範囲
  var CALC_RANGE = {
    easy: { add: [[1, 9], [1, 9]], sub: [[2, 18], [1, 9]], mul: [[2, 9], [1, 9]], div: [[2, 9], [1, 9]] },                 // 1 けた（九九の範囲）
    normal: { add: [[10, 99], [2, 99]], sub: [[20, 99], [2, 99]], mul: [[11, 29], [2, 9]], div: [[2, 9], [11, 19]] },     // 2 けた
    hard: { add: [[100, 999], [11, 999]], sub: [[200, 999], [11, 999]], mul: [[21, 99], [3, 9]], div: [[3, 9], [21, 99]] }, // 3 けた・2 けた×1 けた
  };
  function calcOne(level, op, rng) {
    var R = CALC_RANGE[level][op];
    var a, b;
    if (op === 'add') { a = rng.int(R[0][0], R[0][1]); b = rng.int(R[1][0], R[1][1]); return { a: a, op: '+', b: b, ans: a + b }; }
    if (op === 'sub') {
      a = rng.int(R[0][0], R[0][1]); b = rng.int(R[1][0], Math.min(R[1][1], a - 1));
      return { a: a, op: '−', b: b, ans: a - b };
    }
    if (op === 'mul') { a = rng.int(R[0][0], R[0][1]); b = rng.int(R[1][0], R[1][1]); return { a: a, op: '×', b: b, ans: a * b }; }
    // わり算: 割る数 × 商 から作る（割り切れる）
    b = rng.int(R[0][0], R[0][1]); var q = rng.int(R[1][0], R[1][1]);
    return { a: b * q, op: '÷', b: b, ans: q };
  }
  function calcPage(level, op, rng) {
    var out = [], seen = {};
    var ops = op === 'mix' ? ['add', 'sub', 'mul', 'div'] : [op];
    for (var i = 0, guard = 0; out.length < CALC_PER_PAGE && guard < 2000; guard++) {
      var o = op === 'mix' ? ops[i % 4] : op;   // まぜるは 4 つを順に（並びはあとで混ぜる）
      var p = calcOne(level, o, rng);
      var key = p.a + p.op + p.b;
      if (seen[key]) continue;
      seen[key] = true; out.push(p); i++;
    }
    return op === 'mix' ? rng.shuffle(out) : out;
  }

  // ---------------------------------------------------------------
  // 漢字の読み（1 枚 20 問。1 回の印刷では、語が一巡するまで同じ語を出さない）
  // ---------------------------------------------------------------
  var KANJI_PER_PAGE = 20;
  function kanjiPages(level, pages, seed, words) {
    var pool = words[level] || [];
    var rng = makeRng(seed, SALT.kanji * 100);
    var order = rng.shuffle(pool);
    var out = [], k = 0;
    for (var p = 0; p < pages; p++) {
      var page = [], used = {};
      while (page.length < KANJI_PER_PAGE && page.length < pool.length) {
        if (k >= order.length) { order = rng.shuffle(pool); k = 0; }
        var w = order[k++];
        if (used[w[0]]) continue;
        used[w[0]] = true;
        page.push({ word: w[0], reading: w[1], alt: w[2] || '' });
      }
      out.push(page);
    }
    return out;
  }

  // ---------------------------------------------------------------
  // 間違い探し（図形を並べた絵を 2 つ。下の絵だけ N か所を変える）
  // ---------------------------------------------------------------
  var SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'cross', 'hexagon', 'heart'];
  var SHAPE_NAMES = { circle: '丸', square: '四角', triangle: '三角', star: '星', diamond: 'ひし形', cross: '十字', hexagon: '六角形', heart: 'ハート' };
  var FILLS = { easy: ['white', 'black', 'stripe'], normal: ['white', 'black', 'stripe'], hard: ['white', 'black', 'stripe', 'dot'] };
  var FILL_NAMES = { white: '白', black: '黒', stripe: 'しま', dot: '水玉' };
  var MACHIGAI = {
    easy: { cols: 4, rows: 3, diffs: 3, size: [0.62, 0.78], types: ['remove', 'shape', 'fill'] },
    normal: { cols: 5, rows: 4, diffs: 5, size: [0.55, 0.75], types: ['remove', 'shape', 'fill', 'add', 'size'] },
    hard: { cols: 7, rows: 5, diffs: 7, size: [0.5, 0.72], types: ['remove', 'shape', 'fill', 'add', 'size'] },
  };
  var PANEL_W = 182, PANEL_H = 104;   // mm
  function machigai(level, rng) {
    var M = MACHIGAI[level];
    var n = M.cols * M.rows;
    var cw = PANEL_W / M.cols, ch = PANEL_H / M.rows;
    var top = [];
    var empties = rng.shuffle(range(n)).slice(0, Math.max(1, Math.round(n * 0.1)));
    for (var i = 0; i < n; i++) {
      var col = i % M.cols, row = Math.floor(i / M.cols);
      var base = Math.min(cw, ch);
      var s = base * (M.size[0] + rng.next() * (M.size[1] - M.size[0]));
      var jx = (cw - s) / 2 * 0.8 * (rng.next() * 2 - 1), jy = (ch - s) / 2 * 0.8 * (rng.next() * 2 - 1);
      top.push({
        empty: empties.indexOf(i) >= 0,
        shape: rng.pick(SHAPES), fill: rng.pick(FILLS[level]),
        x: col * cw + cw / 2 + jx, y: row * ch + ch / 2 + jy, s: s,
        rot: level === 'easy' ? 0 : rng.pick([0, 0, 15, 30, 45]),
      });
    }
    var bottom = top.map(function (c) { return Object.assign({}, c); });
    // 変える場所: 空のマスは「足す」にだけ使う。ほかは図形のあるマスから
    var filled = rng.shuffle(range(n).filter(function (i) { return !top[i].empty; }));
    var emptyList = range(n).filter(function (i) { return top[i].empty; });
    var diffs = [];
    var types = M.types;
    for (var d = 0; d < M.diffs; d++) {
      var type = types[d % types.length];
      if (type === 'add') {
        if (!emptyList.length) type = 'shape';
        else {
          var ei = emptyList.shift();
          bottom[ei].empty = false;
          diffs.push({ i: ei, type: 'add' });
          continue;
        }
      }
      var ci = filled.shift();
      var b = bottom[ci];
      if (type === 'remove') b.empty = true;
      else if (type === 'shape') b.shape = rng.pick(SHAPES.filter(function (x) { return x !== b.shape; }));
      else if (type === 'fill') b.fill = rng.pick(FILLS[level].filter(function (x) { return x !== b.fill; }));
      else if (type === 'size') b.s = b.s * 0.55;
      diffs.push({ i: ci, type: type });
    }
    diffs.sort(function (a, c) { return a.i - c.i; });
    return { cols: M.cols, rows: M.rows, cw: cw, ch: ch, top: top, bottom: bottom, diffs: diffs };
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  /** 図形の SVG（中心 0,0・大きさ s） */
  function shapeSvg(c, fillRef) {
    var s = c.s, h = s / 2, pts, p;
    var attr = ' fill="' + fillRef + '" stroke="#000" stroke-width="0.6" stroke-linejoin="round"';
    var tr = ' transform="translate(' + f2(c.x) + ' ' + f2(c.y) + ')' + (c.rot ? ' rotate(' + c.rot + ')' : '') + '"';
    switch (c.shape) {
      case 'circle': return '<circle cx="' + f2(c.x) + '" cy="' + f2(c.y) + '" r="' + f2(h) + '"' + attr + '/>';
      case 'square': return '<rect x="' + f2(-h * 0.88) + '" y="' + f2(-h * 0.88) + '" width="' + f2(s * 0.88) + '" height="' + f2(s * 0.88) + '"' + attr + tr + '/>';
      case 'triangle': pts = [[0, -h], [h * 0.95, h * 0.72], [-h * 0.95, h * 0.72]]; break;
      case 'diamond': pts = [[0, -h], [h * 0.7, 0], [0, h], [-h * 0.7, 0]]; break;
      case 'hexagon': pts = []; for (var i = 0; i < 6; i++) pts.push([h * Math.cos(Math.PI / 3 * i), h * Math.sin(Math.PI / 3 * i)]); break;
      case 'star':
        pts = [];
        for (var j = 0; j < 10; j++) { var r = j % 2 ? h * 0.45 : h; var a = -Math.PI / 2 + Math.PI / 5 * j; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
        break;
      case 'cross':
        var t = h * 0.34;
        pts = [[-t, -h], [t, -h], [t, -t], [h, -t], [h, t], [t, t], [t, h], [-t, h], [-t, t], [-h, t], [-h, -t], [-t, -t]];
        break;
      case 'heart':
        p = 'M0 ' + f2(h * 0.95) + ' C ' + f2(-h * 1.3) + ' ' + f2(-h * 0.1) + ' ' + f2(-h * 0.55) + ' ' + f2(-h * 1.05) + ' 0 ' + f2(-h * 0.45) +
          ' C ' + f2(h * 0.55) + ' ' + f2(-h * 1.05) + ' ' + f2(h * 1.3) + ' ' + f2(-h * 0.1) + ' 0 ' + f2(h * 0.95) + ' Z';
        return '<path d="' + p + '"' + attr + tr + '/>';
    }
    return '<polygon points="' + pts.map(function (q) { return f2(q[0]) + ',' + f2(q[1]); }).join(' ') + '"' + attr + tr + '/>';
  }
  function f2(n) { return String(Math.round(n * 100) / 100); }

  function machigaiPanelSvg(m, cells, id, answer) {
    var defs = '<defs>' +
      '<pattern id="st' + id + '" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="2.4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="2.4" stroke="#000" stroke-width="1"/></pattern>' +
      '<pattern id="dt' + id + '" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#fff"/><circle cx="1.5" cy="1.5" r="0.75" fill="#000"/></pattern>' +
      '</defs>';
    var body = '';
    cells.forEach(function (c) {
      if (c.empty) return;
      var fill = c.fill === 'black' ? '#000' : c.fill === 'stripe' ? 'url(#st' + id + ')' : c.fill === 'dot' ? 'url(#dt' + id + ')' : '#fff';
      body += shapeSvg(c, fill);
    });
    var marks = '';
    if (answer) {
      m.diffs.forEach(function (d, k) {
        var col = d.i % m.cols, row = Math.floor(d.i / m.cols);
        var cx = col * m.cw + m.cw / 2, cy = row * m.ch + m.ch / 2;
        marks += '<ellipse cx="' + f2(cx) + '" cy="' + f2(cy) + '" rx="' + f2(m.cw / 2 - 0.8) + '" ry="' + f2(m.ch / 2 - 0.8) + '" fill="none" stroke="#000" stroke-width="1.4" stroke-dasharray="3 1.6"/>' +
          '<circle cx="' + f2(col * m.cw + 4.2) + '" cy="' + f2(row * m.ch + 4.2) + '" r="3.6" fill="#000"/>' +
          '<text x="' + f2(col * m.cw + 4.2) + '" y="' + f2(row * m.ch + 5.9) + '" font-size="4.94" font-weight="700" text-anchor="middle" fill="#fff">' + (k + 1) + '</text>';
      });
    }
    return '<svg class="nt-panel" viewBox="0 0 ' + PANEL_W + ' ' + PANEL_H + '" width="' + PANEL_W + 'mm" height="' + PANEL_H + 'mm" role="img" aria-label="図形の絵">' +
      defs + '<rect x="0.3" y="0.3" width="' + (PANEL_W - 0.6) + '" height="' + (PANEL_H - 0.6) + '" fill="#fff" stroke="#000" stroke-width="0.6"/>' + body + marks + '</svg>';
  }
  /** 答えのページに書く、ちがいの説明（「3 段目・左から 2 つめ: 星 → 丸」） */
  function describeDiff(m, d) {
    var col = d.i % m.cols, row = Math.floor(d.i / m.cols);
    var where = '上から ' + (row + 1) + ' 段目・左から ' + (col + 1) + ' つめ';
    var t = m.top[d.i], b = m.bottom[d.i];
    var what = d.type === 'remove' ? SHAPE_NAMES[t.shape] + 'が無い'
      : d.type === 'add' ? SHAPE_NAMES[b.shape] + 'が増えた'
      : d.type === 'shape' ? SHAPE_NAMES[t.shape] + ' → ' + SHAPE_NAMES[b.shape]
      : d.type === 'fill' ? SHAPE_NAMES[t.shape] + 'の色（' + FILL_NAMES[t.fill] + ' → ' + FILL_NAMES[b.fill] + '）'
      : SHAPE_NAMES[t.shape] + 'が小さい';
    return where + ': ' + what;
  }

  // ---------------------------------------------------------------
  // かなクロスワード（語をます目に交差させて置く。偶然できる 2 字以上の並びは作らない）
  // ---------------------------------------------------------------
  var CROSS = {
    easy: { size: 6, target: 6, minLen: 2, maxLen: 4, cell: 21 },
    normal: { size: 8, target: 10, minLen: 2, maxLen: 5, cell: 17 },
    hard: { size: 9, target: 12, minLen: 2, maxLen: 5, cell: 13 },
  };
  function crossword(level, rng, words, avoid) {
    var C = CROSS[level];
    var pool = words.filter(function (w) { return w[0].length >= C.minLen && w[0].length <= C.maxLen; });
    var best = null;
    for (var attempt = 0; attempt < 40; attempt++) {
      var g = tryCross(C, rng, pool, avoid || {});
      if (!best || g.placed.length > best.placed.length) best = g;
      if (best.placed.length >= C.target) break;
    }
    return finishCross(best);
  }
  function tryCross(C, rng, pool, avoid) {
    var N = C.size;
    var grid = [];
    for (var r = 0; r < N; r++) { grid.push([]); for (var c = 0; c < N; c++) grid[r].push(''); }
    grid.dirs = {};   // マスごとに、そこを通る語の向き（同じ向きの語を重ねて、前の語を飲み込まないように）
    var order = rng.shuffle(pool);
    // 前の枚で使った語はうしろへ（1 回の印刷の中で重なりにくく）
    order = order.filter(function (w) { return !avoid[w[0]]; }).concat(order.filter(function (w) { return avoid[w[0]]; }));
    var placed = [], used = {};
    var first = null;
    for (var i = 0; i < order.length; i++) if (order[i][0].length >= 3) { first = order[i]; break; }
    if (!first) return { N: N, grid: grid, placed: placed };
    var fr = Math.floor(N / 2) - (rng.next() < 0.5 ? 1 : 0), fc = rng.int(0, N - first[0].length);
    put(grid, first[0], fr, fc, 0);
    placed.push({ word: first[0], clue: first[1], r: fr, c: fc, dir: 0 });
    used[first[0]] = true;
    var stuck = 0;
    while (placed.length < C.target && stuck < 3) {
      var cands = [];
      for (var k = 0; k < order.length && cands.length < 60; k++) {
        var w = order[k];
        if (used[w[0]]) continue;
        var opts = placements(grid, N, w[0]);
        opts.forEach(function (o) { cands.push({ w: w, o: o }); });
      }
      if (!cands.length) { stuck = 3; break; }
      // 交わる数が多い置き方を優先（同じなら乱数）
      var maxX = Math.max.apply(null, cands.map(function (x) { return x.o.cross; }));
      var top = cands.filter(function (x) { return x.o.cross === maxX; });
      var pickd = rng.pick(top);
      put(grid, pickd.w[0], pickd.o.r, pickd.o.c, pickd.o.dir);
      placed.push({ word: pickd.w[0], clue: pickd.w[1], r: pickd.o.r, c: pickd.o.c, dir: pickd.o.dir });
      used[pickd.w[0]] = true;
    }
    return { N: N, grid: grid, placed: placed };
  }
  function put(grid, word, r, c, dir) {
    var ch = Array.from(word);
    for (var i = 0; i < ch.length; i++) {
      var rr = r + (dir ? i : 0), cc = c + (dir ? 0 : i);
      grid[rr][cc] = ch[i];
      grid.dirs[rr + ',' + cc] = (grid.dirs[rr + ',' + cc] || '') + dir;
    }
  }
  function at(grid, N, r, c) { return r < 0 || c < 0 || r >= N || c >= N ? '' : grid[r][c]; }
  /** 語を置ける場所（既にある字と 1 つ以上交わり、ほかの字と横に並ばない） */
  function placements(grid, N, word) {
    var ch = Array.from(word), L = ch.length, out = [];
    for (var dir = 0; dir < 2; dir++) {
      for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
          var er = r + (dir ? L - 1 : 0), ec = c + (dir ? 0 : L - 1);
          if (er >= N || ec >= N) continue;
          // 前後のマスは空
          if (at(grid, N, r - (dir ? 1 : 0), c - (dir ? 0 : 1)) || at(grid, N, er + (dir ? 1 : 0), ec + (dir ? 0 : 1))) continue;
          var cross = 0, ok = true;
          for (var i = 0; i < L && ok; i++) {
            var rr = r + (dir ? i : 0), cc = c + (dir ? 0 : i);
            var g = grid[rr][cc];
            if (g) { if (g !== ch[i] || (grid.dirs[rr + ',' + cc] || '').indexOf(String(dir)) >= 0) ok = false; else cross++; }
            else {
              // 新しく書くマスの両脇（語の向きと直角）は空
              if (dir) { if (at(grid, N, rr, cc - 1) || at(grid, N, rr, cc + 1)) ok = false; }
              else if (at(grid, N, rr - 1, cc) || at(grid, N, rr + 1, cc)) ok = false;
            }
          }
          if (ok && cross > 0 && cross < L) out.push({ r: r, c: c, dir: dir, cross: cross });
        }
      }
    }
    return out;
  }
  /** 使っている範囲だけに縮め、番号を振る（左上から、ヨコかタテの語の始まりのマスに） */
  function finishCross(g) {
    var N = g.N, minR = N, minC = N, maxR = -1, maxC = -1;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (g.grid[r][c]) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
    var H = maxR - minR + 1, W = maxC - minC + 1;
    var cells = [];
    for (var y = 0; y < H; y++) { cells.push([]); for (var x = 0; x < W; x++) cells[y].push(g.grid[y + minR][x + minC]); }
    var words = g.placed.map(function (p) { return { word: p.word, clue: p.clue, r: p.r - minR, c: p.c - minC, dir: p.dir }; });
    var num = 0, nums = {};
    for (var yy = 0; yy < H; yy++) {
      for (var xx = 0; xx < W; xx++) {
        var starts = words.filter(function (w) { return w.r === yy && w.c === xx; });
        if (starts.length) { num++; nums[yy + ',' + xx] = num; starts.forEach(function (w) { w.n = num; }); }
      }
    }
    var across = words.filter(function (w) { return w.dir === 0; }).sort(function (a, b) { return a.n - b.n; });
    var down = words.filter(function (w) { return w.dir === 1; }).sort(function (a, b) { return a.n - b.n; });
    return { w: W, h: H, cells: cells, nums: nums, across: across, down: down };
  }

  // ---------------------------------------------------------------
  // 塗り絵カレンダー（模様は円を N 等分した図形を重ねたもの。祝日は入れない）
  // ---------------------------------------------------------------
  var NURIE = { easy: { rings: 3, k: [6, 8] }, normal: { rings: 5, k: [8, 10] }, hard: { rings: 7, k: [12, 16] } };
  var RING_KINDS = ['petal', 'circle', 'drop', 'tri', 'arch', 'leaf'];
  function mandala(level, rng) {
    var P = NURIE[level];
    var k = rng.pick(P.k);
    var R = 70;   // 外側の半径（mm）
    var rings = [];
    var r0 = R * (level === 'easy' ? 0.22 : 0.14);
    var step = (R - r0) / P.rings;
    for (var i = 0; i < P.rings; i++) {
      rings.push({ kind: i === 0 ? 'petal' : rng.pick(RING_KINDS), inner: r0 + step * i, outer: r0 + step * (i + 1), n: i % 2 ? k * (level === 'hard' && i > 3 ? 2 : 1) : k, offset: i % 2 ? 0.5 : 0 });
    }
    return { R: R, r0: r0, k: k, rings: rings, center: rng.pick(['circle', 'flower']) };
  }
  function mandalaSvg(m, cx, cy) {
    var s = '<g fill="#fff" stroke="#000" stroke-width="0.55" stroke-linejoin="round">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + m.R + '"/>';
    for (var i = m.rings.length - 1; i >= 0; i--) {
      var g = m.rings[i];
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f2(g.outer) + '"/>';
      for (var j = 0; j < g.n; j++) {
        var a = (j + g.offset) / g.n * 360;
        s += '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + f2(a) + ')">' + ringElement(g) + '</g>';
      }
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f2(m.r0) + '"/>';
    if (m.center === 'flower') {
      for (var q = 0; q < m.k; q++) s += '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + f2(q / m.k * 360) + ')"><ellipse cx="0" cy="' + f2(-m.r0 * 0.5) + '" rx="' + f2(m.r0 * 0.2) + '" ry="' + f2(m.r0 * 0.45) + '"/></g>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f2(m.r0 * 0.3) + '"/>';
    return s + '</g>';
  }
  function ringElement(g) {
    var ri = g.inner, ro = g.outer, mid = (ri + ro) / 2, w = ro - ri;
    var half = Math.PI * mid / g.n * 0.9;   // 隣と重ならない幅の半分
    switch (g.kind) {
      case 'petal': return '<path d="M0 ' + f2(-ri) + ' Q ' + f2(half) + ' ' + f2(-mid) + ' 0 ' + f2(-ro) + ' Q ' + f2(-half) + ' ' + f2(-mid) + ' 0 ' + f2(-ri) + ' Z"/>';
      case 'circle': return '<circle cx="0" cy="' + f2(-mid) + '" r="' + f2(Math.min(w * 0.42, half * 0.9)) + '"/>';
      case 'drop': return '<path d="M0 ' + f2(-ro + w * 0.08) + ' C ' + f2(half * 0.9) + ' ' + f2(-mid) + ' ' + f2(half * 0.6) + ' ' + f2(-ri - w * 0.05) + ' 0 ' + f2(-ri - w * 0.05) + ' C ' + f2(-half * 0.6) + ' ' + f2(-ri - w * 0.05) + ' ' + f2(-half * 0.9) + ' ' + f2(-mid) + ' 0 ' + f2(-ro + w * 0.08) + ' Z"/>';
      case 'tri': return '<polygon points="0,' + f2(-ro) + ' ' + f2(half) + ',' + f2(-ri) + ' ' + f2(-half) + ',' + f2(-ri) + '"/>';
      case 'arch': return '<path d="M' + f2(-half) + ' ' + f2(-ri) + ' A ' + f2(half) + ' ' + f2(w * 0.9) + ' 0 0 1 ' + f2(half) + ' ' + f2(-ri) + ' Z"/><path d="M' + f2(-half * 0.5) + ' ' + f2(-ri) + ' A ' + f2(half * 0.5) + ' ' + f2(w * 0.45) + ' 0 0 1 ' + f2(half * 0.5) + ' ' + f2(-ri) + ' Z"/>';
      default: return '<path d="M0 ' + f2(-ri) + ' C ' + f2(half * 1.1) + ' ' + f2(-ri - w * 0.3) + ' ' + f2(half * 0.4) + ' ' + f2(-ro) + ' 0 ' + f2(-ro) + ' C ' + f2(-half * 0.4) + ' ' + f2(-ro) + ' ' + f2(-half * 1.1) + ' ' + f2(-ri - w * 0.3) + ' 0 ' + f2(-ri) + ' Z"/><line x1="0" y1="' + f2(-ri) + '" x2="0" y2="' + f2(-ro) + '"/>';
    }
  }
  /** その月の週の並び（日曜はじまり）。{ y, m, weeks: [[null|日, ...7], ...] } */
  function monthGrid(y, m) {
    var first = new Date(y, m - 1, 1).getDay();
    var days = new Date(y, m, 0).getDate();
    var weeks = [], wk = [];
    for (var i = 0; i < first; i++) wk.push(null);
    for (var d = 1; d <= days; d++) { wk.push(d); if (wk.length === 7) { weeks.push(wk); wk = []; } }
    if (wk.length) { while (wk.length < 7) wk.push(null); weeks.push(wk); }
    return { y: y, m: m, weeks: weeks };
  }
  function addMonths(ym, n) {
    var p = /^(\d{4})-(\d{2})$/.exec(ym);
    var t = Number(p[1]) * 12 + Number(p[2]) - 1 + n;
    var y = Math.floor(t / 12), m = t % 12 + 1;
    return y + '-' + (m < 10 ? '0' : '') + m;
  }
  /** 既定の月: 20 日までは今月、21 日からは来月（月末に翌月分を刷る人が多いため） */
  function defaultMonth(d) {
    var ym = d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1);
    return d.getDate() > 20 ? addMonths(ym, 1) : ym;
  }
  function reiwaLabel(y, m) {
    if (y < 2019 || (y === 2019 && m < 5)) return '';
    return '令和' + (y === 2019 ? '元' : y - 2018) + '年';
  }

  // ---------------------------------------------------------------
  // 用紙の HTML（A4 縦 210×297mm。字は 14pt 以上。白黒）
  // ---------------------------------------------------------------
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

  /**
   * 設定から、問題と答えのページの HTML を作る
   * @param {object} s 正規化した設定（kind・level・pages・answers・op・month・name・credit・seed）
   * @param {object} data { kanji: NotoreKanji, kana: NotoreKana, today: Date }
   * @returns {{ html: string, sheets: number, questions: number }}
   */
  function buildSheets(s, data) {
    var pages = [], answers = [];
    var label = seedLabel(s.seed);
    var kindName = KIND_NAMES[s.kind] + (s.kind === 'calc' ? '（' + OP_NAMES[s.op] + '）' : '');
    var title = kindName + (s.kind === 'nurie' ? '' : '・' + LEVEL_NAMES[s.level]);
    var i;
    if (s.kind === 'calc') {
      for (i = 0; i < s.pages; i++) {
        var probs = calcPage(s.level, s.op, makeRng(s.seed, SALT.calc * 100 + i));
        pages.push(calcHtml(probs, false)); answers.push(calcHtml(probs, true));
      }
    } else if (s.kind === 'kanji') {
      kanjiPages(s.level, s.pages, s.seed, data.kanji).forEach(function (p) { pages.push(kanjiHtml(p, false)); answers.push(kanjiHtml(p, true)); });
    } else if (s.kind === 'machigai') {
      for (i = 0; i < s.pages; i++) {
        var m = machigai(s.level, makeRng(s.seed, SALT.machigai * 100 + i));
        pages.push(machigaiHtml(m, i, false)); answers.push(machigaiHtml(m, i, true));
      }
    } else if (s.kind === 'cross') {
      var avoid = {};
      for (i = 0; i < s.pages; i++) {
        var cw = crossword(s.level, makeRng(s.seed, SALT.cross * 100 + i), data.kana, avoid);
        cw.across.concat(cw.down).forEach(function (w) { avoid[w.word] = true; });
        pages.push(crossHtml(cw, s.level, false)); answers.push(crossHtml(cw, s.level, true));
      }
    } else {
      var month = s.month || defaultMonth(data.today || new Date());
      for (i = 0; i < s.pages; i++) {
        var ym = addMonths(month, i).split('-');
        var md = mandala(s.level, makeRng(s.seed, SALT.nurie * 100 + i));
        pages.push(nurieHtml(md, monthGrid(Number(ym[0]), Number(ym[1]))));
      }
    }
    var withAns = s.answers && s.kind !== 'nurie';
    var total = pages.length + (withAns ? answers.length : 0);
    var html = '';
    pages.forEach(function (body, k) { html += sheetHtml(s, title, label, k, pages.length, body, false, s.kind !== 'nurie'); });
    if (withAns) answers.forEach(function (body, k) { html += sheetHtml(s, title, label, k, pages.length, body, true, false); });
    return { html: html, sheets: total };
  }
  function sheetHtml(s, title, label, k, n, body, isAnswer, nameLine) {
    var head = '<div class="nt-head"><div class="nt-title">' + esc(isAnswer ? '答え　' + title : title) + '</div>' +
      '<div class="nt-meta"><span>問題番号 ' + label + '</span>' + (n > 1 ? '<span>' + (k + 1) + '／' + n + ' 枚め</span>' : '') + '</div></div>';
    var line = nameLine ? '<div class="nt-name"><span>　　月　　日（　　）</span><span>お名前 <span class="nt-namebox">' + esc(s.name) + '</span></span></div>' : '';
    return '<div class="sheet nt-sheet' + (isAnswer ? ' nt-answer' : '') + (k > 0 || isAnswer ? ' nt-more' : '') + '" data-kind="' + s.kind + '" data-answer="' + (isAnswer ? 1 : 0) + '">' +
      '<div class="nt-in">' + head + line + body + '</div>' + (s.credit ? '<div class="credit">yorozu-craft.com/otasuke/print/ で作成</div>' : '') + '</div>';
  }
  function calcHtml(probs, ans) {
    var cells = probs.map(function (p, k) {
      return '<div class="nt-q"><span class="nt-no">' + (k + 1) + '.</span><span class="nt-expr">' + p.a + ' ' + p.op + ' ' + p.b + ' =</span>' +
        '<span class="nt-box">' + (ans ? p.ans : '') + '</span></div>';
    }).join('');
    return '<p class="nt-lead">' + (ans ? '' : '計算して、答えを書きましょう。') + '</p><div class="nt-grid2 nt-calc">' + cells + '</div>' + (ans ? '' : scoreLine(probs.length));
  }
  function kanjiHtml(items, ans) {
    var cells = items.map(function (w, k) {
      return '<div class="nt-q"><span class="nt-no">' + CIRCLED[k] + '</span><span class="nt-kanji">' + esc(w.word) + '</span>' +
        '<span class="nt-box nt-yomi">' + (ans ? esc(w.reading) + (w.alt ? '<small>（' + esc(w.alt) + '）</small>' : '') : '') + '</span></div>';
    }).join('');
    return '<p class="nt-lead">' + (ans ? '' : '読みを、ひらがなで書きましょう。') + '</p><div class="nt-grid2 nt-kanjis">' + cells + '</div>' + (ans ? '' : scoreLine(items.length));
  }
  function scoreLine(n) { return '<div class="nt-score">できた数 <span class="nt-scorebox"></span> ／ ' + n + '</div>'; }
  function machigaiHtml(m, i, ans) {
    var lead = ans ? '' : '<p class="nt-lead">下の絵には、上の絵とちがうところが <b>' + m.diffs.length + ' つ</b>あります。見つけたら下の絵に○をつけましょう。</p>';
    var list = ans ? '<ol class="nt-difflist">' + m.diffs.map(function (d) { return '<li>' + esc(describeDiff(m, d)) + '</li>'; }).join('') + '</ol>' : '';
    return lead +
      (ans ? '' : '<div class="nt-cap">上の絵</div>' + machigaiPanelSvg(m, m.top, 'a' + i, false)) +
      '<div class="nt-cap">' + (ans ? '下の絵（ちがうところに番号）' : '下の絵') + '</div>' + machigaiPanelSvg(m, m.bottom, (ans ? 'c' : 'b') + i, ans) + list;
  }
  function crossHtml(cw, level, ans) {
    var cell = CROSS[level].cell;
    var W = cw.w * cell, H = cw.h * cell;
    var svg = '<svg class="nt-cross" viewBox="0 0 ' + f2(W + 1) + ' ' + f2(H + 1) + '" width="' + f2(W + 1) + 'mm" height="' + f2(H + 1) + 'mm" role="img" aria-label="クロスワードのます目">';
    for (var y = 0; y < cw.h; y++) {
      for (var x = 0; x < cw.w; x++) {
        var ch = cw.cells[y][x];
        if (!ch) continue;
        var px = 0.5 + x * cell, py = 0.5 + y * cell;
        svg += '<rect x="' + f2(px) + '" y="' + f2(py) + '" width="' + cell + '" height="' + cell + '" fill="#fff" stroke="#000" stroke-width="0.7"/>';
        var n = cw.nums[y + ',' + x];
        if (n) svg += '<text x="' + f2(px + 1) + '" y="' + f2(py + 5) + '" font-size="4.94" fill="#000">' + n + '</text>';
        if (ans) svg += '<text x="' + f2(px + cell / 2) + '" y="' + f2(py + cell * 0.72) + '" font-size="' + f2(cell * 0.55) + '" text-anchor="middle" font-weight="700" fill="#000">' + ch + '</text>';
      }
    }
    svg += '</svg>';
    var clues = function (list, name) {
      return '<div class="nt-clues"><div class="nt-cluehead">' + name + '</div><ol>' + list.map(function (w) {
        return '<li><b>' + w.n + '</b>　' + esc(w.clue) + '（' + Array.from(w.word).length + '字）' + (ans ? '<span class="nt-cans">' + esc(w.word) + '</span>' : '') + '</li>';
      }).join('') + '</ol></div>';
    };
    var lead = ans ? '' : '<p class="nt-lead">カギを読んで、ます目にひらがなを 1 字ずつ入れましょう。</p>';
    return lead + '<div class="nt-crosswrap">' + svg + '</div><div class="nt-cluecols">' + clues(cw.across, 'ヨコのカギ') + clues(cw.down, 'タテのカギ') + '</div>';
  }
  function nurieHtml(md, mg) {
    var W = 182, Hp = 146;
    var svg = '<svg class="nt-mandala" viewBox="0 0 ' + W + ' ' + Hp + '" width="' + W + 'mm" height="' + Hp + 'mm" role="img" aria-label="塗り絵の模様">' + mandalaSvg(md, W / 2, Hp / 2) + '</svg>';
    var wk = ['日', '月', '火', '水', '木', '金', '土'];
    var table = '<table class="nt-cal"><thead><tr>' + wk.map(function (w, k) { return '<th' + (k === 0 ? ' class="sun"' : k === 6 ? ' class="sat"' : '') + '>' + w + '</th>'; }).join('') + '</tr></thead><tbody>' +
      mg.weeks.map(function (row) { return '<tr>' + row.map(function (d, k) { return '<td' + (k === 0 ? ' class="sun"' : '') + '>' + (d || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    var rw = reiwaLabel(mg.y, mg.m);
    return '<div class="nt-month"><span class="nt-mnum">' + mg.m + '</span><span class="nt-my">月　' + mg.y + '年' + (rw ? '（' + rw + '）' : '') + '</span></div>' +
      '<div class="nt-mwrap">' + svg + '</div>' + table;
  }

  var api = {
    mulberry32: mulberry32, mixSeed: mixSeed, makeRng: makeRng, seedLabel: seedLabel, parseSeedLabel: parseSeedLabel,
    LEVELS: LEVELS, LEVEL_NAMES: LEVEL_NAMES, KINDS: KINDS, KIND_NAMES: KIND_NAMES, OPS: OPS, OP_NAMES: OP_NAMES,
    CALC_PER_PAGE: CALC_PER_PAGE, CALC_RANGE: CALC_RANGE, calcPage: calcPage,
    KANJI_PER_PAGE: KANJI_PER_PAGE, kanjiPages: kanjiPages,
    MACHIGAI: MACHIGAI, SHAPES: SHAPES, machigai: machigai, describeDiff: describeDiff, machigaiPanelSvg: machigaiPanelSvg,
    CROSS: CROSS, crossword: crossword,
    NURIE: NURIE, mandala: mandala, monthGrid: monthGrid, addMonths: addMonths, defaultMonth: defaultMonth, reiwaLabel: reiwaLabel,
    buildSheets: buildSheets,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NotoreGen = api;
})(this);
