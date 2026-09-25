// ===========================
// くらしのおたすけ — 画面から切り離した純粋関数（DOM・localStorage に触らない）
// tests/*.test.js から node --test で確かめる。ブラウザでは window.Calc、Node では module.exports
// 古いタブレットでも動くよう ES5 の書き方（var・function）にしてある（大時計が読む）
// ===========================
(function (root) {
  'use strict';

  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // --- 日付 ---
  /** 'YYYY-MM-DD' → 端末の時刻の Date（0 時）。読めなければ null */
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
    return d;
  }
  function toISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  /** 開始日から n 日分の行（月・日・曜日）。服薬カレンダー・血圧記録表の行 */
  function dayRows(startISO, n) {
    var s = parseISO(startISO);
    var out = [];
    for (var i = 0; i < n; i++) {
      if (!s) { out.push({ iso: '', m: '', d: '', w: '', wi: -1 }); continue; }   // 開始日が空なら日付も手書き
      var d = addDays(s, i);
      out.push({ iso: toISO(d), m: d.getMonth() + 1, d: d.getDate(), w: WEEK[d.getDay()], wi: d.getDay() });
    }
    return out;
  }

  /** 和暦の年（令和だけ。令和より前は null）。reiwaStart は constants.js の reiwa.start */
  function reiwaYear(d, reiwaStart) {
    var s = parseISO(reiwaStart);
    if (!s || d < s) return null;
    var y = d.getFullYear() - 2018;
    return '令和' + (y === 1 ? '元' : y) + '年';
  }

  /** 1〜99 の漢数字（写経の日付。十・二十五 の形） */
  function kanjiNum(n) {
    var D = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    n = Math.floor(Number(n));
    if (!(n >= 1 && n <= 99)) return '';
    var t = Math.floor(n / 10), o = n % 10;
    return (t ? (t === 1 ? '' : D[t]) + '十' : '') + D[o];
  }
  /** 写経の日付「令和八年九月二十五日」（令和元年は「元」） */
  function shakyoDate(d, reiwaStart) {
    var s = parseISO(reiwaStart);
    if (!s || d < s) return '';
    var y = d.getFullYear() - 2018;
    return '令和' + (y === 1 ? '元' : kanjiNum(y)) + '年' + kanjiNum(d.getMonth() + 1) + '月' + kanjiNum(d.getDate()) + '日';
  }

  // --- 大時計 ---
  /**
   * 時計に出す文字。h24 なら 24 時間表示（午前・午後なし）。12 時間表示は 0〜11 時で数える（正午からの 1 時間は「午後 0時」）
   * @returns {{year, date, week, ampm, time, sec}}
   */
  function clockParts(d, opt) {
    opt = opt || {};
    var h = d.getHours(), mi = d.getMinutes();
    var wa = opt.wareki ? reiwaYear(d, opt.reiwaStart) : null;
    return {
      year: wa || (d.getFullYear() + '年'),
      date: (d.getMonth() + 1) + '月' + d.getDate() + '日',
      week: WEEK[d.getDay()] + '曜日',
      ampm: opt.h24 ? '' : (h < 12 ? '午前' : '午後'),
      time: (opt.h24 ? pad2(h) : String(h % 12)) + ':' + pad2(mi),
      sec: pad2(d.getSeconds()),
    };
  }

  // --- 写経 ---
  // 用紙（mm）。標準は A4 横 1 枚、大きいは A4 縦、特大は A4 縦で 1 行の字数を減らす
  var SHAKYO_SIZES = {
    std: { orient: 'land', perCol: 17, label: '標準（A4 横・1 行 17 字）' },
    large: { orient: 'port', perCol: 17, label: '大きい（A4 縦・1 行 17 字）' },
    xl: { orient: 'port', perCol: 14, label: '特大（A4 縦・1 行 14 字）' },
  };
  var SHAKYO_MARGIN = 12;   // 用紙の端の余白（mm）。家庭のプリンターの印刷できない幅より広く

  function chars(s) { return Array.from ? Array.from(String(s || '')) : String(s || '').split(''); }

  /**
   * 写経用紙の並び。縦書きの列（右から左）を作り、用紙ごとに分ける
   * @param {object} o { size: std|large|xl, spacing: normal|wide, title: with|without, prayer: '', name: '', date: '' }
   * @param {object} sutra constants.js の sutra
   * @returns {{pages: Array<Array<{kind, cells: string[]}>>, perCol, colsPerPage, pageW, pageH, cellH, colW, charMm, margin}}
   */
  function shakyoLayout(o, sutra) {
    var size = SHAKYO_SIZES[o.size] || SHAKYO_SIZES.std;
    var n = size.perCol;
    var pageW = size.orient === 'land' ? 297 : 210, pageH = size.orient === 'land' ? 210 : 297;
    var usableW = pageW - SHAKYO_MARGIN * 2, usableH = pageH - SHAKYO_MARGIN * 2;
    var cellH = usableH / n;
    var charMm = cellH * 0.8;
    var colsPerPage = Math.floor(usableW / (charMm * (o.spacing === 'wide' ? 1.7 : 1.3)));
    var colW = usableW / colsPerPage;

    function col(kind, text, align) {   // align: top（上から）・bottom（下に寄せる）・indent（1 字下げ）
      var cs = chars(text).slice(0, n);
      var cells = [];
      var i;
      for (i = 0; i < n; i++) cells.push('');
      var start = align === 'bottom' ? n - cs.length : (align === 'indent' ? 1 : 0);
      for (i = 0; i < cs.length && start + i < n; i++) cells[start + i] = cs[i] === '　' || cs[i] === ' ' ? '' : cs[i];
      return { kind: kind, cells: cells };
    }

    var cols = [];
    cols.push(col('title', o.title === 'without' ? sutra.titleWithout : sutra.titleWith));
    var body = chars(sutra.body);
    for (var i = 0; i < body.length; i += n) cols.push(col('body', body.slice(i, i + n).join('')));
    cols.push(col('end', sutra.endTitle));
    cols.push(col('blank', ''));
    // 書き終わり: 日付（1 字下げ）→ 願文（「為」から）→ 氏名と謹写（下に寄せる）。大雄寺「写経の仕方」の順
    cols.push(col('date', o.date ? o.date : '令和　　年　　月　　日', 'indent'));
    cols.push(col('prayer', o.prayer ? '為' + o.prayer : ''));
    var name = chars(o.name).slice(0, Math.max(0, n - 3)).join('');
    cols.push(col('name', name ? name + '　謹写' : '謹写', 'bottom'));

    var pages = [];
    for (var p = 0; p < cols.length; p += colsPerPage) pages.push(cols.slice(p, p + colsPerPage));
    return { pages: pages, perCol: n, colsPerPage: colsPerPage, orient: size.orient, pageW: pageW, pageH: pageH,
      cellH: cellH, colW: colW, charMm: charMm, margin: SHAKYO_MARGIN, total: cols.length };
  }

  // --- アカウント台帳 ---
  /**
   * パスワードそのものを書いていそうか（英字と数字が混ざった、空白なし 8 文字以上の語）。
   * 台帳は「控えの場所」だけを書く。当てはまれば画面で知らせる（印刷は止めない）
   */
  function looksLikePassword(s) {
    var words = String(s || '').split(/[\s　、,：]+/);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length >= 8 && /[A-Za-z]/.test(w) && /\d/.test(w) && /^[\x21-\x7e]+$/.test(w) && w.indexOf('@') < 0 && !/^https?:/i.test(w)) return true;
    }
    return /パスワード\s*[：:は=]\s*\S/.test(String(s || ''));
  }

  // --- 共有リンク（#s=） ---
  // 中身は JSON を base64url にしたもの。名前・電話・病気・薬などの個人の欄は、画面側で入れない
  function toBase64Url(str) {
    var b64;
    if (typeof btoa === 'function') b64 = btoa(unescape(encodeURIComponent(str)));
    else b64 = Buffer.from(str, 'utf8').toString('base64');   // Node（テスト）
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  function encodeShare(obj) { return '#s=' + toBase64Url(JSON.stringify(obj)); }
  function decodeShare(hash) {
    var m = /^#s=([A-Za-z0-9_-]+)$/.exec(String(hash || ''));
    if (!m) return null;
    try {
      var o = JSON.parse(fromBase64Url(m[1]));
      return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch (e) { return null; }
  }

  // --- 正規化（保存データ・読み込んだファイル・共有リンクの中身はそのまま信じない） ---
  function str(v, max) { return v == null ? '' : String(v).slice(0, max || 200); }
  function pick(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function bool(v, def) { return typeof v === 'boolean' ? v : def; }

  function normShakyo(d) {
    d = d && typeof d === 'object' ? d : {};
    return {
      kind: pick(d.kind, ['trace', 'model', 'blank'], 'trace'),
      size: pick(d.size, ['std', 'large', 'xl'], 'std'),
      spacing: pick(d.spacing, ['normal', 'wide'], 'normal'),
      shade: pick(d.shade, ['light', 'normal', 'dark'], 'normal'),
      title: pick(d.title, ['with', 'without'], 'with'),
      prayer: str(d.prayer, 12),
      name: str(d.name, 12),
      today: bool(d.today, false),
      credit: bool(d.credit, false),   // 写経用紙はクレジットを既定で入れない（奉納する紙のため。企画書 29 の D129）
    };
  }

  var KYUKYU_FIELDS = ['kana', 'name', 'birth', 'sex', 'blood', 'address', 'tel', 'c1name', 'c1rel', 'c1tel', 'c2name', 'c2rel', 'c2tel',
    'h1name', 'h1dept', 'h1tel', 'h2name', 'h2dept', 'h2tel', 'illness', 'allergy', 'medicine', 'special', 'message'];
  var TIMINGS = ['wake', 'morning', 'noon', 'evening', 'bed'];
  function normReizoko(d) {
    d = d && typeof d === 'object' ? d : {};
    var k = d.kyukyu && typeof d.kyukyu === 'object' ? d.kyukyu : {};
    var kk = {};
    KYUKYU_FIELDS.forEach(function (f) { kk[f] = str(k[f], f === 'illness' || f === 'medicine' || f === 'special' || f === 'message' ? 300 : 80); });
    var f = d.fukuyaku && typeof d.fukuyaku === 'object' ? d.fukuyaku : {};
    var times = Array.isArray(f.times) ? f.times.filter(function (t) { return TIMINGS.indexOf(t) >= 0; }) : ['morning', 'noon', 'evening', 'bed'];
    var b = d.ketsuatsu && typeof d.ketsuatsu === 'object' ? d.ketsuatsu : {};
    return {
      kind: pick(d.kind, ['kyukyu', 'fukuyaku', 'ketsuatsu'], 'kyukyu'),
      name: str(d.name, 30),
      kyukyu: kk,
      signCard: bool(d.signCard, true),
      fukuyaku: { start: parseISO(f.start) ? f.start : '', days: pick(Number(f.days), [7, 14, 28], 7), times: times.length ? times : ['morning'], memo: str(f.memo, 60) },
      ketsuatsu: { start: parseISO(b.start) ? b.start : '', days: pick(Number(b.days), [14, 28], 14), twice: bool(b.twice, false) },
      credit: bool(d.credit, true),
    };
  }

  var DAICHO_KINDS = ['スマホ本体', 'メール', 'Apple・Google', 'ネット銀行・証券', 'スマホ決済・ポイント', 'サブスク', 'SNS・LINE', '買い物', 'その他'];
  function normDaicho(d) {
    d = d && typeof d === 'object' ? d : {};
    var rows = Array.isArray(d.rows) ? d.rows.slice(0, 60) : [];
    return {
      owner: str(d.owner, 30),
      rows: rows.map(function (r) {
        r = r && typeof r === 'object' ? r : {};
        return { kind: pick(r.kind, DAICHO_KINDS, 'その他'), service: str(r.service, 40), id: str(r.id, 60), pay: str(r.pay, 40), contact: str(r.contact, 60), where: str(r.where, 40) };
      }),
      blankRows: pick(Number(d.blankRows), [0, 4, 8, 12], 8),
      card: bool(d.card, true),
      credit: bool(d.credit, true),
    };
  }

  function normTejun(d) {
    d = d && typeof d === 'object' ? d : {};
    var steps = Array.isArray(d.steps) ? d.steps.slice(0, 6) : [];
    return {
      title: str(d.title, 30),
      steps: steps.map(function (s) {
        s = s && typeof s === 'object' ? s : { text: s };
        var photo = typeof s.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.photo) && s.photo.length < 400000 ? s.photo : '';
        return { text: str(s.text, 40), photo: photo };
      }),
      helpName: str(d.helpName, 20),
      helpTel: str(d.helpTel, 20),
      layout: pick(d.layout, ['a4', 'a5'], 'a4'),
      credit: bool(d.credit, true),
    };
  }

  function normTokei(d) {
    d = d && typeof d === 'object' ? d : {};
    return {
      h24: bool(d.h24, false),
      wareki: bool(d.wareki, false),
      seconds: bool(d.seconds, false),
      theme: pick(d.theme, ['dark', 'light'], 'dark'),
    };
  }

  // 脳トレプリント（notore/）。seed は問題番号（32bit の整数）。名前は保存するが共有リンクには入れない（画面側）
  function normNotore(d) {
    d = d && typeof d === 'object' ? d : {};
    var pages = Math.round(Number(d.pages));
    var seed = Number(d.seed);
    return {
      kind: pick(d.kind, ['calc', 'kanji', 'machigai', 'cross', 'nurie'], 'calc'),
      level: pick(d.level, ['easy', 'normal', 'hard'], 'normal'),
      pages: pages >= 1 && pages <= 10 ? pages : 1,
      answers: bool(d.answers, true),
      op: pick(d.op, ['mix', 'add', 'sub', 'mul', 'div'], 'mix'),
      month: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(d.month || '')) ? String(d.month) : '',
      name: str(d.name, 12),
      credit: bool(d.credit, true),
      seed: seed >= 0 && seed <= 4294967295 && Math.floor(seed) === seed ? seed : null,
    };
  }

  // --- バックアップファイル（README「ツールを追加するとき」20。決定 D31） ---
  // 形式: { tool, version, exportedAt, data }。data はブラウザに保存しているものと同じ形
  var BACKUP_VERSION = 1;

  /** 書き出すファイル名: <ツール名>-backup-YYYYMMDD.json（日付は端末の時計） */
  function backupFileName(tool, date) {
    var d = date || new Date();
    return tool + '-backup-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '.json';
  }

  /** 書き出す中身 */
  function buildBackup(tool, data, date) {
    return { tool: tool, version: BACKUP_VERSION, exportedAt: (date || new Date()).toISOString(), data: data };
  }

  /**
   * 読み込んだファイルの文字列を確かめる。中身の正規化は上の norm* で行う
   * @returns {{ok: true, data: object} | {ok: false, error: string}} error は画面にそのまま出す文
   */
  function parseBackup(text, tool, requiredKeys) {
    var o;
    try { o = JSON.parse(text); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.tool !== 'string') {
      return { ok: false, error: 'ファイルを読み取れませんでした。このツールの「ファイルに書き出す」で作った .json ファイルを選んでください。' };
    }
    if (o.tool !== tool) {
      return { ok: false, error: 'ほかのツール（' + o.tool.slice(0, 40) + '）のファイルです。このツールで書き出したファイルを選んでください。' };
    }
    if (o.version !== BACKUP_VERSION) {
      return { ok: false, error: typeof o.version === 'number' && o.version > BACKUP_VERSION
        ? '新しい版のツールで書き出したファイルのため読み込めません。ページを再読み込みしてから、もう一度お試しください。'
        : 'ファイルの形式が正しくないため読み込めません。' };
    }
    var data = o.data;
    var missing = !data || typeof data !== 'object' || Array.isArray(data) ||
      (requiredKeys || []).some(function (k) { return data[k] === undefined || data[k] === null; });
    if (missing) return { ok: false, error: 'ファイルの中身が足りないため読み込めません。' };
    return { ok: true, data: data };
  }

  var api = {
    WEEK: WEEK, pad2: pad2, parseISO: parseISO, toISO: toISO, addDays: addDays, dayRows: dayRows, reiwaYear: reiwaYear,
    kanjiNum: kanjiNum, shakyoDate: shakyoDate, clockParts: clockParts, SHAKYO_SIZES: SHAKYO_SIZES, shakyoLayout: shakyoLayout, looksLikePassword: looksLikePassword,
    encodeShare: encodeShare, decodeShare: decodeShare,
    normShakyo: normShakyo, normReizoko: normReizoko, normDaicho: normDaicho, normTejun: normTejun, normTokei: normTokei, normNotore: normNotore,
    KYUKYU_FIELDS: KYUKYU_FIELDS, TIMINGS: TIMINGS, DAICHO_KINDS: DAICHO_KINDS,
    backupFileName: backupFileName, buildBackup: buildBackup, parseBackup: parseBackup,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
