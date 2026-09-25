// ===========================
// 脳トレプリント — 画面の制御。問題と用紙は gen.js、語は kanji-data.js・kana-data.js
// ===========================
(function () {
  'use strict';
  var Calc = window.Calc, O = window.Otasuke, G = window.NotoreGen, $ = O.$;
  var KEY = 'notore';
  var form = $('form');

  var LEVEL_HINT = {
    calc: { easy: '1 けた（九九の範囲）', normal: '2 けた', hard: '3 けた・2 けた×1 けた' },
    kanji: { easy: '小学校で習う字の語', normal: '中学以降の字を含む語', hard: '特別な読み（時雨・老舗）と中学以降の字の熟語' },
    machigai: { easy: '図形 12・ちがい 3 つ', normal: '図形 20・ちがい 5 つ', hard: '図形 35・ちがい 7 つ' },
    cross: { easy: '語 6 つ・ます大きめ', normal: '語 10', hard: '語 12' },
    nurie: { easy: '大きな模様', normal: '模様 5 重', hard: '細かい模様 7 重' },
  };

  function newSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 4294967296); }
  }
  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }
  function setRadio(name, v) { var e = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (e) e.checked = true; }

  var seed = null;
  function current() {
    return Calc.normNotore({
      kind: radio('kind'), level: radio('level'), pages: $('pages').value, answers: $('answers').checked, op: radio('op'),
      month: $('month').value, name: $('name').value.trim(), credit: $('credit').checked, seed: seed,
    });
  }
  function apply(d) {
    d = Calc.normNotore(d);
    setRadio('kind', d.kind); setRadio('level', d.level); setRadio('op', d.op);
    $('pages').value = String(d.pages); $('answers').checked = d.answers; $('month').value = d.month;
    $('name').value = d.name; $('credit').checked = d.credit;
    seed = d.seed === null ? newSeed() : d.seed;
  }

  function render(d) {
    var r = G.buildSheets(d, { kanji: window.NotoreKanji, kana: window.NotoreKana, today: new Date() });
    $('sheets').innerHTML = r.html;
    $('pages-note').textContent = 'A4 縦 ' + r.sheets + ' 枚・問題番号 ' + G.seedLabel(d.seed);
    $('level-hint').textContent = LEVEL_HINT[d.kind][d.level];
    $('op-field').classList.toggle('hidden-kind', d.kind !== 'calc');
    $('month-field').classList.toggle('hidden-kind', d.kind !== 'nurie');
    $('answers-row').classList.toggle('hidden-kind', d.kind === 'nurie');
    $('show-all').hidden = r.sheets < 2;
    O.fitPreview($('wrap'));
    var state = [];
    if (d.kind === 'calc') state.push(G.OP_NAMES[d.op]);
    if (d.kind === 'nurie') state.push(d.month ? d.month.replace('-', '年') + '月から' : '今月（21 日からは来月）から');
    state.push(d.name ? '名前あり' : '名前は手書き');
    window.YorozuScreen.detailsSummary({ 'opt-more': state.join('・') });
  }

  function update() {
    var d = current();
    render(d);
    if (!sharedView) O.store.set(KEY, d);
  }

  // 共有リンクで開いたときは、何か変えるまで端末の保存を上書きしない（名前はリンクに入らない）
  var shared = O.readShare();
  var sharedView = !!(shared && shared.t === 'notore');
  apply(sharedView ? shared : (O.store.get(KEY) || {}));
  form.addEventListener('input', function () { sharedView = false; update(); });
  form.addEventListener('change', function () { sharedView = false; update(); });
  update();
  O.watchPreview($('wrap'));

  $('reroll').addEventListener('click', function () { sharedView = false; seed = newSeed(); update(); });
  $('show-all').addEventListener('click', function () {
    var all = $('wrap').classList.toggle('all');
    this.setAttribute('aria-expanded', all ? 'true' : 'false');
    this.textContent = all ? '1 枚めだけ見る' : 'すべての見本と答えを見る';
    O.fitPreview($('wrap'));
  });
  $('seed-go').addEventListener('click', function () {
    var n = G.parseSeedLabel($('seed-in').value);
    if (n === null) { $('seed-msg').textContent = '「12345-67890」のような 10 けたの数字を入れてください。'; return; }
    sharedView = false; seed = n; update();
    $('seed-msg').textContent = '問題番号 ' + G.seedLabel(n) + ' で作りました。';
  });

  O.printSetup({ button: 'print' });
  O.shareSetup({ button: 'share', msg: 'share-msg', get: function () {
    var d = current();
    return { t: 'notore', kind: d.kind, level: d.level, pages: d.pages, answers: d.answers, op: d.op, month: d.month, credit: d.credit, seed: d.seed };
  } });
  O.backupSetup({ key: KEY, afterImport: function () { apply(O.store.get(KEY) || {}); update(); } });
  O.registerSW('../sw.js');
})();
