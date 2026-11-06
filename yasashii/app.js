// やさしい日本語に言い換え（yorozu-plans ROADMAP 7.33.1 K147・7.34.1 K163・7.34.2 K164、企画書 80・81）。言い換え・写真の読み取り・翻訳は yorozu-ai（Workers AI）。
// 貼った文も写真もこの画面に置くだけで、保存しない（ブラウザにも残さない）。送るのはボタンを押したときだけ。
(function () {
  'use strict';
  var API = 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/yasashii';
  var MAX = 2000;
  var SAMPLE = '令和8年度の国民年金保険料納付書をお送りします。お近くの金融機関・郵便局・コンビニエンスストアなどで納付してください。前納の納付書をご希望の際は、お近くの年金事務所にお問い合わせください。';
  var ERR = {
    busy: '今日は混んでいます。明日また使ってください。',
    tooLong: '長すぎます。2,000字までにしてください。',
    tooLarge: '写真が大きすぎます。',
    type: 'この形式の写真は読めません。カメラで撮った写真を選んでください。',
    noText: '写真から文字が読めませんでした。明るい所で、紙をまっすぐ撮ってください。',
    empty: '文を貼ってください。',
    timeout: '時間がかかりすぎました。もう一度押してください。',
    other: 'うまくいきませんでした。少し待って、もう一度押してください。'
  };
  // AI の枠切れ（error 'quota'）の文はサーバー（yorozu-ai の QUOTA_MESSAGE）が持つ。ここに写さない（D298）
  function errText(j) { return (j && j.error === 'quota' && j.message) || ERR[j && j.error] || ERR.other; }
  function $(id) { return document.getElementById(id); }
  var text = $('text');
  var last = null; // 直前の結果（ふりがなの切り替え・翻訳・コピー用）

  function setStatus(msg, cls) {
    $('status').innerHTML = '<p class="' + (cls || 'small') + '"></p>';
    $('status').firstChild.textContent = msg;
  }
  function count() { $('count').textContent = String(Array.from(text.value).length); }
  function busy(on) { $('go').disabled = on; $('photo-btn').disabled = on; }

  function render() {
    if (!last) return;
    var ruby = $('ruby').checked;
    var marked = {};
    last.long.concat(last.added).forEach(function (s) { marked[s] = true; });
    $('src').innerHTML = '';
    last.source.split(/\n+/).forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      $('src').appendChild(p);
    });
    $('out').innerHTML = last.output.split('\n').filter(Boolean).map(function (line) {
      var mark = marked[line] ? '<span class="mark" title="短くできなかった文か、原文に無い数字がある文です">⚠</span>' : '';
      return '<p' + (marked[line] ? ' class="marked"' : '') + '>' + mark + window.Ruby.toHtml(line, ruby) + '</p>';
    }).join('');
    var w = [];
    if (last.missingNumbers.length) w.push('原文の数字 ' + last.missingNumbers.join('・') + ' が言い換えに出てきません。原文で確かめてください。');
    if (last.added.length) w.push('⚠ の文には、原文に無い数字があります。');
    $('warn').hidden = !w.length;
    $('warn').textContent = w.join(' ');
    $('pair').hidden = false;
    showLang();
    window.yzUsed?.();
  }

  /** 結果を受け取る（文でも写真でも） */
  function take(j, typed) {
    var s = window.YFlow.fromResult(j, typed);
    if (s.textarea !== null) { text.value = s.textarea; count(); $('photo-note').hidden = false; }
    stopSpeak();
    last = s.last;
    document.querySelector('input[name="lang"][value=""]').checked = true;
    $('status').innerHTML = '';
    render();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function post(path, body, waitMsg, done) {
    busy(true);
    setStatus(waitMsg);
    fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) { setStatus(errText(j), 'error'); return; } done(j); })
      .catch(function () { setStatus(ERR.other, 'error'); })
      .then(function () { busy(false); });
  }

  function go() {
    var src = text.value.trim();
    if (!src) { setStatus(ERR.empty, 'error'); return; }
    if (Array.from(src).length > MAX) { setStatus(ERR.tooLong, 'error'); return; }
    post('', { text: src }, '言い換えています…（20秒ほどかかることがあります）', function (j) { take(j, src); });
  }

  // 写真: ブラウザで長辺 1,600px の JPEG に縮めてから送る（送る量を減らす。写真はこの画面のメモリにだけある）
  function photo(file) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var s = window.YFlow.fitSize(img.naturalWidth, img.naturalHeight);
      var c = document.createElement('canvas');
      c.width = s.w; c.height = s.h;
      c.getContext('2d').drawImage(img, 0, 0, s.w, s.h);
      URL.revokeObjectURL(url);
      post('/photo', { image: c.toDataURL('image/jpeg', 0.85) }, '写真を読んでいます…（30秒ほどかかることがあります）', function (j) { take(j, ''); });
    };
    img.onerror = function () { URL.revokeObjectURL(url); setStatus(ERR.type, 'error'); };
    img.src = url;
  }

  // 翻訳（やさしい日本語の出力を訳す。同じ結果の訳は覚えておき、もう一度は送らない）
  function showLang() {
    var lang = (document.querySelector('input[name="lang"]:checked') || {}).value || '';
    var box = $('tr');
    if (!lang || !last) { box.hidden = true; showSpeak(); return; }
    var hit = last.tr[lang];
    if (hit) {
      box.hidden = false;
      box.lang = lang === 'zh' ? 'zh-Hans' : lang;
      $('tr-notice').textContent = hit.notice;
      $('tr-text').innerHTML = '';
      hit.text.split('\n').forEach(function (line) { var p = document.createElement('p'); p.textContent = line; $('tr-text').appendChild(p); });
      $('tr-lost').hidden = !hit.lost.length;
      $('tr-lost').textContent = hit.lost.length ? '原文の数字 ' + hit.lost.join('・') + ' が訳に出てきません。原文で確かめてください。' : '';
      showSpeak();
      return;
    }
    showSpeak();
    var keep = last;
    post('/translate', { text: last.output, lang: lang }, '訳しています…', function (j) {
      if (keep !== last) return; // その間に別の結果になった
      last.tr[lang] = j;
      $('status').innerHTML = '';
      showLang();
    });
  }

  // 読み上げ（K165。企画書 81 の 6 章、D515）: やさしい日本語か、選んだ言語の訳を、端末のブラウザの読み上げ（speechSynthesis）で読む。文は端末から出ない。
  // その言語の声が端末に無ければボタンを出さない。日本語の声が無い端末では「読んでもらう」そのものを出さない（押せないボタンを置かない）
  var synth = window.speechSynthesis || null;
  var voices = [];
  var speakState = 'idle';
  var reading = null; // { parts, at, gen }（読んでいる文の列・いま読んでいる位置）
  var gen = 0; // 止めたあとに届く古い onend・onerror を無視するための番号
  function voiceFor(lang) {
    return synth && typeof window.SpeechSynthesisUtterance === 'function' ? window.YFlow.pickVoice(voices, lang) : null;
  }
  function loadVoices() { voices = synth ? synth.getVoices() : []; showSpeak(); }
  function speakTarget() {
    var lang = (document.querySelector('input[name="lang"]:checked') || {}).value || '';
    if (!last || !voiceFor('ja')) return null;
    if (!lang) return { lang: 'ja', text: last.output };
    var hit = last.tr[lang];
    return hit && voiceFor(lang) ? { lang: lang, text: hit.text } : null;
  }
  function showSpeak() {
    var t = speakTarget();
    $('speak-row').hidden = !t;
    $('speak').textContent = window.YFlow.SPEAK_LABEL[speakState];
    $('speak').classList.toggle('playing', speakState !== 'idle');
  }
  function rate() { return window.YFlow.RATE[(document.querySelector('input[name="rate"]:checked') || {}).value || 'normal']; }
  function hush() { gen++; reading = null; if (synth) synth.cancel(); }
  function stopSpeak() { if (speakState !== 'idle') { speakState = 'idle'; hush(); showSpeak(); } }
  /** reading.at から終わりまでを、続けて読み上げに渡す（文ごとに 1 つ） */
  function readFrom(t) {
    var my = gen;
    var v = voiceFor(t.lang);
    reading.parts.slice(reading.at).forEach(function (text, i, rest) {
      var u = new window.SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = rate();
      u.onstart = function () { if (my === gen && reading) reading.at = reading.at0 + i; };
      if (i === rest.length - 1) u.onend = function () { if (my === gen) speakDo('ended'); };
      u.onerror = function () { if (my === gen) { hush(); speakDo('error'); } };
      synth.speak(u);
    });
  }
  function speakDo(ev) {
    var s = window.YFlow.speakStep(speakState, ev);
    speakState = s.state;
    if (s.action === 'stop' || ev === 'ended') hush();
    if (s.action === 'play') {
      var t = speakTarget();
      if (!t) { speakState = 'idle'; showSpeak(); return; }
      hush();
      reading = { lang: t.lang, parts: window.YFlow.speechParts(t.text), at: 0, at0: 0 };
      if (!reading.parts.length) { speakState = 'idle'; reading = null; showSpeak(); return; }
      readFrom(reading);
    }
    showSpeak();
  }
  $('speak').addEventListener('click', function () { speakDo('press'); });
  // 速さを読んでいる途中で変えたら、いま読んでいる文から読み直す
  Array.prototype.forEach.call(document.querySelectorAll('input[name="rate"]'), function (r) {
    r.addEventListener('change', function () {
      if (speakState !== 'playing' || !reading) return;
      var keep = { lang: reading.lang, parts: reading.parts, at: reading.at, at0: reading.at };
      hush();
      reading = keep;
      readFrom(reading);
    });
  });
  if (synth) {
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices); // Chrome は声の一覧が後から届く
    else synth.onvoiceschanged = loadVoices;
    loadVoices();
  }
  window.addEventListener('pagehide', stopSpeak);

  $('go').addEventListener('click', go);
  text.addEventListener('input', count);
  $('ruby').addEventListener('change', render);
  Array.prototype.forEach.call(document.querySelectorAll('input[name="lang"]'), function (r) { r.addEventListener('change', function () { stopSpeak(); showLang(); }); });
  $('photo-btn').addEventListener('click', function () { $('photo-file').click(); });
  $('photo-file').addEventListener('change', function () { photo(this.files && this.files[0]); this.value = ''; });
  $('clear').addEventListener('click', function () { text.value = ''; count(); $('photo-note').hidden = true; text.focus(); });
  $('sample').addEventListener('click', function () { text.value = SAMPLE; count(); });
  $('paste').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { text.focus(); return; }
    navigator.clipboard.readText().then(function (t) { text.value = t.slice(0, MAX); count(); }).catch(function () { text.focus(); });
  });
  $('copy').addEventListener('click', function () {
    if (!last || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.Ruby.plain(last.output)).then(function () { $('copy').textContent = 'コピーしました'; setTimeout(function () { $('copy').textContent = '言い換えをコピー'; }, 2000); });
  });
  count();
})();
