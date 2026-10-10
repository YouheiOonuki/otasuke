// やさしい日本語の画面の、DOM に触らない部分（テストする: tests/yasashii.test.js）。ブラウザでは window.YFlow、Node では module.exports
// - 写真を送る前の縮め方（長辺 1,600px）、- 写真の結果から「原文の欄」と表示の状態を作る（読み違いを人が直して言い換え直せる: K163）
(function (root) {
  'use strict';
  var MAX_SIDE = 1600; // 送る量を減らす（yorozu-plans 7.34.1）
  var LANGS = [
    { code: '', label: 'やさしい日本語のまま' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文（简体）' },
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'pt', label: 'Português' }
  ];
  /** 縮めた大きさ。長辺が MAX_SIDE 以下ならそのまま */
  function fitSize(w, h, max) {
    max = max || MAX_SIDE;
    var long = Math.max(w, h);
    if (long <= max) return { w: w, h: h };
    var k = max / long;
    return { w: Math.round(w * k), h: Math.round(h * k) };
  }
  /** API の結果（文でも写真でも）→ 表示の状態。写真のときは読み取った原文（source）を欄に入れる値も返す */
  function fromResult(j, typed) {
    var source = j.source || typed || '';
    return {
      textarea: j.source ? j.source : null, // 写真のときだけ欄を書き換える（文のときは打った文のまま）
      last: { source: source, output: j.output, long: j.long || [], added: j.added || [], missingNumbers: j.missingNumbers || [], tr: {} }
    };
  }
  var api = { MAX_SIDE: MAX_SIDE, LANGS: LANGS, fitSize: fitSize, fromResult: fromResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YFlow = api;
})(this);
