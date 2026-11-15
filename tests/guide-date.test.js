// guide の「最終確認日」が、その道具の値ファイルの CHECKED と同じか（Q-231、yorozu-plans ROADMAP 7.219 の所見 4）。
// guide.html は静的な HTML なので日付は guide に持ったまま。ずれたらここで落とす。
// 対応に入れてよいのは、guide に並ぶ外の出どころ（yorozu-craft.com 以外のリンク）が、値ファイルの出典に全部入っている guide だけ。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// guide → 確認日を持つ値ファイル（対応はここ 1 か所）。値ファイルを複数並べたときは、guide の日付はその CHECKED の古いほう、外の出どころはどれかの出典にあればよい
const GUIDE_CHECKED = {
  'daicho/guide.html': 'constants.js',
  'kigo/guide.html': 'constants.js',
  'reizoko/guide.html': 'constants.js',
  'shakyo/guide.html': 'constants.js',
  'tejun/guide.html': 'constants.js',
  'tokei/guide.html': 'constants.js',
  'kenshin/guide.html': 'kenshin/kenshin-values.js',
  'notore/guide.html': 'constants.js',
  'yasashii/guide.html': 'constants.js',
  'honmono/guide.html': ['constants.js', 'honmono/psl-data.js'],
};
// 対応から外した guide と理由（日付は動かさない。出どころの確かめ直しは企画側が決める）
const NOT_TIED = {
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
  const files = [].concat(v);
  const name = files.join('・');
  test(`${g} の最終確認日が ${name} の CHECKED（古いほう）と同じ`, () => {
    const cs = files.map((f) => {
      const c = checkedOf(f);
      assert.match(c || '', /^\d{4}-\d{2}-\d{2}$/, `${f} に CHECKED が無い`);
      return c;
    });
    const [attr, text] = guideDate(g);
    assert.equal(attr, text, 'datetime と表示が同じ');
    assert.equal(attr, cs.sort()[0]);
  });
  test(`${g} の外の出どころは ${name} の出典に全部ある`, () => {
    const src = files.map(read).join('\n');
    const links = outLinks(g);
    assert.ok(links.length > 0);
    for (const u of links) assert.ok(src.includes(u), `${u} が ${name} に無い`);
  });
}
