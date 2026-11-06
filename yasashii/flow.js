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
  // 読み上げ（K165。yorozu-plans 企画書 81 の 6 章、D515）: 端末のブラウザの読み上げ（speechSynthesis）で読む。文は端末から出ない。
  // 言語 → 先に選ぶ声の言語タグ（その言語の声が端末に無ければ、その言語ではボタンを出さない）
  var SPEAK = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN', vi: 'vi-VN', pt: 'pt-BR' };
  var RATE = { normal: 1, slow: 0.75 }; // ふつう／ゆっくり
  /** 声の一覧（getVoices() の形）から、その言語の声を 1 つ。先に SPEAK のタグに合う声、次に端末の中の声（localService）。無ければ null */
  function pickVoice(voices, lang) {
    var tag = SPEAK[lang];
    if (!tag) return null;
    var norm = function (s) { return String(s || '').replace(/_/g, '-').toLowerCase(); };
    var same = (voices || []).filter(function (v) { var l = norm(v.lang); return l === lang || l.indexOf(lang + '-') === 0; });
    var rank = function (v) { return (norm(v.lang) === tag.toLowerCase() ? 0 : 2) + (v.localService === false ? 1 : 0); };
    return same.slice().sort(function (a, b) { return rank(a) - rank(b); })[0] || null;
  }
  /**
   * 読む文。ふりがなを外す。1 字の漢字の言葉だけ読みに置き換える（「月《つき》」を「がつ」と読まないように。企画書 81 の 6 章）。
   * 2 字以上は読み上げに任せる。数字・日付はかなに直さない（D515）
   */
  // 後読み（?<=）は使わない: 古い iPhone の Safari（16.4 より前）で、このファイルごと読めなくなる
  function speechText(s) {
    return String(s).replace(/([一-鿿々]+)《([^《》]*)》/g, function (m, kanji, yomi, at, all) {
      var one = kanji.length === 1 && /^[ぁ-ん]+$/.test(yomi) && !/\d/.test(all.charAt(at - 1)) && !/[一-鿿]/.test(all.charAt(at + m.length));
      return one ? yomi : kanji;
    }).replace(/《[^《》]*》/g, ''); // 漢字でない語の後ろの《》（カタカナの言葉など）は捨てる
  }
  /** 読む文を、行と文の終わりで区切った列に（長い 1 つを渡すと途中で止まる端末があるため、文ごとに続けて渡す。3.7 の点では切らない） */
  function speechParts(s) {
    return speechText(s).replace(/([。！？])/g, '$1\n').replace(/([.!?])\s+/g, '$1\n')
      .split('\n').map(function (p) { return p.trim(); }).filter(Boolean);
  }
  /**
   * 読み上げボタンの状態。idle（読んでもらう）→ playing（止める）→ idle。
   * ev: 'press'（ボタンを押す）| 'ended'（読み終えた）| 'error'。返りは { state, action }。action: 'play' | 'stop' | null
   */
  function speakStep(state, ev) {
    if (ev === 'press') return state === 'idle' ? { state: 'playing', action: 'play' } : { state: 'idle', action: 'stop' };
    if (ev === 'ended' || ev === 'error') return { state: 'idle', action: null };
    return { state: state, action: null };
  }
  var SPEAK_LABEL = { idle: '🔊 読んでもらう', playing: '■ 止める' };
  var api = { MAX_SIDE: MAX_SIDE, LANGS: LANGS, fitSize: fitSize, fromResult: fromResult, SPEAK: SPEAK, RATE: RATE, pickVoice: pickVoice, speechText: speechText, speechParts: speechParts, speakStep: speakStep, SPEAK_LABEL: SPEAK_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YFlow = api;
})(this);
