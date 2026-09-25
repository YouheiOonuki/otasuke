// ===========================
// 「このメール・SMS は本物？」 — 貼った文から URL・メールアドレス・電話番号を拾い、ドメインを読み解く（DOM に触らない。tests/honmono.test.js）
// ・何も送信しない。URL を開かない（fetch しない）。判定は文字の並びだけ
// ・「安全」「本物です」とは言わない。出すのは「確認すべき点」だけ
// ・持ち主の単位（登録ドメイン）は Public Suffix List（honmono/psl-data.js）で求める
// ブラウザでは window.Honmono、Node では module.exports
// ===========================
(function (root) {
  'use strict';

  // --- punycode（RFC 3492）の復号。xn-- のラベルを元の文字に戻す ---
  var BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700;
  function adapt(delta, numPoints, first) {
    delta = first ? Math.floor(delta / DAMP) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    var k = 0;
    while (delta > ((BASE - TMIN) * TMAX) >> 1) { delta = Math.floor(delta / (BASE - TMIN)); k += BASE; }
    return Math.floor(k + (BASE - TMIN + 1) * delta / (delta + SKEW));
  }
  function punyDecode(input) {
    var out = [], i = 0, n = 128, bias = 72;
    var basic = input.lastIndexOf('-');
    if (basic < 0) basic = 0;
    for (var j = 0; j < basic; j++) {
      if (input.charCodeAt(j) >= 0x80) throw new Error('bad');
      out.push(input.charCodeAt(j));
    }
    for (var idx = basic > 0 ? basic + 1 : 0; idx < input.length;) {
      var oldi = i, w = 1;
      for (var k = BASE; ; k += BASE) {
        if (idx >= input.length) throw new Error('bad');
        var c = input.charCodeAt(idx++);
        var digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : BASE;
        if (digit >= BASE) throw new Error('bad');
        i += digit * w;
        var t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
        if (digit < t) break;
        w *= BASE - t;
      }
      var len = out.length + 1;
      bias = adapt(i - oldi, len, oldi === 0);
      n += Math.floor(i / len);
      i %= len;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(String, out);
  }
  /** xn-- を含むホスト名を、人が読める字に戻す（戻せないラベルはそのまま） */
  function toUnicode(host) {
    return host.split('.').map(function (l) {
      if (l.slice(0, 4) !== 'xn--') return l;
      try { return punyDecode(l.slice(4)); } catch (e) { return l; }
    }).join('.');
  }
  /** ホスト名をブラウザと同じ規則で ASCII（小文字・punycode）にする。読めなければ null */
  function toAscii(host) {
    try {
      var h = new URL('http://' + host + '/').hostname;
      return h || null;
    } catch (e) { return null; }
  }

  // --- Public Suffix List ---
  function Psl(data) {
    var normal = Object.create(null), wild = Object.create(null), exc = Object.create(null), priv = Object.create(null);
    function add(text, isPriv) {
      text.split('\n').forEach(function (r) {
        if (!r) return;
        if (r.charAt(0) === '!') { exc[r.slice(1)] = 1; return; }
        if (r.slice(0, 2) === '*.') { wild[r.slice(2)] = 1; if (isPriv) priv['*.' + r.slice(2)] = 1; return; }
        normal[r] = 1;
        if (isPriv) priv[r] = 1;
      });
    }
    add(data.icann, false);
    add(data['private'], true);
    this.normal = normal; this.wild = wild; this.exc = exc; this.priv = priv;
    this.version = data.version;
  }
  /** ホスト名（ASCII）の公開サフィックス・登録ドメイン。{ suffix, registrable, sub, known, isPrivate } */
  Psl.prototype.split = function (host) {
    var labels = host.split('.');
    var n = labels.length, suffixLen = 0, known = false, isPrivate = false;
    for (var i = 0; i < n; i++) {
      var cand = labels.slice(i).join('.');
      var parent = labels.slice(i + 1).join('.');
      if (this.exc[cand]) { suffixLen = n - i - 1; known = true; break; }
      if (this.normal[cand]) { suffixLen = n - i; known = true; isPrivate = !!this.priv[cand]; break; }
      if (parent && this.wild[parent]) { suffixLen = n - i; known = true; isPrivate = !!this.priv['*.' + parent]; break; }
    }
    if (!known) suffixLen = 1;   // 規則に無い終わり方は、最後のラベルだけを公開サフィックスとみなす（規則「*」）
    var suffix = labels.slice(n - suffixLen).join('.');
    var registrable = n > suffixLen ? labels.slice(n - suffixLen - 1).join('.') : null;
    var sub = n > suffixLen + 1 ? labels.slice(0, n - suffixLen - 1).join('.') : '';
    return { suffix: suffix, registrable: registrable, sub: sub, known: known, isPrivate: isPrivate };
  };
  Psl.prototype.isKnownTld = function (tld) { return !!(this.normal[tld] || this.wild[tld]); };

  // --- 似た字（ラテン文字に見える別の文字）。自分で選んだ小さな表 ---
  var CONFUSE = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'һ': 'h', 'ӏ': 'l', 'ѕ': 's', 'ԛ': 'q', 'ԝ': 'w', 'ү': 'y', 'к': 'k', 'м': 'm', 'т': 't', 'в': 'b', 'н': 'h',
    'ο': 'o', 'α': 'a', 'ν': 'v', 'ι': 'i', 'κ': 'k', 'ρ': 'p', 'υ': 'u', 'χ': 'x', 'ε': 'e', 'τ': 't',
    'ı': 'i', 'ɡ': 'g', 'ɩ': 'i', 'ł': 'l',
  };
  function scriptOf(ch) {
    var c = ch.codePointAt(0);
    if ((c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) return 'latin';
    if (c >= 0x400 && c <= 0x52f) return 'cyrillic';
    if (c >= 0x370 && c <= 0x3ff) return 'greek';
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x9fff) || (c >= 0xff66 && c <= 0xff9f)) return 'japanese';
    if ((c >= 0x30 && c <= 0x39) || c === 0x2d) return 'common';
    return 'other';
  }
  /** 見た目の骨格: 似た字をラテン文字に寄せ、アクセントを外し、0→o・1→l・i→l・rn→m・vv→w にそろえる（比べるときだけ使う） */
  function skeleton(s) {
    var t = '';
    Array.from(String(s).toLowerCase()).forEach(function (ch) { t += CONFUSE[ch] || ch; });
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/0/g, 'o').replace(/1/g, 'l').replace(/i/g, 'l').replace(/rn/g, 'm').replace(/vv/g, 'w');
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }

  // 短縮 URL のサービス（行き先は開かないと分からない）
  var SHORTENERS = ['bit.ly', 't.co', 'tinyurl.com', 'is.gd', 'v.gd', 'ow.ly', 'buff.ly', 'cutt.ly', 't.ly', 'x.gd', 'shorturl.at', 'rebrand.ly', 'goo.gl', 'rb.gy', 'tiny.cc', 'bl.ink', 'short.io'];

  // --- 文から拾う ---
  var URL_RE = /\b(?:https?|hxxps?):\/\/[^\s<>"'`「」『』（）()【】［］、。，｡､　]+/gi;
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63})/g;
  var BARE_RE = /(^|[^A-Za-z0-9@._%+\/-])((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z][A-Za-z0-9-]{0,62})(\/[^\s<>"'`「」『』（）()【】、。　]*)?/g;
  var PHONE_RE = /(?:\+81[\s-]?\d{1,4}|(?:^|[^\d])0\d{1,4})(?:[\s-]?\d{1,4}){1,3}(?!\d)/g;

  function trimTail(s) { return s.replace(/[.,;:!?'"\])}>。、．，！？]+$/, ''); }

  function hostOfUrl(raw) {
    var u = raw.replace(/^hxxp/i, 'http');
    var m = /^[a-z]+:\/\/([^\/?#]*)/i.exec(u);
    if (!m) return null;
    var auth = m[1], user = '';
    var at = auth.lastIndexOf('@');
    if (at >= 0) { user = auth.slice(0, at); auth = auth.slice(at + 1); }
    auth = auth.replace(/:\d*$/, '');
    // 「https://example.comへ」のように日本語が続いたときは、終わりのラベルの ASCII までで切る
    var labels = auth.split('.');
    var last = labels[labels.length - 1];
    var cut = /^[A-Za-z0-9-]+(?=[^\x00-\x7f])/.exec(last);
    if (cut) labels[labels.length - 1] = cut[0];
    auth = labels.join('.');
    return { host: auth, user: user, scheme: /^https/i.test(u) ? 'https' : 'http' };
  }

  function isIp(h) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || /^\[[0-9a-f:.]+\]$/i.test(h); }

  /**
   * 文を読み解く。brands は constants.js の brands、psl は new Psl(PslData)
   * 返り値: { links: [...], emails: [...], phones: [...], mentioned: [brand...], notes: [brand...], points: 数 }
   */
  function analyze(text, brands, psl) {
    text = String(text || '').slice(0, 20000);
    var seen = Object.create(null);
    var links = [], emails = [], phones = [];

    // 名乗っている名前
    var mentioned = brands.filter(function (b) {
      var low = text.toLowerCase();
      if ((b.words || []).some(function (w) { return low.indexOf(w.toLowerCase()) >= 0; })) return true;
      return (b.wordsRe || []).some(function (w) { return new RegExp('(^|[^A-Za-z])' + w + '([^A-Za-z]|$)').test(text); });
    });

    function addLink(host, extra) {
      var ascii = toAscii(host);
      if (!ascii) return;
      var key = ascii + '|' + (extra.user || '') + '|' + extra.scheme;
      if (seen[key]) return;
      seen[key] = 1;
      links.push(inspect(ascii, extra, 'link'));
    }

    // 1) scheme つきの URL
    var rest = text.replace(URL_RE, function (m) {
      var raw = trimTail(m);
      var h = hostOfUrl(raw);
      if (h && h.host) addLink(h.host, { raw: raw, user: h.user, scheme: h.scheme });
      return ' ';
    });
    // 2) メールアドレス（送信元などの表示。偽装できる）
    rest = rest.replace(EMAIL_RE, function (m, dom) {
      var ascii = toAscii(dom);
      if (ascii && !seen['@' + ascii]) { seen['@' + ascii] = 1; emails.push(inspect(ascii, { raw: m }, 'email')); }
      return ' ';
    });
    // 3) scheme の無いドメイン（例: amazon-co-jp.example/abc）。終わりが実在の TLD のときだけ
    rest.replace(BARE_RE, function (m, pre, host, path) {
      var tld = host.split('.').pop().toLowerCase();
      if (!psl.isKnownTld(tld) || /^\d+$/.test(tld)) return m;
      addLink(host, { raw: host + (path ? trimTail(path) : ''), user: '', scheme: 'none' });
      return m;
    });
    // 4) 電話番号
    var pseen = Object.create(null);
    (text.match(PHONE_RE) || []).forEach(function (p) {
      p = p.replace(/^[^\d+]/, '');
      var d = p.replace(/[\s-]/g, '');
      var nd = d.replace(/^\+81/, '0').length;
      if (nd < 10 || nd > 11 || pseen[d]) return;
      pseen[d] = 1;
      phones.push(p.trim());
    });

    function inspect(ascii, extra, kind) {
      var sp = psl.split(ascii);
      var uni = toUnicode(ascii);
      var r = { kind: kind, raw: extra.raw, host: ascii, hostShown: uni, registrable: sp.registrable, registrableShown: sp.registrable ? toUnicode(sp.registrable) : null,
        sub: sp.sub, subShown: sp.sub ? toUnicode(sp.sub) : '', suffix: sp.suffix, official: null, points: [], infos: [] };
      function pt(code, msg) { r.points.push({ code: code, msg: msg }); }
      function info(code, msg) { r.infos.push({ code: code, msg: msg }); }

      if (isIp(ascii)) {
        r.registrable = r.registrableShown = null; r.sub = r.subShown = ''; r.suffix = '';
        pt('ip', 'ドメイン名ではなく、数字の住所（IP アドレス）です。どこの会社のものか、この形からは分かりません。');
        return r;
      }
      if (extra.user) pt('userinfo', '「@」より左の「' + extra.user + '」は飾りで、実際に開くのは「@」より右の ' + uni + ' です。');
      if (!sp.registrable) { pt('suffix-only', uni + ' は、だれでも登録できる「終わりの部分」そのものです。'); return r; }
      if (!sp.known) pt('unknown-tld', '終わりの「.' + sp.suffix + '」は、公開サフィックス一覧に無い終わり方です。');

      var reg = sp.registrable, regLabel = reg.slice(0, reg.length - sp.suffix.length - 1);
      var regUni = toUnicode(regLabel);

      // 国際化ドメイン（xn--）
      if (/(^|\.)xn--/.test(ascii)) {
        // ラベルごとに字の種類を見る（「.com」のような終わりの部分は別のラベルなので混ぜない）
        var mixed = false, foreignOnly = false;
        toUnicode(ascii).split('.').forEach(function (lab) {
          var sc = {};
          Array.from(lab).forEach(function (ch) { sc[scriptOf(ch)] = 1; });
          if ((sc.cyrillic || sc.greek) && sc.latin) mixed = true;
          else if ((sc.cyrillic || sc.greek) && !sc.japanese && /^[a-z0-9-]+$/.test(skeleton(lab))) foreignOnly = true;
        });
        if (mixed) pt('mixed-script', 'ラテン文字（a〜z）と、見た目の似たキリル文字・ギリシャ文字が混ざっています。本当の字は「' + uni + '」（' + ascii + '）です。');
        else if (foreignOnly) pt('lookalike-script', 'a〜z に見えますが、キリル文字・ギリシャ文字でできています。本当の字は「' + uni + '」（' + ascii + '）です。');
        else info('idn', '日本語などの文字を使ったドメイン（国際化ドメイン名）です。表示は「' + uni + '」、中身は ' + ascii + ' です。');
      }

      if (sp.isPrivate) info('private', '「' + sp.suffix + '」は、だれでもサブドメインを作れる所です。持ち主は ' + toUnicode(reg) + ' を作った人で、「' + sp.suffix + '」の会社ではありません。');
      if (kind === 'link' && SHORTENERS.indexOf(reg) >= 0) pt('shortener', '短縮 URL です。本当の行き先は、開かないと分かりません。');
      if (extra.scheme === 'http') info('http', '「http:」で始まり、通信が暗号化されません（「https:」や鍵マークがあっても、本物とは限りません）。');

      // 公式のドメインと同じか、似せているか
      var own = null;
      brands.forEach(function (b) { if (b.domains.indexOf(reg) >= 0) own = b; });
      if (own) {
        r.official = own;
        if (kind === 'link') info('official', own.name + ' の公式サイトとして確かめたドメイン（' + reg + '）と同じです。ただし、メールや SMS そのものが本物かどうかは、これでは分かりません。');
        else info('official-email', own.name + ' の公式のドメインと同じ表示です。ただし、送信元の名前やアドレスは簡単に偽装できます。');
      } else {
        var skR = skeleton(regUni), hits = [];
        brands.forEach(function (b) {
          var hit = null;
          b.domains.forEach(function (d) {
            var dsp = psl.split(d), lab = d.slice(0, d.length - dsp.suffix.length - 1), skO = skeleton(lab);
            if (hit) return;
            if (skR === skO) hit = regUni === lab ? '終わりの部分（.' + sp.suffix + '）だけがちがう' : '綴りを似せている（' + regUni + '）';
            else {
              var lim = lab.length >= 8 ? 2 : lab.length >= 5 ? 1 : 0;
              if (lim && lev(skR, skO) <= lim) hit = '1〜2 字ちがい（' + regUni + ' と ' + lab + '）';
            }
          });
          if (!hit) {
            var toks = skR.split(/[-0-9]+/).filter(Boolean);
            (b.tokens || []).forEach(function (t) {
              if (hit) return;
              var st = skeleton(t);
              if (toks.indexOf(st) >= 0 || (t.length >= 5 && skR.indexOf(st) >= 0)) hit = '名前「' + t + '」' + (regUni.toLowerCase().indexOf(t) >= 0 ? 'を含む' : 'に似た綴りを含む');
            });
          }
          if (hit) hits.push({ b: b, why: hit });
        });
        hits.forEach(function (h) {
          pt('lookalike', h.b.name + ' の公式サイトとして確かめたドメイン（' + h.b.domains.join('・') + '）ではありません。' + h.why + 'ドメインです。');
        });
        r.lookalike = hits.map(function (h) { return h.b; });
        // 左側（サブドメイン）に公式の名前やドメインを入れている
        if (sp.sub) {
          var subLow = toUnicode(sp.sub).toLowerCase();
          brands.forEach(function (b) {
            if (hits.some(function (h) { return h.b === b; })) return;
            var inSub = b.domains.some(function (d) { return subLow.indexOf(d.split('.')[0]) >= 0; }) ||
              (b.tokens || []).some(function (t) { return subLow.split(/[.\-0-9]+/).indexOf(t) >= 0 || (t.length >= 5 && subLow.indexOf(t) >= 0); });
            if (inSub) pt('brand-in-sub', '左側の「' + toUnicode(sp.sub) + '」に ' + b.name + ' の名前がありますが、ここは持ち主が自由に付けられる部分です。持ち主の単位は右端の ' + toUnicode(reg) + ' です。');
          });
        }
        // 名乗っている会社の公式ドメインではない
        mentioned.forEach(function (b) {
          if (b.domains.indexOf(reg) >= 0) return;
          var already = (r.lookalike || []).indexOf(b) >= 0;
          if (!already) pt('mention', '文は ' + b.name + ' を名乗っていますが、' + (kind === 'link' ? 'リンク先' : 'このアドレス') + 'は ' + b.name + ' の公式サイトとして確かめたドメイン（' + b.domains.join('・') + '）ではありません。');
          if (b.id === 'japanpost' && (sp.suffix === 'net' || sp.suffix === 'top' || /\.(net|top)$/.test(sp.suffix))) {
            pt('jp-tld', '日本郵便は、URL に「.net」「.top」を使っていないと案内しています。このリンクは「.' + sp.suffix + '」です。');
          }
        });
      }
      if (kind === 'email') info('spoof', '送信元の名前やアドレスは簡単に偽装できるので、ここだけでは本物か分かりません。');
      return r;
    }

    // 公式が案内していること（名乗っている会社と、似せられている会社）
    var noteIds = Object.create(null), notes = [];
    function addNote(b) { if (b && b.note && !noteIds[b.id]) { noteIds[b.id] = 1; notes.push(b); } }
    mentioned.forEach(addNote);
    links.concat(emails).forEach(function (l) { (l.lookalike || []).forEach(addNote); if (l.official) addNote(l.official); });

    var points = 0;
    links.concat(emails).forEach(function (l) { points += l.points.length; });
    return { links: links, emails: emails, phones: phones, mentioned: mentioned, notes: notes, points: points };
  }

  var API = { punyDecode: punyDecode, toUnicode: toUnicode, toAscii: toAscii, Psl: Psl, skeleton: skeleton, lev: lev, analyze: analyze, SHORTENERS: SHORTENERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Honmono = API;
})(this);
