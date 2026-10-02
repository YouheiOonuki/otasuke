// ===========================
// 脳トレの本の原稿（book.html）— 画面の制御。本の中身は book.js、問題は gen.js
// 設定は URL の ?seed=12345-67890&bleed=1&title=… でも渡せる（tools/notore/book-pdf.mjs が使う）。端末には保存しない
// ===========================
(function () {
  'use strict';
  var G = window.NotoreGen, B = window.NotoreBook, V = window.NotoreBookValues;
  function $(id) { return document.getElementById(id); }
  var DEFAULT_SEED = 1;

  var q = new URLSearchParams(location.search);
  var s0 = G.parseSeedLabel(q.get('seed') || '');
  $('bk-seed').value = G.seedLabel(s0 === null ? DEFAULT_SEED : s0);
  $('bk-title').value = q.get('title') || '大きな字の脳トレ 100 日';
  $('bk-bleed').checked = q.get('bleed') === '1';

  function make() {
    var seed = G.parseSeedLabel($('bk-seed').value);
    if (seed === null) { $('bk-info').textContent = '問題番号は「12345-67890」のような 10 けたの数字です。'; return; }
    var r = B.buildBook({ seed: seed, bleed: $('bk-bleed').checked, title: $('bk-title').value.trim() }, { kanji: window.NotoreKanji, kana: window.NotoreKana });
    $('bk-page-css').textContent = r.css;
    $('bk-book').innerHTML = r.html;
    var g = r.gutterMinIn;
    $('bk-info').textContent = V.TRIM.name + '（' + r.pageSizeIn.w + '×' + r.pageSizeIn.h + ' インチ' + ($('bk-bleed').checked ? '・裁ち落としあり' : '') + '）・' +
      r.pages + ' ページ・問題番号 ' + G.seedLabel(seed) + '。ノドの最小は ' + g + ' インチ（' + (Math.round(g * 254) / 10) + ' mm）、この本は ' + B.MARGIN.inside + ' mm。';
    document.documentElement.setAttribute('data-book-ready', String(r.pages));
  }
  $('bk-make').addEventListener('click', make);
  $('bk-bleed').addEventListener('change', make);
  $('bk-print').addEventListener('click', function () { window.print(); });
  make();
})();
