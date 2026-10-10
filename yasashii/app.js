// やさしい日本語に言い換え（yorozu-plans ROADMAP 7.33.1 K147、企画書 80）。言い換えは yorozu-ai（Workers AI）。
// 貼った文はこの画面に置くだけで、保存しない（localStorage を使わない）。送るのは「言い換える」を押したときの 1 回だけ。
(function () {
  'use strict';
  var API = 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/yasashii';
  var MAX = 2000;
  var SAMPLE = '令和8年度の国民年金保険料納付書をお送りします。お近くの金融機関・郵便局・コンビニエンスストアなどで納付してください。前納の納付書をご希望の際は、お近くの年金事務所にお問い合わせください。';
  var ERR = {
    busy: '今日は混んでいます。明日また使ってください。',
    tooLong: '2,000字までにしてください。',
    empty: '文を貼ってください。',
    timeout: '時間がかかりすぎました。文を短くして、もう一度押してください。',
    other: '言い換えができませんでした。少し待って、もう一度押してください。',
  };
  function $(id) { return document.getElementById(id); }
  var text = $('text');
  var last = null; // 直前の結果（ふりがなの切り替え・コピー用）

  function setStatus(msg, cls) {
    $('status').innerHTML = '<p class="' + (cls || 'small') + '"></p>';
    $('status').firstChild.textContent = msg;
  }
  function count() { $('count').textContent = String(Array.from(text.value).length); }

  function render() {
    if (!last) return;
    var ruby = $('ruby').checked;
    var marked = {};
    last.long.concat(last.added).forEach(function (s) { marked[s] = true; });
    $('src').innerHTML = '';
    last.source.split(/\n+/).forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      $('src').appendChild(p);
    });
    $('out').innerHTML = last.output.split('\n').filter(Boolean).map(function (line) {
      var mark = marked[line] ? '<span class="mark" title="短くできなかった文か、原文に無い数字がある文です">⚠</span>' : '';
      return '<p' + (marked[line] ? ' class="marked"' : '') + '>' + mark + window.Ruby.toHtml(line, ruby) + '</p>';
    }).join('');
    var w = [];
    if (last.missingNumbers.length) w.push('原文の数字 ' + last.missingNumbers.join('・') + ' が言い換えに出てきません。原文で確かめてください。');
    if (last.added.length) w.push('⚠ の文には、原文に無い数字があります。');
    $('warn').hidden = !w.length;
    $('warn').textContent = w.join(' ');
    $('pair').hidden = false;
  }

  function go() {
    var src = text.value.trim();
    if (!src) { setStatus(ERR.empty, 'error'); return; }
    if (Array.from(src).length > MAX) { setStatus(ERR.tooLong, 'error'); return; }
    $('go').disabled = true;
    setStatus('言い換えています…（20秒ほどかかることがあります）');
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: src }) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (x) {
        if (!x.j.ok) { setStatus(ERR[x.j.error] || ERR.other, 'error'); return; }
        last = { source: src, output: x.j.output, long: x.j.long || [], added: x.j.added || [], missingNumbers: x.j.missingNumbers || [] };
        $('status').innerHTML = '';
        render();
        $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () { setStatus(ERR.other, 'error'); })
      .then(function () { $('go').disabled = false; });
  }

  $('go').addEventListener('click', go);
  text.addEventListener('input', count);
  $('ruby').addEventListener('change', render);
  $('clear').addEventListener('click', function () { text.value = ''; count(); text.focus(); });
  $('sample').addEventListener('click', function () { text.value = SAMPLE; count(); });
  $('paste').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { text.focus(); return; }
    navigator.clipboard.readText().then(function (t) { text.value = t.slice(0, MAX); count(); }).catch(function () { text.focus(); });
  });
  $('copy').addEventListener('click', function () {
    if (!last || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.Ruby.plain(last.output)).then(function () { $('copy').textContent = 'コピーしました'; setTimeout(function () { $('copy').textContent = '言い換えをコピー'; }, 2000); });
  });
  count();
})();
