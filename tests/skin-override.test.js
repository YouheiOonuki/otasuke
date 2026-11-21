// 共通の皮のページは h1 の大きさを皮に任せる（yorozu-plans D637・Q-819）。
// 前は日めくり大時計の設定の画面で h1 を 28px に上書きしていた。どの css も皮の後ろ（yorozu-common:end の後）に h1 の font-size を書かない
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(root, { recursive: true })
  .filter((f) => f.endsWith('.css') && !f.includes('node_modules'));

test('皮の後ろに h1 の font-size の上書きが無い', () => {
  assert.ok(files.length > 0);
  for (const f of files) {
    const css = fs.readFileSync(path.join(root, f), 'utf8');
    const at = css.indexOf('/* yorozu-common:end */');
    const own = at < 0 ? css : css.slice(at);
    assert.doesNotMatch(own, /h1\s*\{[^}]*font-size/, f);
  }
});
