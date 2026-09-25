// ===========================
// 「このメール・SMS は本物？」— 画面の制御。読み解きは check.js、公式のドメインと出典は constants.js
// 貼った文はブラウザに保存しない・送信しない・リンクを開かない
// ===========================
(function () {
  'use strict';
  var C = window.Constants, H = window.Honmono;
  var psl = new H.Psl(window.PslData);
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // 例（架空。example は例示用に予約されたドメイン）
  var SAMPLE = '【ヤマト運輸】お荷物をお届けにあがりましたが不在のため持ち帰りました。下記よりご確認ください。\n' +
    'https://kuronekoyamato.co.jp.redelivery.example.com/check\n' +
    'お問い合わせ: https://xn--mazon-3ve.com/ または bit.ly/3xYz0';

  // ホスト名を「左の部分（薄く）＋持ち主の単位（太く）」で見せる
  function hostHtml(l) {
    if (!l.registrableShown) return '<span class="reg">' + esc(l.hostShown) + '</span>';
    return (l.subShown ? '<span class="sub">' + esc(l.subShown) + '.</span>' : '') + '<span class="reg">' + esc(l.registrableShown) + '</span>';
  }

  function itemHtml(l) {
    var h = '<li class="item' + (l.points.length ? ' has-points' : '') + '">';
    h += '<p class="host">' + hostHtml(l) + '</p>';
    if (l.registrableShown) h += '<p class="owner">持ち主の単位: <strong>' + esc(l.registrableShown) + '</strong>' + (l.registrableShown !== l.registrable ? '（' + esc(l.registrable) + '）' : '') + '</p>';
    if (l.points.length) h += '<ul class="points">' + l.points.map(function (p) { return '<li>' + esc(p.msg) + '</li>'; }).join('') + '</ul>';
    if (l.infos.length) h += '<ul class="infos">' + l.infos.map(function (p) { return '<li>' + esc(p.msg) + '</li>'; }).join('') + '</ul>';
    if (!l.points.length && !l.official) h += '<p class="small">この画面で見つけた確認すべき点はありません。持ち主の単位が、知っている会社のものか確かめてください。</p>';
    return h + '</li>';
  }

  function render() {
    var text = $('text').value;
    var out = $('out');
    if (!text.trim()) { out.innerHTML = '<p class="small">文を貼ると、ここに確認すべき点が出ます。この画面は「安全」とは判定しません。</p>'; return; }
    var r = H.analyze(text, C.honmono.brands, psl);
    var h = '';
    var n = r.links.length;
    if (!n && !r.emails.length) {
      h += '<p class="summary">リンクが見つかりませんでした。</p><p class="small">リンクは長押しして「リンクをコピー」で取ってから貼ってください（押して開かないで）。</p>';
    } else {
      h += '<p class="summary">' + (n ? 'リンク ' + n + ' 件' : '') + (r.emails.length ? (n ? '・' : '') + 'メールアドレス ' + r.emails.length + ' 件' : '') +
        '。確認すべき点 <strong>' + r.points + '</strong> つ' + (r.points ? '' : '（見つからなくても、本物とは決まりません）') + '</p>';
    }
    if (n) h += '<h2 class="rh">リンク</h2><ul class="items">' + r.links.map(itemHtml).join('') + '</ul>';
    if (r.emails.length) h += '<h2 class="rh">文の中のメールアドレス</h2><ul class="items">' + r.emails.map(itemHtml).join('') + '</ul>';
    if (r.phones.length) {
      h += '<h2 class="rh">文の中の電話番号</h2><p class="phones">' + r.phones.map(esc).join('、') + '</p>' +
        '<p class="small">この番号が本物かは、ここでは分かりません。かけるなら、カードの裏・公式アプリ・前から知っている番号に。</p>';
    }
    if (r.notes.length) {
      h += '<h2 class="rh">会社・機関が公式に案内していること</h2><ul class="notes">' + r.notes.map(function (b) {
        return '<li><strong>' + esc(b.name) + '</strong>: ' + esc(b.note) + '<br><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.src) + '</a></li>';
      }).join('') + '</ul>';
    }
    out.innerHTML = h;
  }

  var timer = 0;
  $('text').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 150); });
  $('clear').addEventListener('click', function () { $('text').value = ''; render(); $('text').focus(); });
  $('sample').addEventListener('click', function () { $('text').value = SAMPLE; render(); });
  var paste = $('paste');
  if (navigator.clipboard && navigator.clipboard.readText) {
    paste.addEventListener('click', function () {
      navigator.clipboard.readText().then(function (t) { $('text').value = t; render(); }, function () { $('text').focus(); });
    });
  } else paste.hidden = true;
  render();

  // オフラインでも開けるように（README 13）
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('../sw.js').catch(function () {}); });
  }
})();
