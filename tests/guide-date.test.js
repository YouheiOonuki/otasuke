// guide の「最終確認日」が、その道具の値ファイルの CHECKED と同じか（Q-231、yorozu-plans ROADMAP 7.219 の所見 4）。
// guide.html は静的な HTML なので日付は guide に持ったまま。ずれたらここで落とす。
// 対応に入れてよいのは、guide に並ぶ外の出どころ（yorozu-craft.com 以外のリンク）が、値ファイルの出典に全部入っている guide だけ。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// guide → 確認日を持つ値ファイル（対応はここ 1 か所）
const GUIDE_CHECKED = {
  'daicho/guide.html': 'constants.js',
  'kigo/guide.html': 'constants.js',
  'reizoko/guide.html': 'constants.js',
  'shakyo/guide.html': 'constants.js',
  'tejun/guide.html': 'constants.js',
  'tokei/guide.html': 'constants.js',
  'kenshin/guide.html': 'kenshin/kenshin-values.js',
};
// 対応から外した guide と理由（日付は動かさない。出どころの確かめ直しは企画側が決める）
const NOT_TIED = {
  'honmono/guide.html': 'constants.js の出典のうち消費者庁 caution_039 の題が原文と違う（Q-236、2026-11-15）。guide もその題を出すので、constants.js と psl-data.js の両方には対応させていない',
  'notore/guide.html': '根拠（常用漢字表・学習指導要領）が値ファイル book-values.js の出典に無い（constants.js 側にある）',
  'yasashii/guide.html': '根拠の出入国在留管理庁「やさしい日本語ガイドライン」がどの値ファイルの出典にも無い',
};

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const checkedOf = (f) => (read(f).match(/var CHECKED = '(\d{4}-\d{2}-\d{2})'/) || [])[1];
const guideDate = (f) => (read(f).match(/最終確認日 <time datetime="(\d{4}-\d{2}-\d{2})">(\d{4}-\d{2}-\d{2})<\/time>/) || []).slice(1);
const outLinks = (f) => [...read(f).matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/yorozu-craft\.com\//.test(u));

test('guide は全部、対応か対応外のどちらかに入っている', () => {
  const guides = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(ROOT, e.name, 'guide.html')))
    .map((e) => e.name + '/guide.html').sort();
  assert.deepEqual(guides, [...Object.keys(GUIDE_CHECKED), ...Object.keys(NOT_TIED)].sort());
});

for (const [g, v] of Object.entries(GUIDE_CHECKED)) {
  test(`${g} の最終確認日が ${v} の CHECKED と同じ`, () => {
    const c = checkedOf(v);
    assert.match(c || '', /^\d{4}-\d{2}-\d{2}$/, `${v} に CHECKED が無い`);
    const [attr, text] = guideDate(g);
    assert.equal(attr, text, 'datetime と表示が同じ');
    assert.equal(attr, c);
  });
  test(`${g} の外の出どころは ${v} の出典に全部ある`, () => {
    const src = read(v);
    const links = outLinks(g);
    assert.ok(links.length > 0);
    for (const u of links) assert.ok(src.includes(u), `${u} が ${v} に無い`);
  });
}
