// ===========================
// 健診結果の経年グラフ — 画面の制御
// 線の値は kenshin-values.js、グラフ・CSV は kenshin-calc.js。判定の文（「〜を超えています」など）は出さない。
// 出すのは数字・折れ線・資料の線と、その名前だけ
// ===========================
(function () {
  'use strict';
  var Calc = window.Calc, O = window.Otasuke, V = window.KenshinValues, K = window.KenshinCalc, $ = O.$, esc = O.esc;
  var KEY = 'kenshin';
  var data = Calc.normKenshin(O.store.get(KEY) || {});
  var INPUT_ITEMS = V.ITEMS.filter(function (i) { return !i.calc; });

  function person() { return data.people[data.cur]; }
  function personName(p, i) { return p.name || (i + 1) + '人目'; }
  function save() { O.store.set(KEY, data); }

  // --- だれの記録 ---
  function renderPeople() {
    $('person').innerHTML = data.people.map(function (p, i) {
      return '<option value="' + i + '"' + (i === data.cur ? ' selected' : '') + '>' + esc(personName(p, i)) + '（' + p.records.length + ' 回）</option>';
    }).join('');
    var p = person();
    $('pname').value = p.name;
    var r = document.querySelector('input[name="sex"][value="' + p.sex + '"]');
    if (r) r.checked = true;
    $('add-person').disabled = data.people.length >= Calc.KENSHIN_MAX_PEOPLE;
  }
  $('person').addEventListener('change', function () { data.cur = Number(this.value); save(); renderAll(true); });
  $('add-person').addEventListener('click', function () {
    if (data.people.length >= Calc.KENSHIN_MAX_PEOPLE) return;
    data.people.push({ name: '', sex: '', records: [] });
    data.cur = data.people.length - 1;
    save(); renderAll(true);
    $('opt-person').open = true;
    $('pname').focus();
  });
  $('pname').addEventListener('input', function () { person().name = this.value.trim().slice(0, 20); save(); renderPeopleLabels(); renderCharts(); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="sex"]'), function (r) {
    r.addEventListener('change', function () { person().sex = this.value; save(); renderAll(false); });
  });
  $('del-person').addEventListener('click', function () {
    var p = person();
    if (!window.confirm(personName(p, data.cur) + ' の記録（' + p.records.length + ' 回分）を消します。消した記録は元に戻せません。よろしいですか？')) return;
    data.people.splice(data.cur, 1);
    data = Calc.normKenshin({ people: data.people, cur: Math.max(0, data.cur - 1) });
    save(); renderAll(true);
  });
  function renderPeopleLabels() {
    Array.prototype.forEach.call($('person').options, function (o, i) { o.textContent = personName(data.people[i], i) + '（' + data.people[i].records.length + ' 回）'; });
  }

  // --- 1 回分の入力 ---
  (function buildForm() {
    var m = '';
    for (var i = 1; i <= 12; i++) m += '<option value="' + (i < 10 ? '0' : '') + i + '">' + i + '月</option>';
    $('e-month').insertAdjacentHTML('beforeend', m);
    $('e-fields').innerHTML = INPUT_ITEMS.map(function (it) {
      return '<div class="field"><label for="e-' + it.key + '">' + esc(it.name) + ' <span class="unit">' + esc(it.unit) + '</span></label>' +
        '<input type="text" inputmode="decimal" id="e-' + it.key + '" data-k="' + it.key + '" autocomplete="off"></div>';
    }).join('') + '<div class="field"><span class="label">BMI <span class="unit">kg/m²</span></span><output id="e-bmi" class="bmi-out">—</output></div>';
  })();
  function formWhen() {
    var y = String($('e-year').value || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).trim();
    return Calc.kenshinWhen(y + ($('e-month').value ? '-' + $('e-month').value : ''));
  }
  function half(s) { return String(s || '').replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/,/g, '').trim(); }
  function readForm() {
    var v = {}, bad = [];
    INPUT_ITEMS.forEach(function (it) {
      var s = half($('e-' + it.key).value);
      if (s === '') return;
      var n = Calc.kenshinNum(it.key, s);
      if (n === null) bad.push(it.name); else v[it.key] = n;
    });
    return { v: v, bad: bad };
  }
  function fillForm(rec) {
    INPUT_ITEMS.forEach(function (it) { $('e-' + it.key).value = rec && rec.v[it.key] !== undefined ? rec.v[it.key] : ''; });
    $('e-random').checked = !!(rec && rec.random);
    updateBmi();
  }
  function updateBmi() {
    var f = readForm().v;
    var b = K.bmi(f.height, f.weight);
    $('e-bmi').textContent = b === null ? '—' : String(b);
  }
  function findRec(when) {
    var rs = person().records;
    for (var i = 0; i < rs.length; i++) if (rs[i].when === when) return rs[i];
    return null;
  }
  function updateMode() {
    var w = formWhen();
    var rec = w ? findRec(w) : null;
    $('e-mode').textContent = !w ? '' : rec ? K.whenLabel(w) + ' の記録があります。直して保存すると置き換えます。' : K.whenLabel(w) + ' の記録を新しく作ります。';
    $('e-save').textContent = rec ? 'この回を直して保存する' : 'この回を保存する';
    return rec;
  }
  function onWhenChange() {
    var rec = updateMode();
    if (rec) fillForm(rec);
    $('e-msg').textContent = '';
  }
  $('e-year').addEventListener('change', onWhenChange);
  $('e-month').addEventListener('change', onWhenChange);
  $('e-year').addEventListener('input', updateMode);
  $('e-fields').addEventListener('input', function () { updateBmi(); $('e-msg').textContent = ''; });
  $('e-clear').addEventListener('click', function () { $('e-year').value = ''; $('e-month').value = ''; fillForm(null); updateMode(); $('e-msg').textContent = ''; });
  $('e-save').addEventListener('click', function () {
    var w = formWhen();
    if (!w) { $('e-msg').textContent = '受けた年（1950〜2100）を入れてください。'; $('e-year').focus(); return; }
    var f = readForm();
    if (f.bad.length) { $('e-msg').textContent = f.bad.join('・') + ' の数字を確かめてください（単位は欄の右）。'; return; }
    if (!Object.keys(f.v).length) { $('e-msg').textContent = '数字が 1 つも入っていません。'; return; }
    var p = person();
    if (!findRec(w) && p.records.length >= Calc.KENSHIN_MAX_RECORDS) { $('e-msg').textContent = '1 人 ' + Calc.KENSHIN_MAX_RECORDS + ' 回までです。古い記録を消してから足してください。'; return; }
    p.records = p.records.filter(function (r) { return r.when !== w; });
    p.records.push({ when: w, random: $('e-random').checked, v: f.v });
    data = Calc.normKenshin(data);
    save();
    renderAll(false);
    $('e-mode').textContent = K.whenLabel(w) + ' の記録を保存しました。次の回を入れるときは、年を変えてください。';
    $('e-msg').textContent = '';
  });

  // --- 入れた記録の一覧（直す・消す） ---
  var LIST_COLS = ['sbp', 'dbp', 'hba1c', 'ldl'];
  function renderList() {
    var p = person();
    var head = '<thead><tr><th>年月</th>' + LIST_COLS.map(function (k) { return '<th>' + esc(K.itemOf(k).name) + '</th>'; }).join('') + '<th>入れた欄</th><th></th></tr></thead>';
    var body = p.records.slice().reverse().map(function (r) {
      return '<tr><td>' + esc(K.whenLabel(r.when)) + (r.random ? '<br><span class="small">随時</span>' : '') + '</td>' +
        LIST_COLS.map(function (k) { return '<td>' + (r.v[k] === undefined ? '—' : r.v[k]) + '</td>'; }).join('') +
        '<td>' + Object.keys(r.v).length + '</td>' +
        '<td><button type="button" class="btn btn-sub btn-s" data-edit="' + r.when + '">直す</button> <button type="button" class="btn btn-sub btn-s" data-del="' + r.when + '">消す</button></td></tr>';
    }).join('');
    $('rec-table').innerHTML = p.records.length ? head + '<tbody>' + body + '</tbody>' : '<tbody><tr><td>まだありません。</td></tr></tbody>';
  }
  $('rec-table').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var p = person();
    if (b.hasAttribute('data-del')) {
      var w = b.getAttribute('data-del');
      if (!window.confirm(K.whenLabel(w) + ' の記録を消します。よろしいですか？')) return;
      p.records = p.records.filter(function (r) { return r.when !== w; });
      save(); renderAll(false);
    } else if (b.hasAttribute('data-edit')) {
      var rec = findRec(b.getAttribute('data-edit'));
      if (!rec) return;
      $('e-year').value = rec.when.slice(0, 4);
      $('e-month').value = rec.when.length > 4 ? rec.when.slice(5, 7) : '';
      fillForm(rec); updateMode();
      $('opt-entry').open = true;
      $('opt-entry').scrollIntoView({ block: 'start' });
      $('e-year').focus({ preventScroll: true });
    }
  });

  // --- グラフ ---
  function chartData(p, it) {
    var pts = K.series(p, it.key);
    return { pts: pts, lines: K.linesFor(it, p, pts) };
  }
  function lineSwatch(kind) { return '<span class="sw sw-' + kind + '" aria-hidden="true"></span>'; }
  function caption(it, lines) {
    if (!lines.length) return 'この資料に判定値はありません';
    return lines.map(function (l) { return lineSwatch(l.kind) + esc(l.full); }).join('<br>');
  }
  function renderCharts() {
    var p = person(), years = K.yearRange(p);
    var html = '', empty = [];
    V.ITEMS.forEach(function (it) {
      var c = chartData(p, it);
      if (!c.pts.length) { empty.push(it.name); return; }
      var last = c.pts[c.pts.length - 1];
      html += '<figure class="kfig"><figcaption class="ktitle">' + esc(it.name) + ' <span class="unit">' + esc(it.unit) + '</span>' +
        '<span class="klast">' + esc(K.whenLabel(last.when)) + ' <b>' + K.fmt(it, last.y) + '</b></span></figcaption>' +
        K.chartSVG({ item: it, points: c.pts, lines: c.lines, years: years, w: 320, h: 150, font: 13, labels: 'last' }) +
        '<p class="kcap">' + caption(it, c.lines) + '</p></figure>';
    });
    $('charts').innerHTML = html;
    var n = p.records.length;
    $('result-sum').textContent = n ? personName(p, data.cur) + ': ' + n + ' 回分（' + years[0] + '〜' + years[1] + '年）' :
      'まだ記録がありません。「結果を入れる」を押して、結果票の数字を入れてください。';
    $('legend').innerHTML = n ? '線の見方: ' + lineSwatch('guide') + '保健指導判定値　' + lineSwatch('refer') + '受診勧奨判定値　' + lineSwatch('strat') + '内臓脂肪蓄積のリスク判定（資料の名前のまま）。白抜きの点は随時の採血。' : '';
    $('empty-items').textContent = n && empty.length ? '記録のない項目: ' + empty.join('・') : '';
    $('print').hidden = !n;
    $('open-entry').hidden = !!n;
    $('sample').hidden = data.people.some(function (q) { return q.records.length; });
    renderSheet();
  }

  // --- 印刷する紙（A4 縦 1 枚に 16 のグラフ。4 列 × 4 段） ---
  function renderSheet() {
    var p = person(), years = K.yearRange(p);
    $('print-host').hidden = !years;
    if (!years) { $('sheets').innerHTML = ''; return; }
    var S = V.SOURCES;
    var cells = V.ITEMS.map(function (it) {
      var c = chartData(p, it);
      return '<div class="pcell"><div class="ptitle">' + esc(it.name) + '<span>（' + esc(it.unit) + '）</span></div>' +
        K.chartSVG({ item: it, points: c.pts, lines: c.lines, years: c.pts.length ? years : null, w: 300, h: 250, font: 15, labels: 'all' }) +
        '<div class="pcap">' + caption(it, c.lines) + '</div></div>';
    }).join('');
    var sexTxt = p.sex ? '（' + V.SEX[p.sex] + '）' : '';
    var html = '<div class="sheet kenshin-sheet"><div class="pin">' +
      '<h2>' + esc(p.name ? p.name + ' さんの' : '') + '健診結果の推移' + esc(sexTxt) + '<small>' + years[0] + '〜' + years[1] + '年・' + p.records.length + ' 回</small></h2>' +
      '<p class="pnote">これは健診の結果を並べて見る道具で、医療の検査ではありません。気になるときは、健診を受けた所か、かかりつけの医師へ。</p>' +
      '<p class="plegend">' + lineSwatch('guide') + '保健指導判定値　' + lineSwatch('refer') + '受診勧奨判定値　' + lineSwatch('strat') + '内臓脂肪蓄積のリスク判定　○ 随時の採血</p>' +
      '<div class="pgrid">' + cells + '</div>' +
      '<p class="psrc">線の値: ' + esc(S.table.title) + '、' + esc(S.strat.title) + '。確認 ' + esc(V.CHECKED) + '。eGFR の値の＊は資料のまま。BMI は身長と体重から計算。</p>' +
      '</div>' + O.credit() + '</div>';
    $('sheets').innerHTML = html;
    O.fitPreview($('wrap'));
  }

  function renderAll(resetForm) {
    if (data.cur >= data.people.length) data.cur = 0;
    renderPeople();
    renderCharts();
    renderList();
    var p = person();
    window.YorozuScreen.detailsSummary({
      'opt-person': (p.name || '名前なし') + '・' + (p.sex ? V.SEX[p.sex] : '性別を選んでいない'),
      'opt-entry': p.records.length ? p.records.length + ' 回分あり' : 'まだなし',
      'opt-list': p.records.length + ' 回',
    });
    if (resetForm) { $('e-year').value = ''; $('e-month').value = ''; fillForm(null); updateMode(); $('e-msg').textContent = ''; }
  }

  // --- 例（架空の数字）を入れる ---
  $('sample').addEventListener('click', function () {
    var ex = { name: '例（架空の数字）', sex: 'f', records: [] };
    var rows = [
      ['2019-06', 154.2, 52.1, 78.0, 124, 76, 92, 5.5, 128, 66, 98, 21, 17, 24, 72.4, 4.6],
      ['2020-06', 154.0, 53.0, 79.5, 128, 78, 95, 5.6, 134, 64, 112, 22, 19, 26, 70.8, 4.8],
      ['2021-07', 153.8, 54.2, 81.0, 131, 80, 98, 5.7, 141, 61, 126, 24, 22, 29, 69.5, 5.0],
      ['2022-06', 153.7, 54.8, 82.5, 136, 83, 101, 5.8, 146, 60, 138, 25, 24, 31, 67.9, 5.1],
      ['2023-06', 153.5, 55.6, 83.0, 138, 84, 104, 5.9, 139, 62, 131, 23, 21, 30, 66.2, 5.2],
      ['2024-06', 153.4, 55.1, 82.0, 133, 82, 99, 5.8, 132, 63, 120, 22, 20, 28, 65.0, 5.0],
    ];
    rows.forEach(function (r, i) {
      var v = {};
      INPUT_ITEMS.forEach(function (it, j) { v[it.key] = r[j + 1]; });
      ex.records.push({ when: r[0], random: i === 2, v: v });
    });
    var only = data.people.length === 1 && !data.people[0].name && !data.people[0].records.length;
    if (only) data.people = [ex]; else data.people.push(ex);
    data = Calc.normKenshin({ people: data.people, cur: data.people.length - 1 });
    save(); renderAll(true);
  });

  $('open-entry').addEventListener('click', function () {
    $('opt-entry').open = true;
    $('opt-entry').scrollIntoView({ block: 'start' });
    $('e-year').focus({ preventScroll: true });
  });

  // --- 印刷 ---
  $('print').addEventListener('click', function () { window.print(); });

  // --- CSV ---
  $('csv-export').addEventListener('click', function () {
    var n = data.people.reduce(function (a, p) { return a + p.records.length; }, 0);
    if (!n) { $('csv-msg').textContent = 'まだ記録がありません。'; return; }
    var blob = new Blob([K.buildCSV(data)], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var d = new Date();
    a.download = 'otasuke-kenshin-' + d.getFullYear() + Calc.pad2(d.getMonth() + 1) + Calc.pad2(d.getDate()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    $('csv-msg').textContent = 'CSV に書き出しました（' + data.people.length + ' 人・' + n + ' 回分）。健診の結果が入っているので、しまう場所に気をつけてください。';
  });
  $('csv-import').addEventListener('click', function () { $('csv-file').click(); });
  $('csv-file').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { $('csv-msg').textContent = 'ファイルが大きすぎます。'; return; }
    file.arrayBuffer().then(function (buf) {
      // UTF-8 で読めなければ Shift_JIS（Excel で保存した CSV）
      var text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('shift_jis').decode(buf); }
      var r = K.parseCSV(text);
      if (!r.ok) { $('csv-msg').textContent = r.error; return; }
      if (!window.confirm(r.people.length + ' 人・' + r.count + ' 回分を読み込みます。同じ名前の人の同じ年月は置き換えます。よろしいですか？')) return;
      data = K.mergeImport(data, r.people);
      save(); renderAll(true);
      $('csv-msg').textContent = 'CSV から ' + r.count + ' 回分を読み込みました。' + (r.errors.length ? r.errors.slice(0, 5).join('。') + (r.errors.length > 5 ? '（ほか ' + (r.errors.length - 5) + ' 件）' : '') : '');
    }, function () { $('csv-msg').textContent = 'ファイルを読み取れませんでした。'; });
  });

  renderAll(true);
  O.watchPreview($('wrap'));
  O.backupSetup({
    key: KEY,
    afterImport: function () { data = Calc.normKenshin(O.store.get(KEY) || {}); renderAll(true); },
  });
  O.registerSW('../sw.js');
})();
