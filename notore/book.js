// ===========================
// 脳トレの本（KDP のペーパーバックの原稿、ROADMAP K127）— 100 日分の問題と答えを B5 のページに組む（DOM に触らない）
// 問題は gen.js の関数（calcPage・kanjiPages・machigai・crossword）で作り、用紙の HTML も gen.js の関数を使う（問題を写さない）。
// 同じ問題番号（seed）と同じ設定からは、いつでも同じ本になる（tests/book.test.js）。
// 判型・裁ち落とし・余白の値は book-values.js（KDP のヘルプ、確認日つき）。
// ブラウザでは window.NotoreBook、Node では module.exports
// ===========================
(function (root) {
  'use strict';
  var G = root.NotoreGen || (typeof require !== 'undefined' ? require('./gen.js') : null);
  var V = root.NotoreBookValues || (typeof require !== 'undefined' ? require('./book-values.js') : null);

  var DAYS = 100;
  // 1 日め 間違い探し → 2 日め 計算 → 3 日め 漢字の読み → 4 日め かなクロスワード → 5 日め 間違い探し …（25 日ずつ）
  var ORDER = ['machigai', 'calc', 'kanji', 'cross'];
  var KIND_NAMES = { machigai: '間違い探し', calc: '計算', kanji: '漢字の読み', cross: 'かなクロスワード' };
  /** その日のむずかしさ（1〜50 日めはやさしい、51〜100 日めはふつう） */
  function levelOf(day) { return day <= 50 ? 'easy' : 'normal'; }
  function kindOf(day) { return ORDER[(day - 1) % ORDER.length]; }

  // 本に載せない語（効果・医療の表現。check-site の MEDICAL_NG「診断|改善|予防|効果|治る|若返」に「認知症」を足したもの）。
  // 本では打ち消しの文も置かないので、1 語も出さない（漢字の読みの語と、クロスワードの語とカギから外す）
  var NG = /診断|改善|予防|効果|治る|若返|認知症/;

  // 余白（mm）。KDP の最小（book-values.js）より広く取る。内側はページ数 301〜500 の最小 15.9 mm も満たす
  var MARGIN = { inside: 16, outside: 12, top: 12, bottom: 18 };
  // ページ番号の位置（仕上がりの下の端から mm）。裁ち落としありの最小 9.6 mm より内側
  var FOLIO_BOTTOM = 10.5;
  var IN = 25.4;

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /** 語の表から、本に載せない語を外す */
  function cleanKanji(words) {
    var out = {};
    Object.keys(words).forEach(function (lv) { out[lv] = words[lv].filter(function (w) { return !NG.test(w.join('')); }); });
    return out;
  }
  function cleanKana(words) { return words.filter(function (w) { return !NG.test(w[0] + w[1] + (w[2] || '')); }); }

  /**
   * 100 日分の問題を作る（HTML は作らない）
   * @param {number} seed 問題番号
   * @param {object} data { kanji: NotoreKanji, kana: NotoreKana }
   */
  function buildDays(seed, data) {
    var kanji = cleanKanji(data.kanji), kana = cleanKana(data.kana);
    var days = [];
    var kanjiDays = { easy: [], normal: [] };
    var avoid = {};
    for (var d = 1; d <= DAYS; d++) {
      var kind = kindOf(d), level = levelOf(d);
      var day = { day: d, kind: kind, level: level };
      if (kind === 'calc') day.probs = G.calcPage(level, 'mix', G.makeRng(seed, G.SALT.calc * 1000 + d));
      else if (kind === 'machigai') day.m = G.machigai(level, G.makeRng(seed, G.SALT.machigai * 1000 + d));
      else if (kind === 'cross') {
        day.cw = G.crossword(level, G.makeRng(seed, G.SALT.cross * 1000 + d), kana, avoid);
        day.cw.across.concat(day.cw.down).forEach(function (w) { avoid[w.word] = true; });
      } else kanjiDays[level].push(day);
      days.push(day);
    }
    // 漢字の読み: むずかしさごとに、語が一巡するまで同じ語を出さない（gen.js の kanjiPages）
    ['easy', 'normal'].forEach(function (lv) {
      var pages = G.kanjiPages(lv, kanjiDays[lv].length, seed, kanji);
      kanjiDays[lv].forEach(function (day, k) { day.items = pages[k]; });
    });
    return days;
  }

  // ---------------------------------------------------------------
  // ページの組み立て
  // ---------------------------------------------------------------
  var CROSS_CELL = { easy: 18, normal: 14, hard: 12 };   // 本のます目の一辺（mm）。gen.js の A4 用より小さく
  var CROSS_ANS_MAX = 80;                                 // 答えのます目の大きさの上限（mm）
  /** gen.js の crossHtml のます目（SVG）の大きさを、本の大きさに直す */
  function scaleCross(html, level, maxMm) {
    return html.replace(/(<svg class="nt-cross" viewBox="0 0 ([\d.]+) ([\d.]+)") width="[\d.]+mm" height="[\d.]+mm"/, function (all, head, w, h) {
      var s = CROSS_CELL[level] / G.CROSS[level].cell;
      if (maxMm) s = Math.min(s, maxMm / Number(w), maxMm / Number(h));
      return head + ' width="' + r1(Number(w) * s) + 'mm" height="' + r1(Number(h) * s) + 'mm"';
    });
  }
  function r1(n) { return String(Math.round(n * 10) / 10); }

  function problemBody(day) {
    if (day.kind === 'calc') return G.calcHtml(day.probs, false);
    if (day.kind === 'kanji') return G.kanjiHtml(day.items, false);
    if (day.kind === 'machigai') return G.machigaiHtml(day.m, day.day, false);
    return scaleCross(G.crossHtml(day.cw, day.level, false), day.level);
  }
  function answerBody(day) {
    if (day.kind === 'calc') return G.calcHtml(day.probs, true);
    if (day.kind === 'kanji') return G.kanjiHtml(day.items, true);
    if (day.kind === 'machigai') return G.machigaiHtml(day.m, day.day, true);
    return scaleCross(G.crossHtml(day.cw, day.level, true), day.level, CROSS_ANS_MAX);
  }

  var LEVEL_NAMES = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };

  /**
   * 本の HTML を作る
   * @param {object} o { seed, bleed: 裁ち落としあり, title }
   * @param {object} data { kanji, kana }
   * @returns {{ html, css, pages, days, gutterMinIn, pageSizeIn }}
   */
  function buildBook(o, data) {
    var seed = o.seed >>> 0;
    var title = o.title || '大きな字の脳トレ 100 日';
    var days = buildDays(seed, data);
    var FRONT = 4;                                  // 扉・この本の使い方・目次 2 ページ
    var probPage = function (d) { return FRONT + d; };
    var ANS_PER_PAGE = 2;
    var ansStart = FRONT + DAYS + 1;
    var ansPage = function (d) { return ansStart + Math.floor((d - 1) / ANS_PER_PAGE); };
    var total = ansStart - 1 + Math.ceil(DAYS / ANS_PER_PAGE);

    var pages = [];
    // 1. 扉（表紙ではない。表紙はオーナーが別に作る）
    pages.push({ cls: 'bk-title', body: '<div class="bk-t1">' + G.esc(title) + '</div><div class="bk-t2">間違い探し・計算・漢字の読み・かなクロスワード</div>', folio: false });
    // 2. この本の使い方（1 文 40 字以内。効果の表現は書かない）
    pages.push({ cls: 'bk-howto', body: '<h2 class="bk-h">この本の使い方</h2><ul class="bk-list">' + [
      '1 日に 1 ページずつ、好きな時間に解いてください。',
      '間違い探し・計算・漢字の読み・クロスワードの順です。',
      '1〜50 日めはやさしい問題、51〜100 日めはふつうの問題です。',
      '答えは本のうしろにあります。ページは目次を見てください。',
      '解けない問題は、とばして次の日に進んでかまいません。',
      'ページの上の「月　日」に、解いた日を書くと記録になります。',
    ].map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
      '<h2 class="bk-h">問題について</h2><ul class="bk-list">' + [
      '漢字の読みの語は、常用漢字表（文化庁）の例の欄から選びました。',
      'クロスワードの語とカギ、間違い探しの絵は、この本のために作りました。',
    ].map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
      '<p class="bk-colophon">問題番号 ' + G.seedLabel(seed) + '</p>' });
    // 3〜4. 目次（50 日ずつ。1 ページに 25 行 × 2 段）
    for (var t = 0; t < 2; t++) {
      var cols = '';
      for (var c = 0; c < 2; c++) {
        var rows = '';
        for (var k = 0; k < 25; k++) {
          var d = t * 50 + c * 25 + k + 1, dy = days[d - 1];
          rows += '<tr><td class="bk-td-day">' + d + ' 日め</td><td>' + KIND_NAMES[dy.kind] + '</td><td class="bk-td-p">' + probPage(d) + '</td><td class="bk-td-p">' + ansPage(d) + '</td></tr>';
        }
        cols += '<table class="bk-toc"><thead><tr><th>日</th><th>問題</th><th class="bk-th-p">ページ</th><th class="bk-th-p">答え</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }
      pages.push({ cls: 'bk-tocpage', body: '<h2 class="bk-h">目次' + (t ? '（つづき）' : '') + '</h2><div class="bk-toccols">' + cols + '</div>' });
    }
    // 5〜104. 1 日 1 ページ
    days.forEach(function (day) {
      pages.push({
        cls: 'bk-prob bk-k-' + day.kind,
        body: '<div class="bk-head"><span class="bk-day">' + day.day + ' 日め</span><span class="bk-kind">' + KIND_NAMES[day.kind] + '・' + LEVEL_NAMES[day.level] + '</span>' +
          '<span class="bk-date">　　月　　日</span></div><div class="bk-body">' + problemBody(day) + '</div>',
        day: day.day,
      });
    });
    // 105〜. 答え（1 ページに 2 日分）
    for (var a = 0; a < DAYS; a += ANS_PER_PAGE) {
      var blocks = '';
      for (var j = a; j < Math.min(DAYS, a + ANS_PER_PAGE); j++) {
        var dd = days[j];
        blocks += '<div class="bk-ablock bk-k-' + dd.kind + '"><div class="bk-ahead">' + (a === 0 && j === 0 ? '<span class="bk-ah">答え</span>' : '') +
          dd.day + ' 日め　' + KIND_NAMES[dd.kind] + '（' + probPage(dd.day) + ' ページ）</div>' + answerBody(dd) + '</div>';
      }
      pages.push({ cls: 'bk-ans', body: blocks });
    }
    if (pages.length !== total) throw new Error('ページ数が合わない: ' + pages.length + ' / ' + total);

    var size = V.pageSizeIn(!!o.bleed);
    var gutterMin = V.gutterIn(pages.length);
    var html = pages.map(function (p, i) {
      var n = i + 1;
      return '<section class="bk-page ' + (n % 2 ? 'bk-odd' : 'bk-even') + ' ' + p.cls + '" data-page="' + n + '"' + (p.day ? ' data-day="' + p.day + '"' : '') + '>' +
        '<div class="bk-in">' + p.body + '</div>' + (p.folio === false ? '' : '<div class="bk-folio">' + n + '</div>') + '</section>';
    }).join('');
    return { html: html, css: pageCss(!!o.bleed), pages: pages.length, days: days, gutterMinIn: gutterMin, pageSizeIn: size, seed: seed, title: title };
  }

  /**
   * ページの大きさと余白の CSS（裁ち落としあり/なしで変わる）。
   * 左から右へ読む本は、奇数ページが右（ノドは左）、偶数ページが左（ノドは右）。KDP の提出ガイドライン
   * 裁ち落としありは、上・下・外側に 0.125 インチを足す（ノド側には足さない）
   */
  function pageCss(bleed) {
    var s = V.pageSizeIn(bleed), b = bleed ? V.BLEED_IN * IN : 0;
    var mm = function (n) { return (Math.round(n * 100) / 100) + 'mm'; };
    var top = MARGIN.top + b, bottom = MARGIN.bottom + b, out = MARGIN.outside + b, ins = MARGIN.inside;
    return '@page { size: ' + s.w + 'in ' + s.h + 'in; margin: 0; }\n' +
      '.bk-page { width: ' + s.w + 'in; height: ' + s.h + 'in; }\n' +
      '.bk-odd .bk-in { top: ' + mm(top) + '; bottom: ' + mm(bottom) + '; left: ' + mm(ins) + '; right: ' + mm(out) + '; }\n' +
      '.bk-even .bk-in { top: ' + mm(top) + '; bottom: ' + mm(bottom) + '; left: ' + mm(out) + '; right: ' + mm(ins) + '; }\n' +
      '.bk-odd .bk-folio { left: ' + mm(ins) + '; right: ' + mm(out) + '; bottom: ' + mm(FOLIO_BOTTOM + b) + '; }\n' +
      '.bk-even .bk-folio { left: ' + mm(out) + '; right: ' + mm(ins) + '; bottom: ' + mm(FOLIO_BOTTOM + b) + '; }\n';
  }

  /** 本の文を文に分ける（タグを除き、ブロックの切れ目と「。」で切る）。40 字の検査と NG 語の検査に使う */
  function sentences(html) {
    var t = html.replace(/<svg[\s\S]*?<\/svg>/g, '\n')
      .replace(/<(br|\/p|\/li|\/div|\/td|\/th|\/tr|\/h\d|\/span)\b[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    var out = [];
    t.split('\n').forEach(function (line) {
      line.split(/(?<=。)/).forEach(function (s) { s = s.trim(); if (s) out.push(s); });
    });
    return out;
  }

  var api = {
    DAYS: DAYS, ORDER: ORDER, KIND_NAMES: KIND_NAMES, NG: NG, MARGIN: MARGIN, FOLIO_BOTTOM: FOLIO_BOTTOM,
    levelOf: levelOf, kindOf: kindOf, buildDays: buildDays, buildBook: buildBook, pageCss: pageCss, sentences: sentences,
    cleanKanji: cleanKanji, cleanKana: cleanKana,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NotoreBook = api;
})(this);
