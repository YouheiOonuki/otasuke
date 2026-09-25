// 全ページの決まりのテスト: 広告のスクリプトを読み込まない（企画書 29・ROADMAP D118）、所有確認の meta は 1 個、
// Cloudflare ビーコンは 1 個、高齢者向けの定型文（WRITING 2 章）が本文の最初にある、共通ページへの相対リンク
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const FILES = htmlFiles(ROOT);
const rel = (f) => path.relative(ROOT, f);
const NOAD = 'このページは広告なし・登録なし・入力は端末の外に出ません。';

test('ページが揃っている（ハブ・5 つの道具と使い方・着地ページ・404）', () => {
  const names = FILES.map(rel).sort();
  for (const n of ['index.html', '404.html', 'print/index.html', 'shakyo/index.html', 'shakyo/guide.html', 'reizoko/index.html', 'reizoko/guide.html',
    'daicho/index.html', 'daicho/guide.html', 'tokei/index.html', 'tokei/guide.html', 'tejun/index.html', 'tejun/guide.html']) {
    assert.ok(names.includes(n), n + ' が無い');
  }
});

test('広告のスクリプト（adsbygoogle.js・pagead2）をどのページも読み込まない', () => {
  for (const f of FILES) {
    const s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /pagead2\.googlesyndication|adsbygoogle/i, rel(f) + ' に広告のスクリプトか広告枠がある');
    assert.doesNotMatch(s, /googletagservices|doubleclick\.net/i, rel(f));
  }
  // JS から差し込むこともしない
  for (const f of ['common.js', 'calc.js', 'screen.js', 'constants.js', 'shakyo/app.js', 'reizoko/app.js', 'daicho/app.js', 'tejun/app.js', 'tokei/clock.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /pagead2|adsbygoogle/i, f);
  }
});

test('所有確認の meta（google-adsense-account）は各ページにちょうど 1 個（404 は 0 個）', () => {
  for (const f of FILES) {
    const n = (fs.readFileSync(f, 'utf8').match(/<meta name="google-adsense-account" content="ca-pub-5375267956079717">/g) || []).length;
    assert.equal(n, rel(f) === '404.html' ? 0 : 1, rel(f));
  }
});

test('Cloudflare のビーコンは各ページに 1 個（README 6）', () => {
  for (const f of FILES) {
    const n = (fs.readFileSync(f, 'utf8').match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length;
    assert.equal(n, 1, rel(f));
  }
});

test('高齢者向けの定型文が <main> の最初の段落にある（404 以外）', () => {
  for (const f of FILES) {
    if (rel(f) === '404.html') continue;
    const s = fs.readFileSync(f, 'utf8');
    const main = s.slice(s.indexOf('<main'));
    const first = main.match(/<(p|h2|fieldset|form|ul|ol|table)\b[^>]*>([\s\S]*?)<\/\1>/);
    assert.ok(first, rel(f));
    assert.equal(first[2].trim(), NOAD, rel(f) + ' の最初の段落が定型文ではない');
  }
});

test('共通ページ（運営者情報・プライバシーポリシー）へ相対パスでリンクしている（README 8・15）', () => {
  for (const f of FILES) {
    if (rel(f) === '404.html') continue;
    const s = fs.readFileSync(f, 'utf8');
    const depth = rel(f).split('/').length - 1;
    const up = '../'.repeat(depth + 1);
    assert.ok(s.includes('href="' + up + 'about.html"'), rel(f) + ' about');
    assert.ok(s.includes('href="' + up + 'privacy-policy.html"'), rel(f) + ' privacy');
  }
});

test('着地ページ（print/）は noindex で sitemap に載せない。ほかのページは sitemap に載る', () => {
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.match(fs.readFileSync(path.join(ROOT, 'print/index.html'), 'utf8'), /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(sm, /\/print\//);
  for (const f of FILES) {
    const r = rel(f);
    if (r === '404.html' || r.startsWith('print/')) continue;
    const url = 'https://yorozu-craft.com/otasuke/' + r.replace(/index\.html$/, '');
    assert.ok(sm.includes('<loc>' + url + '</loc>'), url + ' が sitemap に無い');
    assert.ok(fs.readFileSync(f, 'utf8').includes('<link rel="canonical" href="' + url + '">'), r + ' の canonical');
  }
});

test('Service Worker: キャッシュ名は otasuke-、先読みするファイルはすべてある、manifest の id は /otasuke/', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_PREFIX = 'otasuke-';/);
  const list = sw.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)[1].match(/'\.\/[^']*'/g).map((x) => x.slice(3, -1));
  for (const u of list) {
    const p = path.join(ROOT, u === '' || u.endsWith('/') ? u + 'index.html' : u);
    assert.ok(fs.existsSync(p), u + ' が無い');
  }
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(mf.id, '/otasuke/');
  assert.equal(mf.start_url, './tokei/');
});
