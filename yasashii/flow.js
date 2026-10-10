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
  // 読み上げ（K165）: 読める言語（ja はやさしい日本語、en・zh は訳）。vi・pt は読めないのでボタンを出さない
  var SPEAK = { ja: true, en: true, zh: true };
  var RATE = { normal: 1, slow: 0.8 }; // ふつう／ゆっくり（ブラウザの再生の速さ。音の高さは変えない）
  /**
   * 読み上げボタンの状態。idle（読んでもらう）→ loading（用意しています…）→ playing（止める）→ idle。
   * ev: 'press'（ボタンを押す）| 'ready'（音が届いた）| 'ended'（終わった）| 'error'。返りは { state, action }
   * action: 'fetch'（音をもらう）| 'play' | 'stop' | null
   */
  function speakStep(state, ev) {
    if (ev === 'press') {
      if (state === 'idle') return { state: 'loading', action: 'fetch' };
      return { state: 'idle', action: 'stop' }; // 用意中・再生中に押したら止める
    }
    if (ev === 'ready') return state === 'loading' ? { state: 'playing', action: 'play' } : { state: state, action: null };
    if (ev === 'ended' || ev === 'error') return { state: 'idle', action: null };
    return { state: state, action: null };
  }
  var SPEAK_LABEL = { idle: '🔊 読んでもらう', loading: '用意しています…（押すとやめます）', playing: '■ 止める' };
  var api = { MAX_SIDE: MAX_SIDE, LANGS: LANGS, fitSize: fitSize, fromResult: fromResult, SPEAK: SPEAK, RATE: RATE, speakStep: speakStep, SPEAK_LABEL: SPEAK_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YFlow = api;
})(this);
