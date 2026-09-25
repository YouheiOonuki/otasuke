// ===========================
// 季語カレンダー — 今日の季語・季節の期間・印刷する紙（A4 縦）の HTML。DOM に触らない（tests/kigo.test.js）
// sekki.js のあとに読む。ブラウザでは window.KigoSheet、Node では module.exports
// ===========================
(function (root) {
  'use strict';
  var Sekki = (typeof module !== 'undefined' && module.exports) ? require('./sekki.js') : root.Sekki;

  var SEASONS = ['春', '夏', '秋', '冬', '新年'];
  var START = { 春: '立春', 夏: '立夏', 秋: '立秋', 冬: '立冬' };
  var NEXT = { 春: '立夏', 夏: '立秋', 秋: '立冬', 冬: '立春' };
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function md(iso) { return Number(iso.slice(5, 7)) + '月' + Number(iso.slice(8, 10)) + '日'; }
  function ymd(iso) { return Number(iso.slice(0, 4)) + '年' + md(iso); }
  function prevDay(iso) {
    var d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) - 1));
    return d.toISOString().slice(0, 10);
  }
  function termDate(year, name, known) {
    var t = Sekki.termsOfYear(year, known).filter(function (x) { return x.name === name; })[0];
    return t;
  }

  /**
   * 季節の期間。today（YYYY-MM-DD）を含む「立春からの 1 年」の中の、その季節の期間
   * 返り値: { season, from, to（前日）, fromName, toName, calc: 計算の値を使ったか }。新年は null
   */
  function period(season, today, known) {
    if (season === '新年') return null;
    var y = Number(today.slice(0, 4));
    var spring = termDate(y, '立春', known);
    if (today < spring.date) y -= 1;                   // 立春より前（1 月など）は、前の年の立春からの 1 年
    var a = termDate(y, START[season], known);
    var b = termDate(season === '冬' ? y + 1 : y, NEXT[season], known);
    return { season: season, from: a.date, to: prevDay(b.date), fromName: START[season], toName: NEXT[season], calc: a.from === 'calc' || b.from === 'calc' };
  }

  /** 今日の季節と、今日の季語（季節の一覧から日付で 1 つ選ぶ。1/1〜1/7 は新年の季語から） */
  function today(iso, data, known) {
    var s = Sekki.seasonOf(iso, known);
    var season = s.newYear ? '新年' : s.season;
    var list = data.filter(function (r) { return r[0] === season; });
    var day = Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);
    var i = ((day * 7) % list.length + list.length) % list.length;   // 7 とびで回す（隣り合う語が続かないように）
    var pick = [];
    for (var k = 0; k < 4; k++) pick.push(list[(i + k * 5) % list.length]);
    return { season: season, base: s.season, pick: pick, period: period(s.season, iso, known), next: s.next, nextName: s.nextName, nextSeason: s.nextSeason };
  }

  // 1 枚に入る数（形と大きさ）
  var PER = { table: { normal: 18, large: 12 }, words: { normal: 39, large: 24 } };
  var COLS = { normal: 3, large: 2 };

  /**
   * 印刷する紙。d = normKigo の形（season は 'now' を解決したもの）。
   * 返り値: { html, sheets }
   */
  function buildSheets(d, data, todayISO, known, credit) {
    var seasons = d.season === 'all' ? SEASONS : [d.season];
    var html = '', n = 0;
    seasons.forEach(function (season) {
      var list = data.filter(function (r) { return r[0] === season; });
      var per = PER[d.form][d.size];
      var pages = Math.ceil(list.length / per);
      per = Math.ceil(list.length / pages);   // 枚ごとの数をならす（最後の 1 枚だけ少なくならないように）
      var p = period(season, todayISO, known);
      var sub = p ? START[season] + '（' + ymd(p.from) + '）から、' + NEXT[season] + 'の前日（' + md(p.to) + '）まで' : '正月に使う季語';
      for (var pg = 0; pg < pages; pg++) {
        var part = list.slice(pg * per, (pg + 1) * per);
        var body = '';
        if (d.form === 'table') {
          body = '<table class="kg-table"><tbody>' + part.map(function (r) {
            return '<tr><th><span class="kg-w">' + esc(r[1]) + '</span>' + (d.yomi && r[2] ? '<span class="kg-y">' + esc(r[2]) + '</span>' : '') + '</th><td>' + esc(r[3]) + '</td></tr>';
          }).join('') + '</tbody></table>';
        } else {
          body = '<ul class="kg-grid cols' + COLS[d.size] + '">' + part.map(function (r) {
            return '<li><span class="kg-w">' + esc(r[1]) + '</span>' + (d.yomi && r[2] ? '<span class="kg-y">' + esc(r[2]) + '</span>' : '') + '</li>';
          }).join('') + '</ul>';
        }
        html += '<div class="sheet kg-sheet kg-' + d.size + (n > 0 ? ' kg-more' : '') + '"><div class="kg-in">' +
          '<div class="kg-head"><div class="kg-title">' + esc(season) + 'の季語' + (pages > 1 ? '（' + (pg + 1) + '/' + pages + '）' : '') + '</div>' +
          '<div class="kg-sub">' + esc(sub) + '</div></div>' + body +
          '<div class="kg-foot">季節の区切りは歳時記の一般的な分け方（立春・立夏・立秋・立冬）。季語の季節は国語辞典（デジタル大辞泉・精選版 日本国語大辞典）で確かめました。</div>' +
          '</div>' + (d.credit ? credit : '') + '</div>';
        n++;
      }
    });
    return { html: html, sheets: n };
  }

  /** 日付の見出し（2026年9月25日（金）） */
  function dateLabel(iso) {
    var w = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();
    return ymd(iso) + '（' + WEEK[w] + '）';
  }

  var API = { SEASONS: SEASONS, PER: PER, period: period, today: today, buildSheets: buildSheets, dateLabel: dateLabel, md: md, ymd: ymd, prevDay: prevDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.KigoSheet = API;
})(this);
