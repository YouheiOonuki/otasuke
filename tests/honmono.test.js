// 「このメール・SMS は本物？」のテスト: punycode・Public Suffix List・似せた綴り・名乗りとリンク先のずれ・「安全」と言わないこと・送信しないこと
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const H = require('../honmono/check.js');
const PSL_DATA = require('../honmono/psl-data.js');
const C = require('../constants.js');
const psl = new H.Psl(PSL_DATA);
const BRANDS = C.honmono.brands;
const ROOT = path.join(__dirname, '..');
const run = (t) => H.analyze(t, BRANDS, psl);
const codes = (l) => l.points.map((p) => p.code);

test('punycode の復号は Node（WHATWG URL）と同じ結果', () => {
  for (const d of ['xn--mazon-3ve.com', 'xn--cckwcxetd.com', 'xn--pple-43d.com', 'xn--wgv71a119e.jp', 'xn--eckwd4c7c.xn--zckzah', 'www.example.com', 'xn--80ak6aa92e.com']) {
    assert.equal(H.toUnicode(d), url.domainToUnicode(d), d);
  }
  assert.equal(H.toAscii('アマゾン.com'), 'xn--cckwcxetd.com');
  assert.equal(H.toAscii('ＡＭＡＺＯＮ.co.jp'), 'amazon.co.jp');   // 全角はブラウザと同じく英数字に直る
});

test('Public Suffix List: 持ち主の単位（登録ドメイン）', () => {
  const cases = [
    ['www.amazon.co.jp', 'amazon.co.jp', 'co.jp'],
    ['kuronekoyamato.co.jp.redelivery.example.com', 'example.com', 'com'],
    ['www.nta.go.jp', 'nta.go.jp', 'go.jp'],
    ['my-shop.pages.dev', 'my-shop.pages.dev', 'pages.dev'],          // PRIVATE の部
    ['foo.bar.city.kawasaki.jp', 'city.kawasaki.jp', 'kawasaki.jp'],  // 例外の規則（!city.kawasaki.jp）
    ['a.b.kawasaki.jp', 'a.b.kawasaki.jp', 'b.kawasaki.jp'],          // ワイルドカード（*.kawasaki.jp）
    ['www.pref.tokyo.lg.jp', 'tokyo.lg.jp', 'lg.jp'],
    ['foo.example.unknowntld', 'example.unknowntld', 'unknowntld'],   // 一覧に無い終わり方は最後のラベル
  ];
  for (const [host, reg, suf] of cases) {
    const s = psl.split(host);
    assert.equal(s.registrable, reg, host);
    assert.equal(s.suffix, suf, host);
  }
  assert.equal(psl.split('co.jp').registrable, null);
  assert.equal(psl.split('my-shop.pages.dev').isPrivate, true);
  assert.equal(psl.split('www.amazon.co.jp').isPrivate, false);
  assert.match(PSL_DATA.version, /^\d{4}-\d{2}-\d{2}_/);
  assert.match(fs.readFileSync(path.join(ROOT, 'honmono/psl-data.js'), 'utf8'), /Mozilla Public\n\/\/ License, v\. 2\.0/);
});

