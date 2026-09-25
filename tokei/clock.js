// ===========================
// 日めくり大時計 — 画面の制御。古いタブレットでも動くよう ES5 で書く（Promise・アロー関数・let を使わない）
// 文字は calc.js の clockParts。画面を消さない機能（Screen Wake Lock API）は、使えない端末では設定の案内を出す
// ===========================
(function () {
  'use strict';
  var C = window.Constants, Calc = window.Calc;
  var KEY = 'otasuke_tokei';   // README 12: 接頭辞は otasuke_
  function $(id) { return document.getElementById(id); }

  function load() {
    try { var v = localStorage.getItem(KEY); return Calc.normTokei(v ? JSON.parse(v) : {}); } catch (e) { return Calc.normTokei({}); }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 保存できなくても動く */ } }

  var opt = load();
  var firstVisit = true;
  try { firstVisit = localStorage.getItem(KEY) === null; } catch (e) { /* はじめて扱い */ }

  // --- 設定の画面 ---
  function toForm() {
    $('h24').checked = opt.h24; $('wareki').checked = opt.wareki; $('seconds').checked = opt.seconds;
    var r = document.querySelector('input[name="theme"][value="' + opt.theme + '"]'); if (r) r.checked = true;
  }
  function fromForm() {
    var r = document.querySelector('input[name="theme"]:checked');
    opt = Calc.normTokei({ h24: $('h24').checked, wareki: $('wareki').checked, seconds: $('seconds').checked, theme: r ? r.value : 'dark' });
    save(opt);
    document.body.className = opt.theme;
    last = '';
    tick();
  }
  var inputs = document.querySelectorAll('#setup input');
  for (var i = 0; i < inputs.length; i++) inputs[i].addEventListener('change', fromForm);
  $('wl-note').textContent = C.wakeLock.note;

  function showSetup(show) {
    $('setup').hidden = !show;
    $('open-setup').hidden = show;
  }
  $('open-setup').addEventListener('click', function () { showSetup(true); });
  $('start').addEventListener('click', function () { save(opt); showSetup(false); requestWakeLock(); fit(); });

  // --- 全画面 ---
  $('fs').addEventListener('click', function () {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { try { var p = req.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* 使えない端末 */ } }
    else $('wl-status').textContent = 'この端末は画面いっぱいにできません。「ホーム画面に追加」すると、上下の枠が消えることがあります。';
    showSetup(false); requestWakeLock(); setTimeout(fit, 300);
  });

  // --- 画面を消さない（Screen Wake Lock API）。ページが隠れると外れるので、見えたときに取り直す ---
  var lock = null;
  function status(t) { $('wl-status').textContent = t; }
  function requestWakeLock() {
    if (!('wakeLock' in navigator) || !navigator.wakeLock.request) {
      status('この端末では、画面を消さない設定をページから使えません。端末の設定で自動ロックを「なし」にしてください。');
      return;
    }
    try {
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        status('このページを開いている間は、画面を消さないようにしました。');
        l.addEventListener('release', function () { lock = null; });
      }, function () {
        status('画面を消さない設定ができませんでした（電池の節約モードなど）。端末の設定で自動ロックを「なし」にしてください。');
      });
    } catch (e) { status('画面を消さない設定ができませんでした。端末の設定で自動ロックを「なし」にしてください。'); }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { last = ''; tick(); if (!lock && $('setup').hidden) requestWakeLock(); }
  });

  // --- 時計 ---
  var last = '';
  function fit() {
    var W = window.innerWidth, H = window.innerHeight;
    var p = Calc.clockParts(new Date(), { h24: opt.h24, wareki: opt.wareki, reiwaStart: C.reiwa.start });
    var dateText = p.year + ' ' + p.date;
    // 1 文字の幅を、全角 ≒ 1.0em・数字 ≒ 0.6em で見積もる
    function em(s) { var n = 0; for (var i = 0; i < s.length; i++) n += /[0-9: ]/.test(s.charAt(i)) ? 0.6 : 1.0; return n; }
    // 縦長の画面では「午前・午後」を時刻の上の行に分け、時刻を大きくする
    var narrow = W < H * 0.9;
    $('clock').className = narrow ? 'clock narrow' : 'clock';
    var timeEm = em(p.time) + (p.ampm && !narrow ? 0.42 * 2 + 0.2 : 0) + (opt.seconds ? 0.3 * 2 + 0.2 : 0);
    var tSize = Math.min(H * (narrow ? 0.30 : 0.40), W * 0.92 / timeEm);
    var dSize = Math.min(H * 0.13, W * 0.92 / em(dateText));
    var wSize = Math.min(H * 0.20, W * 0.92 / em(p.week));
    $('c-time').parentNode.style.fontSize = Math.floor(tSize) + 'px';
    $('c-date').style.fontSize = Math.floor(dSize) + 'px';
    $('c-week').style.fontSize = Math.floor(wSize) + 'px';
  }
  function tick() {
    var d = new Date();
    var p = Calc.clockParts(d, { h24: opt.h24, wareki: opt.wareki, reiwaStart: C.reiwa.start });
    var key = p.year + p.date + p.week + p.ampm + p.time + (opt.seconds ? p.sec : '');
    if (key !== last) {
      last = key;
      $('c-date').textContent = p.year + ' ' + p.date;
      $('c-week').textContent = p.week;
      $('c-ampm').textContent = p.ampm;
      $('c-time').textContent = p.time;
      $('c-sec').textContent = opt.seconds ? p.sec : '';
      fit();
    }
  }
  // 次の秒のはじめに合わせて呼ぶ（呼び出しの列は 1 本だけ）
  function loop() { tick(); setTimeout(loop, 1000 - (Date.now() % 1000) + 20); }
  window.addEventListener('resize', function () { fit(); });
  window.addEventListener('orientationchange', function () { setTimeout(fit, 300); });

  toForm();
  document.body.className = opt.theme;
  showSetup(firstVisit);
  loop();
  if (!firstVisit) requestWakeLock();

  // オフラインで開けるように（README 13: 登録は sw.js の場所だけ。scope を指定しない）
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('../sw.js').catch(function () {}); });
  }
})();
