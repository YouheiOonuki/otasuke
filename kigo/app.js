// ===========================
// 季語カレンダー — 画面の制御。季語は kigo-data.js、季節の区切りは sekki.js と constants.js の暦要項、紙は sheet.js
// ===========================
(function () {
  'use strict';
  var C = window.Constants, Calc = window.Calc, O = window.Otasuke, S = window.KigoSheet, $ = O.$, esc = O.esc;
  var DATA = window.KigoData, KNOWN = C.sekki.table;
  var KEY = 'kigo';
  var form = $('form');

  function isoToday() { return Calc.toISO(new Date()); }
  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }
  function setRadio(name, v) { var e = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (e) e.checked = true; }

  function current() {
    return Calc.normKigo({ season: radio('season'), form: radio('form'), yomi: $('yomi').checked, size: radio('size'), credit: $('credit').checked });
  }
  function apply(d) {
    d = Calc.normKigo(d);
    setRadio('season', d.season); setRadio('form', d.form); setRadio('size', d.size);
    $('yomi').checked = d.yomi; $('credit').checked = d.credit;
  }

  // 今日の季語
  function renderToday(iso) {
    var t = S.today(iso, DATA, KNOWN);
    var main = t.pick[0];
    var h = '<p class="t-date">' + esc(S.dateLabel(iso)) + ' は <strong>' + esc(t.season) + '</strong>。今日の季語は</p>';
    h += '<p class="t-word">' + esc(main[1]) + (main[2] ? '<span class="t-yomi">' + esc(main[2]) + '</span>' : '') + '</p><p class="t-expl">' + esc(main[3]) + '</p>';
    // ほかの季語と季節の期間は、見本のあと（最初の操作を上に保つ。SCREEN 2 章）
    var m = '<p>ほかに: ' + t.pick.slice(1).map(function (r) { return esc(r[1]) + (r[2] ? '（' + esc(r[2]) + '）' : ''); }).join('・') + '</p>';
    if (t.period) {
      m += '<p class="small">' + esc(t.base) + 'は ' + esc(t.period.fromName) + '（' + esc(S.md(t.period.from)) + '）から ' + esc(t.period.toName) + 'の前日（' + esc(S.md(t.period.to)) + '）まで。' +
        '次の区切りは ' + esc(t.nextName) + '（' + esc(S.ymd(t.next)) + '）' + (t.period.calc ? '。日付は計算による目安です' : '') + '。</p>';
    }
    $('today-more').innerHTML = m;
    $('today').innerHTML = h;
    $('now-label').textContent = '今の季節（' + t.season + '）';
    return t;
  }

  // 今年の二十四節気
  function renderSekki(iso) {
    var y = Number(iso.slice(0, 4));
    var terms = window.Sekki.termsOfYear(y, KNOWN);
    var fromTable = terms[0].from === 'table';
    $('sekki').innerHTML = '<table class="sekki"><tbody>' + terms.map(function (t) {
      return '<tr' + (/^立/.test(t.name) ? ' class="risshun"' : '') + '><th>' + esc(t.name) + '</th><td>' + esc(S.md(t.date)) + '</td></tr>';
    }).join('') + '</tbody></table><p class="small">' + (fromTable
      ? '国立天文台「暦要項」（' + y + '年）の日付（日本時間）。'
      : '太陽の位置から計算した日付（目安。国立天文台の暦要項の値ではありません）。') + '</p>';
  }

  var todayInfo = null;
  function render(d) {
    var season = d.season === 'now' ? todayInfo.season : d.season;
    var r = S.buildSheets({ season: season, form: d.form, yomi: d.yomi, size: d.size, credit: d.credit }, DATA, isoToday(), KNOWN, O.credit());
    $('sheets').innerHTML = r.html;
    $('pages-note').textContent = 'A4 縦 ' + r.sheets + ' 枚';
    $('show-all').hidden = r.sheets < 2;
    O.fitPreview($('wrap'));
    window.YorozuScreen.detailsSummary({ 'opt-more': [d.yomi ? '読みがなあり' : '読みがななし', d.size === 'large' ? '大きい字' : 'ふつうの字'].join('・') });
  }

  function update() {
    var d = current();
    render(d);
    if (!sharedView) O.store.set(KEY, d);
  }

  var iso = isoToday();
  todayInfo = renderToday(iso);
  renderSekki(iso);

  var shared = O.readShare();
  var sharedView = !!(shared && shared.t === 'kigo');
  apply(sharedView ? shared : (O.store.get(KEY) || {}));
  form.addEventListener('change', function () { sharedView = false; update(); });
  update();
  O.watchPreview($('wrap'));

  $('show-all').addEventListener('click', function () {
    var all = $('wrap').classList.toggle('all');
    this.setAttribute('aria-expanded', all ? 'true' : 'false');
    this.textContent = all ? '1 枚めだけ見る' : 'すべての見本を見る';
    O.fitPreview($('wrap'));
  });

  O.printSetup({ button: 'print' });
  O.shareSetup({ button: 'share', msg: 'share-msg', get: function () {
    var d = current();
    return { t: 'kigo', season: d.season, form: d.form, yomi: d.yomi, size: d.size, credit: d.credit };
  } });
  O.backupSetup({ key: KEY, afterImport: function () { apply(O.store.get(KEY) || {}); update(); } });
  O.registerSW('../sw.js');
})();
