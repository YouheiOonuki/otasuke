// ===========================
// 親のスマホ手順カード — 画面の制御。ひな形は constants.js の steps（LINE・Apple の公式の手順から）
// 写真は端末の中で小さくして保存する（どこにも送らない）
// ===========================
(function () {
  'use strict';
  var C = window.Constants, Calc = window.Calc, O = window.Otasuke, $ = O.$, esc = O.esc;
  var KEY = 'tejun';
  var form = $('form');
  var MAX = 6, BLANK_LINES = 5, PHOTO_PX = 640;
  var data = Calc.normTejun(O.store.get(KEY) || {});
  var sharedView = false;

  function radio(name) { var e = form.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ''; }

  function toForm() {
    $('title').value = data.title;
    $('steps').value = data.steps.map(function (s) { return s.text; }).join('\n');
    $('helpName').value = data.helpName; $('helpTel').value = data.helpTel;
    var r = form.querySelector('input[name="layout"][value="' + data.layout + '"]'); if (r) r.checked = true;
    $('credit').checked = data.credit;
    photosEditor();
  }
  function fromForm() {
    var lines = $('steps').value.split(/\r?\n/).map(function (s) { return s.trim(); });
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    var over = lines.length > MAX;
    $('steps-note').textContent = over ? '7 行目から先はカードに入りません（6 行まで）。' : '';
    lines = lines.slice(0, MAX);
    var old = data.steps;
    data = Calc.normTejun({
      title: $('title').value.trim(),
      steps: lines.map(function (t, i) { return { text: t, photo: old[i] ? old[i].photo : '' }; }),
      helpName: $('helpName').value.trim(), helpTel: $('helpTel').value.trim(), layout: radio('layout'), credit: $('credit').checked,
    });
  }

  // --- 写真: 手順ごとに 1 枚。長い辺 640px の JPEG にしてから保存 ---
  function photosEditor() {
    if (!data.steps.length) { $('photos').innerHTML = '<p class="small">先に手順を書くと、手順ごとに写真を入れられます。</p>'; return; }
    $('photos').innerHTML = data.steps.map(function (s, i) {
      return '<div class="photo-row"><span class="ttl">' + (i + 1) + '. ' + esc(s.text || '（手順なし）') + '</span>' +
        (s.photo ? '<img src="' + s.photo + '" alt="' + (i + 1) + ' の写真">' : '') +
        '<label class="btn btn-sub">写真を選ぶ<input type="file" accept="image/*" data-i="' + i + '" hidden></label>' +
        (s.photo ? '<button type="button" class="btn btn-sub" data-del="' + i + '">外す</button>' : '') + '</div>';
    }).join('') + '<p id="photo-msg" class="small" aria-live="polite"></p>';
  }
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, PHOTO_PX / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }
  $('photos').addEventListener('change', function (e) {
    var inp = e.target; if (!inp.files || !inp.files[0]) return;
    e.stopPropagation();
    var i = Number(inp.getAttribute('data-i'));
    shrink(inp.files[0]).then(function (d) {
      data.steps[i].photo = d;
      var ok = save();
      photosEditor(); render();
      if (!ok) $('photo-msg').textContent = '写真はこの端末に保存できませんでした（容量）。印刷はこのままできます。';
    }, function () { $('photo-msg').textContent = 'この写真は読み込めませんでした。'; });
  });
  $('photos').addEventListener('click', function (e) {
    var d = e.target.getAttribute && e.target.getAttribute('data-del');
    if (d == null) return;
    data.steps[Number(d)].photo = '';
    save(); photosEditor(); render();
  });

  // --- 用紙 ---
  function card(scale) {
    var steps = data.steps.length ? data.steps : [];
    var rows = steps.length ? steps : new Array(BLANK_LINES).fill(0).map(function () { return { text: '', photo: '' }; });
    var anyPhoto = rows.some(function (s) { return s.photo; });
    var t = (rows.length <= 4 ? 28 : 23) * scale;
    var style = '--h:' + (32 * scale) + 'pt;--t:' + t + 'pt;--n:' + (15 * scale) + 'mm;--p:' + ((anyPhoto ? 52 : 0) * scale) + 'mm';
    var help = '<div class="help"><small>こまったら、電話する</small>' +
      (data.helpName ? esc(data.helpName) : '<span class="line"></span>') + '　' + (data.helpTel ? esc(data.helpTel) : '<span class="line"></span>') + '</div>';
    return '<div class="tz" style="' + style + '"><h2>' + (data.title ? esc(data.title) : '<span style="display:inline-block;min-width:120mm">&nbsp;</span>') + '</h2><ol>' +
      rows.map(function (s, i) {
        return '<li><span class="no">' + (i + 1) + '</span><span class="tx' + (s.text ? '' : ' empty') + '">' + esc(s.text) + '</span>' +
          (anyPhoto ? '<span class="ph">' + (s.photo ? '<img src="' + s.photo + '" alt="">' : '') + '</span>' : '') + '</li>';
      }).join('') + '</ol>' + help + '</div>';
  }
  function render() {
    var inner = data.layout === 'a5' ? '<div class="half">' + card(0.7) + '</div><div class="half">' + card(0.7) + '</div>' : card(1);
    $('sheets').innerHTML = '<div class="sheet">' + inner + (data.credit ? O.credit() : '') + '</div>';
    $('pages-note').textContent = 'A4 縦 1 枚';
    O.fitPreview($('wrap'));
    var nPhoto = data.steps.filter(function (s) { return s.photo; }).length;
    window.YorozuScreen.detailsSummary({
      'opt-photo': nPhoto ? nPhoto + ' 枚' : 'なし',
      'opt-print': (data.layout === 'a5' ? '2 枚どり' : 'A4 に 1 枚') + '・' + (data.credit ? '作成元を入れる' : '作成元なし'),
    });
  }
  function save() { return sharedView ? true : O.store.set(KEY, data); }

  $('tpl').addEventListener('change', function () {
    var t = C.steps.templates[this.value];
    this.value = '';
    if (!t) return;
    if ((data.title || data.steps.length) && !window.confirm('題と手順を、ひな形で置き換えます。よろしいですか？')) return;
    data.title = t.title;
    data.steps = t.steps.map(function (s) { return { text: s, photo: '' }; });
    sharedView = false;
    toForm(); render(); save();
  });
  form.addEventListener('input', function (e) {
    if (e.target.id === 'tpl' || (e.target.type === 'file')) return;
    sharedView = false; fromForm(); if (e.target.id === 'steps') photosEditor(); render(); save();
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'layout' || e.target.id === 'credit') { sharedView = false; fromForm(); render(); save(); }
  });

  // 共有リンク: 題と手順の文だけ。開いた人の保存は、何か変えるまで上書きしない
  var shared = O.readShare();
  if (shared && shared.t === 'tejun') {
    sharedView = true;
    data = Calc.normTejun({ title: shared.title, steps: (shared.steps || []).map(function (s) { return { text: s }; }), layout: shared.layout });
  }
  toForm();
  render();
  O.watchPreview($('wrap'));
  O.printSetup({ button: 'print' });
  O.shareSetup({ button: 'share', msg: 'share-msg', note: '電話番号と写真は入っていません。', get: function () {
    return { t: 'tejun', title: data.title, steps: data.steps.map(function (s) { return s.text; }), layout: data.layout };
  } });
  O.backupSetup({
    key: KEY,
    beforeExport: function () { save(); },
    afterImport: function () { data = Calc.normTejun(O.store.get(KEY) || {}); toForm(); render(); },
    afterClear: function () { data = Calc.normTejun({}); toForm(); render(); },
  });
  O.registerSW('../sw.js');
})();
