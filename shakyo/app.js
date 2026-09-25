// ===========================
// 写経用紙（般若心経）— 画面の制御。並びは calc.js の shakyoLayout、経文は constants.js の sutra
// ===========================
(function () {
  'use strict';
  var C = window.Constants, Calc = window.Calc, O = window.Otasuke, $ = O.$;
  var KEY = 'shakyo';
  var form = $('form');

  // 願文の候補（大雄寺「願文の例」）
  $('prayers').innerHTML = C.shakyoHowto.prayers.map(function (p) { return '<option value="' + O.esc(p) + '">'; }).join('');

  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }
  function setRadio(name, v) { var e = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (e) e.checked = true; }

  function current() {
    return Calc.normShakyo({
      kind: radio('kind'), size: radio('size'), spacing: radio('spacing'), shade: radio('shade'), title: radio('title'),
      prayer: $('prayer').value.trim(), name: $('name').value.trim(), today: $('today').checked, credit: $('credit').checked,
    });
  }
  function apply(d) {
    d = Calc.normShakyo(d);
    ['kind', 'size', 'spacing', 'shade', 'title'].forEach(function (k) { setRadio(k, d[k]); });
    $('prayer').value = d.prayer; $('name').value = d.name; $('today').checked = d.today; $('credit').checked = d.credit;
  }

  function render(d) {
    var L = Calc.shakyoLayout({
      size: d.size, spacing: d.spacing, title: d.title, prayer: d.prayer, name: d.name,
      date: d.today ? Calc.shakyoDate(new Date(), C.reiwa.start) : '',
    }, C.sutra);
    var cls = d.kind === 'model' ? 'model' : 'trace-' + d.shade;
    var html = '';
    L.pages.forEach(function (cols) {
      var inner = '';
      var top = L.margin, h = L.cellH * L.perCol;
      var right = L.pageW - L.margin;
      // 天地の線（全体）
      inner += '<div class="sk-frame" style="left:' + L.margin + 'mm;top:' + (top - 1) + 'mm;width:' + (L.pageW - L.margin * 2) + 'mm;height:' + (h + 2) + 'mm"></div>';
      for (var i = 0; i < L.colsPerPage; i++) {
        var x = right - (i + 1) * L.colW;
        inner += '<div class="sk-col' + (i === 0 ? ' first' : '') + '" style="left:' + x + 'mm;top:' + (top - 1) + 'mm;width:' + L.colW + 'mm;height:' + (h + 2) + 'mm">';
        var c = cols[i];
        if (c && d.kind !== 'blank') {
          c.cells.forEach(function (ch, j) {
            if (!ch) return;
            inner += '<span class="sk-ch" style="top:' + (1 + j * L.cellH) + 'mm;height:' + L.cellH + 'mm;line-height:' + L.cellH + 'mm;font-size:' + L.charMm + 'mm">' + O.esc(ch) + '</span>';
          });
        }
        inner += '</div>';
      }
      html += '<div class="sheet' + (L.orient === 'land' ? ' land' : '') + '"><div class="rot sk ' + cls + '">' + inner + '</div>' + (d.credit ? O.credit() : '') + '</div>';
    });
    $('sheets').innerHTML = html;
    $('pages-note').textContent = 'A4 ' + (L.orient === 'land' ? '横' : '縦') + ' ' + L.pages.length + ' 枚';
    O.fitPreview($('wrap'));
    window.YorozuScreen.detailsSummary({ 'opt-more': (d.kind === 'trace' ? { light: 'うすい', normal: 'ふつう', dark: 'こい' }[d.shade] + '・' : '') + (d.title === 'with' ? '仏説あり' : '仏説なし') + (d.prayer ? '・為' + d.prayer : '') + (d.name ? '・名前あり' : '') });
  }

  function update() {
    var d = current();
    render(d);
    if (!sharedView) O.store.set(KEY, d);
  }

  // 共有リンクで開いたときは、何か変えるまで端末の保存を上書きしない（名前・願文はリンクに入らない）
  var shared = O.readShare();
  var sharedView = !!(shared && shared.t === 'shakyo');
  apply(sharedView ? shared : (O.store.get(KEY) || {}));
  form.addEventListener('input', function () { sharedView = false; update(); });
  form.addEventListener('change', function () { sharedView = false; update(); });
  update();
  O.watchPreview($('wrap'));

  O.printSetup({ button: 'print' });
  O.shareSetup({ button: 'share', msg: 'share-msg', get: function () {
    var d = current();
    return { t: 'shakyo', kind: d.kind, size: d.size, spacing: d.spacing, shade: d.shade, title: d.title };
  } });
  O.backupSetup({ key: KEY, afterImport: function () { apply(O.store.get(KEY) || {}); update(); } });
  O.registerSW('../sw.js');
})();