test('公式のドメイン: 各社の値は Public Suffix List で見て登録ドメインそのもの', () => {
  assert.equal(BRANDS.length, 20);
  const seen = new Set();
  for (const b of BRANDS) {
    assert.ok(b.id && b.name && b.domains.length, b.id);
    for (const d of b.domains) {
      assert.equal(psl.split(d).registrable, d, b.id + ' ' + d);
      assert.ok(!seen.has(d), d); seen.add(d);
    }
    if (b.note) { assert.match(b.url, /^https:\/\//, b.id); assert.ok(b.src, b.id); }
  }
  // 使い方ページの一覧と数がそろっている
  const guide = fs.readFileSync(path.join(ROOT, 'honmono/guide.html'), 'utf8');
  assert.match(guide, new RegExp('確かめた ' + BRANDS.length + ' 社・機関'));
  for (const b of BRANDS) for (const d of b.domains) assert.ok(guide.includes(d), 'guide に ' + d + ' が無い');
  assert.ok(guide.includes(PSL_DATA.version), 'guide の PSL の版');
});

test('公式と同じドメインは「確かめたドメインと同じ」とだけ言い、確認すべき点は 0', () => {
  const r = run('Amazon のご注文 https://www.amazon.co.jp/gp/css/order-history');
  assert.equal(r.links.length, 1);
  assert.deepEqual(codes(r.links[0]), []);
  assert.equal(r.links[0].official.id, 'amazon');
  assert.match(r.links[0].infos[0].msg, /本物かどうかは、これでは分かりません/);
});

test('左側に公式の名前を入れたドメイン・名乗りとのずれ', () => {
  const r = run('【ヤマト運輸】お荷物のお届けにあがりました https://kuronekoyamato.co.jp.redelivery.example.com/check');
  const l = r.links[0];
  assert.equal(l.registrable, 'example.com');
  assert.equal(l.sub, 'kuronekoyamato.co.jp.redelivery');
  assert.deepEqual(codes(l), ['brand-in-sub', 'mention']);
  assert.deepEqual(r.notes.map((b) => b.id), ['yamato']);
});

test('似せた綴り: 数字の 0・キリル文字・終わりだけちがう・1 字ちがい・名前を含む', () => {
  const cases = [
    ['https://amaz0n.co.jp/', 'lookalike', 'amazon'],
    ['https://xn--mazon-3ve.com/', 'mixed-script', 'amazon'],
    ['https://rakuten.xyz/', 'lookalike', 'rakuten'],
    ['https://kuronekoyamoto.co.jp/', 'lookalike', 'yamato'],
    ['https://sagawa-exp.co.jp.example.net/ https://sagawa-delivery.com/', 'lookalike', 'sagawa'],
    ['https://japanpost-redelivery.top/', 'lookalike', 'japanpost'],
    ['https://www.smbc-co-jp.com/', 'lookalike', 'smbc'],
    ['https://paypal-paypay.info/', 'lookalike', 'paypay'],
  ];
  for (const [t, code, id] of cases) {
    const r = run(t);
    const l = r.links[r.links.length - 1];
    assert.ok(codes(l).includes(code), t + ' → ' + JSON.stringify(codes(l)));
    if (code === 'lookalike') assert.ok(l.lookalike.some((b) => b.id === id), t);
  }
  // キリル文字だけでラテン文字に見えるもの
  const cy = run('https://' + H.toAscii('аррӏе.com') + '/');
  assert.ok(codes(cy.links[0]).includes('lookalike-script'), JSON.stringify(codes(cy.links[0])));
});

test('日本郵便を名乗り .top・.net のリンク → 日本郵便の案内（URL に .net・.top を使っていない）を示す', () => {
  const r = run('日本郵便です。再配達はこちら https://redelivery-center.net/');
  assert.ok(codes(r.links[0]).includes('jp-tld'));
  assert.equal(r.notes[0].id, 'japanpost');
});

test('「@」の飾り・IP アドレス・短縮 URL・http・だれでも作れる所', () => {
  const r = run('https://www.amazon.co.jp@evil.example.net/x http://192.0.2.1/login bit.ly/3xYz0 http://example.org/ https://shop.pages.dev/');
  const by = Object.fromEntries(r.links.map((l) => [l.host, l]));
  assert.ok(codes(by['evil.example.net']).includes('userinfo'));
  assert.deepEqual(codes(by['192.0.2.1']), ['ip']);
  assert.ok(codes(by['bit.ly']).includes('shortener'));
  assert.ok(by['example.org'].infos.some((i) => i.code === 'http'));
  assert.ok(by['shop.pages.dev'].infos.some((i) => i.code === 'private'));
});

test('メールアドレスは「偽装できる」を必ず添える。電話番号を拾う', () => {
  const r = run('送信元: e-Tax <info@e-tax.nta.go.jp> 未払いの税金 お問い合わせ 0120-23-28-86 または 03-1234-5678');
  assert.equal(r.emails.length, 1);
  assert.ok(r.emails[0].infos.some((i) => i.code === 'spoof'));
  assert.deepEqual(r.phones, ['0120-23-28-86', '03-1234-5678']);
  assert.equal(r.notes[0].id, 'nta');
});

test('文の中のドメインらしくない語（版番号・小数・日本語の文）は拾わない', () => {
  const r = run('ver.2.1 を 3.5 倍に。お荷物は明日届きます。ご確認ください。');
  assert.equal(r.links.length, 0);
  const r2 = run('詳しくは https://example.comへ');
  assert.equal(r2.links[0].host, 'example.com');
});

test('どの結果の文にも「安全」「本物です」「問題ありません」と書かない', () => {
  const samples = ['https://www.amazon.co.jp/', 'https://example.com/', 'Amazon https://amaz0n.co.jp/', 'info@e-tax.nta.go.jp', 'bit.ly/abc',
    'https://xn--mazon-3ve.com/', 'https://アマゾン.com/', 'http://192.0.2.1/', 'https://shop.pages.dev/', '日本郵便 https://a.top/'];
  const all = [];
  for (const t of samples) {
    const r = run(t);
    for (const l of r.links.concat(r.emails)) for (const m of l.points.concat(l.infos)) all.push(m.msg);
    for (const b of r.notes) all.push(b.note);
  }
  for (const b of BRANDS) if (b.note) all.push(b.note);
  for (const m of all) assert.doesNotMatch(m, /安全です|安全な|本物です|問題ありません|問題なさそう/, m);
  const html = fs.readFileSync(path.join(ROOT, 'honmono/index.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'honmono/app.js'), 'utf8');
  assert.doesNotMatch(html, /安全です|本物です|問題ありません/);
});

test('送信しない・開かない・保存しない（通信の API と localStorage を使わない）', () => {
  for (const f of ['honmono/check.js', 'honmono/app.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(s, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|window\.open|location\.href\s*=/, f);
  }
  const page = fs.readFileSync(path.join(ROOT, 'honmono/index.html'), 'utf8');
  assert.doesNotMatch(page, /<form[^>]*action=/);
  // 共通の保存（otasuke_ のキー）にも入れない
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'common.js'), 'utf8'), /'honmono'/);
});
