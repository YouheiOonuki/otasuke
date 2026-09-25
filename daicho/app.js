// ===========================
// 紙のアカウント台帳 — 画面の制御。パスワードの欄は作らない（控えの場所だけ）
// 手順と設定の名前は constants.js の digital（国民生活センター・Apple・Google）から
// ===========================
(function () {
  'use strict';
  var C = window.Constants, Calc = window.Calc, O = window.Otasuke, $ = O.$, esc = O.esc;
  var KEY = 'daicho';
  var form = $('form');
  var PER_PAGE = 12;   // A4 横 1 枚の行数
  var PRESET = ['スマホ本体', 'メール', 'Apple・Google', 'ネット銀行・証券', 'スマホ決済・ポイント', 'サブスク', 'SNS・LINE'];
  var FIELDS = [['service', 'サービス名', '例：〇〇銀行'], ['id', 'ID・登録メール', '例：hanako@…'], ['pay', '支払い（カード・月額）', '例：〇〇カード 月 990 円'],
    ['contact', '解約・問い合わせ先', '例：アプリの設定・電話番号'], ['where', 'パスワードの控えの場所', '例：青い手帳']];
  var data = Calc.normDaicho(O.store.get(KEY) || {});

  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }

  // --- 行の入力欄 ---
  function rowsEditor() {
    $('rows').innerHTML = data.rows.map(function (r, i) {
      return '<fieldset class="card" data-i="' + i + '"><legend class="small">' + (i + 1) + ' 行目</legend>' +
        '<div class="field"><label for="r' + i + '-kind">種類</label><select id="r' + i + '-kind" data-f="kind">' +
        Calc.DAICHO_KINDS.map(function (k) { return '<option' + (k === r.kind ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></div>' +
        FIELDS.map(function (f) {
          return '<div class="field"><label for="r' + i + '-' + f[0] + '">' + f[1] + '</label><input type="text" id="r' + i + '-' + f[0] + '" data-f="' + f[0] + '" value="' + esc(r[f[0]]) + '" placeholder="' + esc(f[2]) + '" maxlength="60"></div>';
        }).join('') +
        '<p class="warn" data-warn hidden>パスワードのように見えます。台帳には控えの場所だけを書いてください。</p>' +
        '<button type="button" class="btn btn-sub" data-del>この行を消す</button></fieldset>';
    }).join('');
    checkWarn();
  }
  function readRows() {
    Array.prototype.forEach.call($('rows').querySelectorAll('fieldset[data-i]'), function (fs) {
      var r = data.rows[Number(fs.getAttribute('data-i'))];
      Array.prototype.forEach.call(fs.querySelectorAll('[data-f]'), function (e) { r[e.getAttribute('data-f')] = e.value; });
    });
  }
  function checkWarn() {
    Array.prototype.forEach.call($('rows').querySelectorAll('fieldset[data-i]'), function (fs) {
      var bad = Array.prototype.some.call(fs.querySelectorAll('input[data-f]'), function (e) { return e.getAttribute('data-f') !== 'id' && Calc.looksLikePassword(e.value); });
      fs.querySelector('[data-warn]').hidden = !bad;
    });
  }

  // --- 用紙 ---
  function table(rows, blanks) {
    var html = '<table><colgroup><col style="width:37mm"><col style="width:42mm"><col style="width:48mm"><col style="width:42mm"><col style="width:52mm"><col></colgroup>' +
      '<thead><tr><th>種類</th><th>サービス名</th><th>ID・登録メール</th><th>支払い（カード・月額）</th><th>解約・問い合わせ先</th><th>パスワードの控えの場所</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + esc(r.kind) + '</td><td>' + esc(r.service) + '</td><td>' + esc(r.id) + '</td><td>' + esc(r.pay) + '</td><td>' + esc(r.contact) + '</td><td>' + esc(r.where) + '</td></tr>';
    });
    for (var i = 0; i < blanks; i++) html += '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    return html + '</tbody></table>';
  }
  function checklist() {
    var D = C.digital;
    return '<div class="chk">' +
      '<p>□ スマホ・パソコンのロック解除の番号を名刺大の紙に書き、修正テープを 2〜3 回重ねて隠した（しまった場所：＿＿＿＿＿＿＿＿）</p>' +
      '<p>□ iPhone：Apple の「故人アカウント管理連絡先」を設定した（連絡先：＿＿＿＿＿＿）</p>' +
      '<p>□ Android・Gmail：Google の「アカウント無効化管理ツール」を設定した（連絡先：＿＿＿＿＿＿）</p>' +
      '<p>ID やパスワードが分からなくても、契約先が分かれば、家族からの連絡で解約などに応じてもらえることが多い（国民生活センター）。</p>' +
      '<p class="src">出典：' + esc(D.source) + '、' + esc(D.apple) + '、' + esc(D.google) + '（確認 ' + esc(D.checked) + '）</p></div>';
  }
  function render() {
    var owner = data.owner ? esc(data.owner) + ' さんの' : '＿＿＿＿＿＿さんの';
    var rows = data.rows.filter(function (r) { return r.service || r.id || r.pay || r.contact || r.where || r.kind !== 'その他'; });
    var total = rows.length + data.blankRows;
    // 最後の紙は確かめる項目の分だけ行を減らす
    var pages = [];
    var list = rows.slice();
    var blanks = data.blankRows;
    do {
      var cap = PER_PAGE;
      var take = list.splice(0, cap);
      var b = Math.min(blanks, cap - take.length);
      blanks -= b;
      pages.push({ rows: take, blanks: b });
    } while (list.length || blanks > 0);
    var last = pages[pages.length - 1];
    if (last.rows.length + last.blanks > PER_PAGE - 4) pages.push({ rows: [], blanks: 0 });
    var html = pages.map(function (p, i) {
      var inner = '<div class="dz"><h2>' + owner + 'アカウント台帳' + (pages.length > 1 ? '（' + (i + 1) + '/' + pages.length + '）' : '') + '</h2>' +
        (i === 0 ? '<p class="lead">パスワードは書かない。書くのは「控えの場所」だけ。この紙は大切な書類と同じ場所にしまう。</p>' : '') +
        (p.rows.length + p.blanks ? table(p.rows, p.blanks) : '') + (i === pages.length - 1 ? checklist() : '') + '</div>';
      return '<div class="sheet land"><div class="rot">' + inner + '</div>' + (data.credit ? O.credit() : '') + '</div>';
    }).join('');
    if (data.card) {
      var cards = '';
      for (var i = 0; i < 8; i++) {
        cards += '<div class="bcard">スマホ・パソコン（　　　　　　　）<br>のロック解除の番号' +
          '<div class="box"><span>書いたら、上から修正テープを 2〜3 回重ねて貼る</span></div></div>';
      }
      html += '<div class="sheet"><div class="cards"><h2>ロック解除の番号を隠すカード</h2>' +
        '<p class="lead">切り取って使う。削ったあとに気づいたら、すぐ番号を変える（国民生活センターの方法）。</p><div class="cardgrid">' + cards + '</div></div>' +
        (data.credit ? O.credit() : '') + '</div>';
    }
    $('sheets').innerHTML = html;
    $('pages-note').textContent = 'A4 ' + $('sheets').children.length + ' 枚（' + total + ' 行）';
    O.fitPreview($('wrap'));
    window.YorozuScreen.detailsSummary({
      'opt-rows': rows.length ? rows.length + ' 行に入力' : 'まだ入力なし（手書きでも使えます）',
      'opt-print': (data.card ? 'カードあり' : 'カードなし') + '・' + (data.credit ? '作成元を入れる' : '作成元なし'),
    });
  }

  function save() { O.store.set(KEY, data); }
  function fromForm() {
    readRows();
    data.owner = $('owner').value.trim();
    data.blankRows = Number(radio('blankRows'));
    data.card = $('card').checked;
    data.credit = $('credit').checked;
    data = Calc.normDaicho(data);
  }
  function toForm() {
    $('owner').value = data.owner;
    var r = form.querySelector('input[name="blankRows"][value="' + data.blankRows + '"]');
    if (r) r.checked = true;
    $('card').checked = data.card; $('credit').checked = data.credit;
    rowsEditor();
  }

  form.addEventListener('input', function () { fromForm(); checkWarn(); render(); save(); });
  form.addEventListener('change', function () { fromForm(); render(); save(); });
  $('rows').addEventListener('click', function (e) {
    if (!e.target.hasAttribute('data-del')) return;
    fromForm();
    data.rows.splice(Number(e.target.closest('fieldset').getAttribute('data-i')), 1);
    rowsEditor(); render(); save();
  });
  $('add').addEventListener('click', function () {
    fromForm();
    data.rows.push({ kind: 'その他', service: '', id: '', pay: '', contact: '', where: '' });
    rowsEditor(); render(); save();
    $('opt-rows').open = true;
    var last = $('rows').lastElementChild; if (last) last.querySelector('select').focus();
  });
  $('preset').addEventListener('click', function () {
    fromForm();
    var have = data.rows.map(function (r) { return r.kind; });
    PRESET.forEach(function (k) { if (have.indexOf(k) < 0) data.rows.push({ kind: k, service: '', id: '', pay: '', contact: '', where: '' }); });
    rowsEditor(); render(); save();
    $('opt-rows').open = true;
  });

  toForm();
  render();
  O.watchPreview($('wrap'));
  O.printSetup({ button: 'print' });
  O.backupSetup({
    key: KEY,
    afterImport: function () { data = Calc.normDaicho(O.store.get(KEY) || {}); toForm(); render(); },
  });
  O.registerSW('../sw.js');
})();
