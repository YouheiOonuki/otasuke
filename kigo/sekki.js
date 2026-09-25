// ===========================
// 季語カレンダー — 二十四節気の日付（太陽の黄経から計算）と、俳句の季節の区切り
// 立春（黄経 315 度）・立夏（45 度）・立秋（135 度）・立冬（225 度）の日から次の区切りの前日までを春・夏・秋・冬とする（歳時記の一般的な区切り）
// 計算は太陽の視黄経の三角級数（周期項 19 の近似式。章動・光行差を含む形）。
// 国立天文台 暦要項の 2026・2027 年の値と照らして tests/kigo.test.js で誤差を確かめている
// ブラウザでは window.Sekki、Node では module.exports
// ===========================
(function (root) {
  'use strict';

  var NAMES = ['春分', '清明', '穀雨', '立夏', '小満', '芒種', '夏至', '小暑', '大暑', '立秋', '処暑', '白露',
    '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '啓蟄'];   // 黄経 0 度から 15 度ごと
  var RAD = Math.PI / 180;

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  // ユリウス日（地球時 TT）→ 太陽の視黄経（度）。J2000.0 からのユリウス年 t の三角級数（主な周期項 18 と中心差）
  var TERMS = [
    [1.9146, 357.538, 359.991], [0.0200, 355.05, 719.981], [0.0048, 234.95, 19.341], [0.0020, 247.1, 329.64],
    [0.0018, 297.8, 4452.67], [0.0018, 251.3, 0.20], [0.0015, 343.2, 450.37], [0.0013, 81.4, 225.18],
    [0.0008, 132.5, 659.29], [0.0007, 153.3, 90.38], [0.0007, 206.8, 30.35], [0.0006, 29.8, 337.18],
    [0.0005, 207.4, 1.50], [0.0005, 291.2, 22.81], [0.0004, 234.9, 315.56], [0.0004, 157.3, 299.30],
    [0.0004, 21.1, 720.02], [0.0003, 352.5, 1079.97], [0.0003, 329.7, 44.43],
  ];
  function solarLongitude(jde) {
    var t = (jde - 2451545.0) / 365.25;
    var l = 280.4603 + 360.00769 * t;
    for (var i = 0; i < TERMS.length; i++) {
      var a = TERMS[i][0];
      if (i === 0) a -= 0.00005 * t;
      l += a * Math.sin(norm360(TERMS[i][1] + TERMS[i][2] * t) * RAD);
    }
    return norm360(l);
  }

  // 地球時と世界時の差（秒）。2005〜2050 年の近似式（Espenak・Meeus, NASA）。範囲外もこの式で近似する
  function deltaT(year) {
    var t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }

  // Date（UTC のミリ秒）⇔ ユリウス日
  function msToJD(ms) { return ms / 86400000 + 2440587.5; }
  function jdToMs(jd) { return (jd - 2440587.5) * 86400000; }

  /** year 年に太陽の黄経が deg 度になる時刻（UTC のミリ秒）。近い日から二分法で求める */
  function solarTermTime(year, deg) {
    // 春分（3/20 ごろ）から 1 日約 0.9856 度進む。黄経 deg の目安の日
    var approx = Date.UTC(year, 2, 20) + ((norm360(deg) / 0.98565) * 86400000);
    if (deg >= 285) approx -= 365.2422 * 86400000;   // 小寒〜啓蟄（285〜345 度）は同じ年の 1〜3 月
    var dt = deltaT(year) / 86400;
    function diff(ms) { var d = solarLongitude(msToJD(ms) + dt) - deg; d = ((d + 540) % 360) - 180; return d; }
    var lo = approx - 5 * 86400000, hi = approx + 5 * 86400000;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (diff(mid) < 0) lo = mid; else hi = mid;
    }
    return Math.round((lo + hi) / 2);
  }

  // 日本時間（UTC+9）の年月日
  function jstParts(ms) {
    var d = new Date(ms + 9 * 3600000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(p) { return p.y + '-' + pad2(p.m) + '-' + pad2(p.d); }

  /** year 年の二十四節気（1 月の小寒から 12 月の冬至まで 24 個）。known に暦要項の表があればそれを使う */
  function termsOfYear(year, known) {
    var out = [];
    var order = [285, 300, 315, 330, 345, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270];
    for (var i = 0; i < order.length; i++) {
      var deg = order[i], name = NAMES[deg / 15];
      var k = known && known[year] && known[year][name];
      if (k) { out.push({ name: name, deg: deg, date: k.slice(0, 10), time: k.slice(11, 16), from: 'table' }); continue; }
      var p = jstParts(solarTermTime(year, deg));
      out.push({ name: name, deg: deg, date: isoOf(p), time: pad2(p.h) + ':' + pad2(p.mi), from: 'calc' });
    }
    return out;
  }

  var SEASON_START = [['春', '立春'], ['夏', '立夏'], ['秋', '立秋'], ['冬', '立冬']];

  /**
   * iso（YYYY-MM-DD、日本の日付）の俳句の季節。
   * 返り値: { season: '春'|'夏'|'秋'|'冬', start: 区切りの日, next: 次の区切りの日, nextName, newYear: 1/1〜1/7 か }
   */
  function seasonOf(iso, known) {
    var y = Number(iso.slice(0, 4));
    var pts = [];
    [y - 1, y, y + 1].forEach(function (yy) {
      var t = termsOfYear(yy, known);
      t.forEach(function (x) {
        SEASON_START.forEach(function (s) { if (x.name === s[1]) pts.push({ season: s[0], name: s[1], date: x.date, from: x.from }); });
      });
    });
    pts.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var cur = null, next = null;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].date <= iso) cur = pts[i]; else { next = pts[i]; break; }
    }
    var md = iso.slice(5);
    return { season: cur.season, start: cur.date, startName: cur.name, next: next.date, nextName: next.name, nextSeason: next.season,
      from: cur.from, newYear: md >= '01-01' && md <= '01-07' };
  }

  var API = { NAMES: NAMES, solarLongitude: solarLongitude, solarTermTime: solarTermTime, termsOfYear: termsOfYear, seasonOf: seasonOf, jstParts: jstParts, deltaT: deltaT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Sekki = API;
})(this);
