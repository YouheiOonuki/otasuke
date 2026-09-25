// ===========================
// くらしのおたすけ — 各ページで共通の画面の部品（保存・見本の縮小・印刷・共有・書き出し）
// constants.js・calc.js・screen.js のあとに読む。window.Otasuke に置く
// ===========================
(function () {
  'use strict';
  var Calc = window.Calc;

  // --- ブラウザへの保存（README「ツールを追加するとき」12） ---
  // キーは必ず "otasuke_" で始める。全ツールが同じオリジンで localStorage を共有しているため
  var PREFIX = 'otasuke_';
  var KEYS = ['shakyo', 'reizoko', 'daicho', 'tejun', 'tokei', 'notore'];
  var NORM = { shakyo: Calc.normShakyo, reizoko: Calc.normReizoko, daicho: Calc.normDaicho, tejun: Calc.normTejun, tokei: Calc.normTokei, notore: Calc.normNotore };
  var store = {
    get: function (name) {
      try {
        var v = localStorage.getItem(PREFIX + name);
        return v === null ? null : JSON.parse(v);
      } catch (e) { return null; }   // 保存できない環境（プライベートモードなど）でも動くように
    },
    set: function (name, value) {
      try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove: function (name) { try { localStorage.removeItem(PREFIX + name); } catch (e) { /* 続ける */ } },
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- 見本の縮小: 用紙（mm）を画面の幅に合わせる。印刷では縮小を外す（style.css） ---
  function fitPreview(wrap) {
    var sheets = wrap.querySelector('.sheets');
    if (!sheets) return;
    sheets.style.transform = 'none';
    var w = sheets.scrollWidth, h = sheets.scrollHeight;
    var avail = wrap.clientWidth;
    var s = w > 0 ? Math.min(1, avail / w) : 1;
    sheets.style.transform = 'scale(' + s + ')';
    wrap.style.height = Math.ceil(h * s) + 'px';
  }
  var fitTargets = [];
  function watchPreview(wrap) {
    fitTargets.push(wrap);
    fitPreview(wrap);
  }
  var fitTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(function () { fitTargets.forEach(fitPreview); }, 100);
  });

  // --- 印刷: 主なボタンと固定バー（SCREEN.md 1.2 の 4）。見本の DOM がそのまま刷られるので、ブラウザのメニューからでも白紙にならない ---
  function printSetup(o) {
    var btn = $(o.button);
    btn.addEventListener('click', function () { window.print(); });
    // 上端の固定バー: 印刷ボタンを通り過ぎて下へ読み進めたときだけ出す（読み込み直後に見出しを隠さない）
    var bar = $('fixbar');
    if (bar && 'IntersectionObserver' in window) {
      $('fixbar-text').textContent = '印刷する';
      bar.querySelector('button').addEventListener('click', function () { window.print(); });
      new IntersectionObserver(function (es) {
        var e = es[es.length - 1];
        bar.hidden = e.isIntersecting || e.boundingClientRect.top > 0;
      }).observe(btn);
    }
  }

  // --- 共有リンク（#s=。README 11）。個人の欄は呼ぶ側で入れない ---
  function shareSetup(o) {
    var btn = $(o.button), msg = $(o.msg);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = location.href.split('#')[0] + Calc.encodeShare(o.get());
      var done = function () { msg.textContent = 'リンクをコピーしました。' + (o.note || ''); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { msg.textContent = url; });
      else msg.textContent = url;
      try { history.replaceState(null, '', url); } catch (e) { /* 続ける */ }
    });
  }
  function readShare() { return Calc.decodeShare(location.hash); }

  // --- ファイルへの書き出し・読み込み（README「ツールを追加するとき」20。決定 D31） ---
  // このリポジトリの各ページの保存をまとめて 1 つのファイルにする（data は保存と同じ形: { shakyo, reizoko, ... }）
  var TOOL = 'otasuke';
  function allData() {
    var d = {};
    KEYS.forEach(function (k) { var v = store.get(k); if (v) d[k] = v; });
    return d;
  }
  function backupSetup(o) {
    var msg = $('backup-msg');
    $('backup-export').addEventListener('click', function () {
      if (o.beforeExport) o.beforeExport();
      var blob = new Blob([JSON.stringify(Calc.buildBackup(TOOL, allData()), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = Calc.backupFileName(TOOL);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      msg.textContent = 'ファイルに書き出しました（くらしのおたすけのすべての道具の入力をまとめて）。機種変更のときは、このファイルを新しい端末に移して「ファイルから読み込む」を押してください。';
    });
    $('backup-import').addEventListener('click', function () { $('backup-file').click(); });
    $('backup-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { msg.textContent = 'ファイルが大きすぎます。このツールで書き出したファイルを選んでください。'; return; }
      file.text().then(function (text) {
        var r = Calc.parseBackup(text, TOOL, []);
        if (!r.ok) { msg.textContent = r.error; return; }
        var keys = KEYS.filter(function (k) { return r.data[k] && typeof r.data[k] === 'object'; });
        if (!keys.length) { msg.textContent = 'ファイルの中身が足りないため読み込めません。'; return; }
        if (!window.confirm('ファイルの内容で、この端末に保存している入力を置き換えます。よろしいですか？')) return;
        keys.forEach(function (k) { store.set(k, NORM[k](r.data[k])); });
        if (o.afterImport) o.afterImport();
        msg.textContent = 'ファイルから読み込みました。';
      }, function () { msg.textContent = 'ファイルを読み取れませんでした。'; });
    });
    if ($('data-clear')) {
      $('data-clear').addEventListener('click', function () {
        if (!window.confirm('この画面の入力を消して、この端末からも消します。よろしいですか？')) return;
        store.remove(o.key);
        if (o.afterClear) o.afterClear();
        msg.textContent = 'この端末から消しました。';
      });
    }
  }

  // --- Service Worker（オフラインで開けるように。README 13: './sw.js' だけで登録。scope を指定しない） ---
  function registerSW(path) {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () { navigator.serviceWorker.register(path).catch(function () {}); });
    }
  }

  function credit() { return '<div class="credit">yorozu-craft.com/otasuke/print/ で作成</div>'; }

  window.Otasuke = {
    store: store, $: $, esc: esc, watchPreview: watchPreview, fitPreview: fitPreview, printSetup: printSetup,
    shareSetup: shareSetup, readShare: readShare, backupSetup: backupSetup, registerSW: registerSW, credit: credit,
  };
})();
