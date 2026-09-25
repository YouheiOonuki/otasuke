// ===========================
// 冷蔵庫に貼る紙 3 枚（救急情報シート・服薬カレンダー・血圧記録表）— 画面の制御
// 救急情報シートの欄は自治体の記入用紙（constants.js の kyukyu）から。医療の助言は書かない
// ===========================
(function () {
  'use strict';
  var C = window.Constants, Calc = window.Calc, O = window.Otasuke, $ = O.$, esc = O.esc;
  var KEY = 'reizoko';
  var form = $('form');
  var TIME_LABEL = { wake: '起きたとき', morning: '朝', noon: '昼', evening: '夕', bed: '寝る前' };
  var saved = Calc.normReizoko(O.store.get(KEY) || {});

  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }
  function setRadio(name, v) { var e = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (e) e.checked = true; }

  function current() {
    var kind = radio('kind');
    var k = {};
    Array.prototype.forEach.call(form.querySelectorAll('[data-k]'), function (e) { k[e.getAttribute('data-k')] = e.value; });
    var times = Array.prototype.map.call(form.querySelectorAll('input[name="times"]:checked'), function (e) { return e.value; });
    var d = {
      kind: kind, name: $('name').value.trim(), kyukyu: k, signCard: $('signCard').checked, credit: $('credit').checked,
      fukuyaku: saved.fukuyaku, ketsuatsu: saved.ketsuatsu,
    };
    // 開始日・日数は種類ごとに持つ（服薬は 1 週間、血圧は 2 週間から）
    if (kind === 'fukuyaku') d.fukuyaku = { start: $('start').value, days: Number(radio('days')), times: times, memo: $('f-memo').value };
    else d.fukuyaku = Object.assign({}, saved.fukuyaku, { times: times, memo: $('f-memo').value });
    if (kind === 'ketsuatsu') d.ketsuatsu = { start: $('start').value, days: Number(radio('days')), twice: $('twice').checked };
    else d.ketsuatsu = Object.assign({}, saved.ketsuatsu, { twice: $('twice').checked });
    return Calc.normReizoko(d);
  }

  function showKind(kind) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-for]'), function (e) {
      e.hidden = e.getAttribute('data-for').split(' ').indexOf(kind) < 0;
    });
  }
  function apply(d) {
    d = Calc.normReizoko(d);
    saved = d;
    setRadio('kind', d.kind);
    $('name').value = d.name;
    Array.prototype.forEach.call(form.querySelectorAll('[data-k]'), function (e) { e.value = d.kyukyu[e.getAttribute('data-k')] || ''; });
    $('signCard').checked = d.signCard; $('credit').checked = d.credit;
    Array.prototype.forEach.call(form.querySelectorAll('input[name="times"]'), function (e) { e.checked = d.fukuyaku.times.indexOf(e.value) >= 0; });
    $('f-memo').value = d.fukuyaku.memo; $('twice').checked = d.ketsuatsu.twice;
    applyKindFields(d);
  }
  function applyKindFields(d) {
    showKind(d.kind);
    var p = d.kind === 'fukuyaku' ? d.fukuyaku : d.ketsuatsu;
    $('start').value = p.start;
    var days = d.kind === 'ketsuatsu' && p.days === 7 ? 14 : p.days;
    setRadio('days', String(days));
  }

  // --- 用紙 ---
  function line(v) { return v ? esc(v) : ''; }
  function kyukyuSheet(d) {
    var k = d.kyukyu;
    function row(label, v, cls) { return '<tr><th>' + label + '</th><td' + (cls ? ' class="' + cls + '"' : '') + '>' + line(v) + '</td></tr>'; }
    function sec(t) { return '<tr class="sec"><th colspan="2">' + t + '</th></tr>'; }
    var html = '<div class="pz"><h2>救急情報シート</h2>' +
      '<div class="kq-dates"><span>作成　　　年　　月　　日</span><span>書き直し　　　年　　月　　日</span></div>' +
      '<table class="kq"><colgroup><col style="width:46mm"><col></colgroup><tbody>' +
      sec('本人') + row('ふりがな', k.kana) + row('名前', d.name) + row('生年月日', k.birth) +
      '<tr><th>性別・血液型</th><td>' + line([k.sex, k.blood].filter(Boolean).join('　')) + '</td></tr>' +
      row('住所', k.address) + row('電話', k.tel) +
      sec('家族など（緊急連絡先）') +
      row('① 名前・続柄', [k.c1name, k.c1rel].filter(Boolean).join('（') + (k.c1name && k.c1rel ? '）' : '')) + row('① 電話', k.c1tel) +
      row('② 名前・続柄', [k.c2name, k.c2rel].filter(Boolean).join('（') + (k.c2name && k.c2rel ? '）' : '')) + row('② 電話', k.c2tel) +
      sec('かかりつけの病院・医院') +
      row('① 名前・科', [k.h1name, k.h1dept].filter(Boolean).join('　')) + row('① 電話', k.h1tel) +
      row('② 名前・科', [k.h2name, k.h2dept].filter(Boolean).join('　')) + row('② 電話', k.h2tel) +
      sec('からだのこと') +
      row('持病・これまでの病気', k.illness, 'tall') + row('アレルギー', k.allergy) + row('飲んでいる薬', k.medicine, 'tall') +
      row('透析・ペースメーカー・酸素・インスリンなど<span class="sub"></span>', k.special) + row('救急隊に伝えたいこと', k.message, 'tall') +
      '</tbody></table>' +
      '<p class="kq-agree">救急隊と運ばれた先の医療機関が、この紙の情報を救急のときに使うことに同意します。　本人の署名（代筆可）＿＿＿＿＿＿＿＿</p>' +
      '<p class="foot">保険証・診察券・お薬手帳のコピーも一緒に。中身が見えないよう二つ折りにして冷蔵庫へ。変わったら書き直し、年に 1 度は見直す。</p>' +
      '</div>';
    var out = sheet(html, d);
    if (d.signCard) {
      out += sheet('<div class="pz"><div class="sign">' +
        '<div><strong>救急情報は<br>冷蔵庫に<br>あります</strong><span>（玄関ドアの内側に貼る）</span></div>' +
        '<div><strong>救急情報は<br>この中に<br>あります</strong><span>（冷蔵庫の扉に貼る）</span></div>' +
        '</div></div>', d);
    }
    return out;
  }

  function who(d, suffix) {
    return '<p class="who">' + (d.name ? esc(d.name) + ' さん' : '名前 <span class="blank"></span>') + (suffix || '') + '</p>';
  }
  function dateCell(r, fs) {
    if (!r.iso) return '<td class="dt" style="font-size:' + fs + 'pt">　／　</td><td style="font-size:' + fs + 'pt"></td>';
    return '<td class="dt" style="font-size:' + fs + 'pt">' + r.m + '/' + r.d + '</td><td class="wk-' + r.wi + '" style="font-size:' + fs + 'pt">' + r.w + '</td>';
  }
  function fukuyakuSheet(d) {
    var f = d.fukuyaku;
    var rows = Calc.dayRows(f.start, f.days);
    var tableH = 297 - 24 - 38;                 // 見出し・名前・メモの分を引いた高さ（mm）
    var rh = tableH / (rows.length + 1);
    var fs = Math.max(11, Math.min(24, rh * 0.95));
    var times = Calc.TIMINGS.filter(function (t) { return f.times.indexOf(t) >= 0; });
    var html = '<div class="pz"><h2>おくすりカレンダー</h2>' + who(d) +
      '<p class="note">' + (f.memo ? esc(f.memo) : 'くすり・メモ：') + '</p>' +
      '<table class="cal"><colgroup><col style="width:24mm"><col style="width:16mm">' + times.map(function () { return '<col>'; }).join('') + '</colgroup>' +
      '<thead><tr style="height:' + rh + 'mm"><th>日</th><th>曜</th>' + times.map(function (t) { return '<th style="font-size:' + Math.min(16, fs) + 'pt">' + TIME_LABEL[t] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr style="height:' + rh + 'mm">' + dateCell(r, fs) + times.map(function () { return '<td></td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table><p class="foot">飲んだら ○ をつける。</p></div>';
    return sheet(html, d);
  }
  function ketsuatsuSheet(d) {
    var b = d.ketsuatsu;
    var rows = Calc.dayRows(b.start, b.days);
    var n = b.twice ? 2 : 1;
    var tableH = 297 - 24 - 44;
    var rh = tableH / (rows.length + 2);
    var fs = Math.max(11, Math.min(18, rh * 0.85));
    var head2 = '';
    var cols = '<col style="width:18mm"><col style="width:11mm">';
    ['朝', '晩'].forEach(function () {
      for (var i = 0; i < n; i++) { head2 += '<th>上</th><th>下</th><th>脈</th>'; cols += '<col><col><col>'; }
    });
    cols += '<col style="width:' + (b.twice ? 18 : 30) + 'mm">';
    var head1 = '<th rowspan="2">日</th><th rowspan="2">曜</th>' +
      '<th colspan="' + 3 * n + '">朝' + (n === 2 ? '（1 回目・2 回目）' : '') + '</th><th colspan="' + 3 * n + '">晩' + (n === 2 ? '（1 回目・2 回目）' : '') + '</th><th rowspan="2">メモ</th>';
    var html = '<div class="pz"><h2>血圧の記録</h2>' + who(d) +
      '<p class="note">' + esc(C.ketsuatsu.howto) + '（日本高血圧学会）</p>' +
      '<table class="cal"><colgroup>' + cols + '</colgroup><thead><tr style="height:' + rh + 'mm">' + head1 + '</tr><tr style="height:' + rh + 'mm">' + head2 + '</tr></thead><tbody>' +
      rows.map(function (r) {
        var cells = '';
        for (var i = 0; i < 6 * n; i++) cells += '<td></td>';
        return '<tr style="height:' + rh + 'mm">' + dateCell(r, fs) + cells + '<td></td></tr>';
      }).join('') +
      '</tbody></table><p class="foot">上＝上の血圧、下＝下の血圧、脈＝脈拍。受診のときに持っていく。</p></div>';
    return sheet(html, d);
  }
  function sheet(inner, d) { return '<div class="sheet">' + inner + (d.credit ? O.credit() : '') + '</div>'; }

  function render(d) {
    var html = d.kind === 'kyukyu' ? kyukyuSheet(d) : d.kind === 'fukuyaku' ? fukuyakuSheet(d) : ketsuatsuSheet(d);
    $('sheets').innerHTML = html;
    var n = $('sheets').children.length;
    $('pages-note').textContent = 'A4 縦 ' + n + ' 枚';
    O.fitPreview($('wrap'));
    var filled = C && d.kyukyu ? Calc.KYUKYU_FIELDS.filter(function (f) { return d.kyukyu[f]; }).length : 0;
    window.YorozuScreen.detailsSummary({
      'opt-kyukyu': filled ? filled + ' か所に入力' : 'すべて手書き',
      'opt-fukuyaku': d.fukuyaku.times.map(function (t) { return TIME_LABEL[t]; }).join('・'),
      'opt-ketsuatsu': d.ketsuatsu.twice ? '朝・晩 2 回ずつ' : '朝・晩 1 回ずつ',
      'opt-print': d.credit ? '作成元を入れる' : '作成元なし',
    });
  }

  var sharedView = false;
  function update(e) {
    if (e && e.target && e.target.name === 'kind') {   // 種類を変えたら、前の種類の開始日・日数を残して、新しい種類のものを出す
      var next = radio('kind');
      setRadio('kind', saved.kind);
      var prev = current();
      setRadio('kind', next);
      prev.kind = next;
      saved = prev;
      applyKindFields(saved);
    }
    var d = current();
    saved = d;
    render(d);
    if (!sharedView) O.store.set(KEY, d);
  }

  // 共有リンク: 紙の種類と形だけ（名前・病気・薬・電話は入れない）。開いた人の保存は、何か変えるまで上書きしない
  var shared = O.readShare();
  if (shared && shared.t === 'reizoko') {
    sharedView = true;
    apply({ kind: shared.kind, fukuyaku: { days: shared.days, times: shared.times }, ketsuatsu: { days: shared.days, twice: shared.twice }, signCard: shared.signCard });
  } else {
    apply(saved);
  }
  form.addEventListener('input', function (e) { sharedView = false; update(e); });
  form.addEventListener('change', function (e) { sharedView = false; if (e.target.name !== 'kind' || radio('kind') !== saved.kind) update(e); });
  update();
  O.watchPreview($('wrap'));

  O.printSetup({ button: 'print' });
  O.shareSetup({ button: 'share', msg: 'share-msg', note: '名前・病気・薬・電話はリンクに入っていません。', get: function () {
    var d = current();
    var p = d.kind === 'fukuyaku' ? d.fukuyaku : d.ketsuatsu;
    return { t: 'reizoko', kind: d.kind, days: p.days, times: d.fukuyaku.times, twice: d.ketsuatsu.twice, signCard: d.signCard };
  } });
  O.backupSetup({
    key: KEY,
    afterImport: function () { apply(O.store.get(KEY) || {}); update(); },
    afterClear: function () { apply({}); render(current()); },
  });
  O.registerSW('../sw.js');
})();
