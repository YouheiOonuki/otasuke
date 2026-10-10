// 「漢字《かんじ》」の形の文を、ふりがな（<ruby>）つきの HTML にする（やさしい日本語。yorozu-plans K147）。
// ふりがなは直前の漢字の並びにだけ付ける（カタカナやひらがなの後ろの《》は捨てる）。ブラウザでは window.Ruby、Node（テスト）では module.exports
(function (root) {
  'use strict';
  var KANJI = /[一-鿿々〆ヶ]+$/;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /** 1 行 → HTML。ruby が false ならふりがなを外した文 */
  function toHtml(line, ruby) {
    var out = '';
    var re = /《([^《》]*)》/g;
    var last = 0;
    var m;
    while ((m = re.exec(line))) {
      var before = line.slice(last, m.index);
      var k = before.match(KANJI);
      if (ruby && k) {
        out += esc(before.slice(0, before.length - k[0].length)) + '<ruby>' + esc(k[0]) + '<rt>' + esc(m[1]) + '</rt></ruby>';
      } else {
        out += esc(before);
      }
      last = re.lastIndex;
    }
    return out + esc(line.slice(last));
  }
  /** ふりがなを外した文（コピー用） */
  function plain(s) { return String(s).replace(/《[^《》]*》/g, ''); }
  var api = { toHtml: toHtml, plain: plain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ruby = api;
})(this);
