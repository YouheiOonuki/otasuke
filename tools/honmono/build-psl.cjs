// Public Suffix List（https://publicsuffix.org/list/public_suffix_list.dat）から honmono/psl-data.js を作る
// 使い方: curl -o tools/honmono/work/public_suffix_list.dat https://publicsuffix.org/list/public_suffix_list.dat
//         node tools/honmono/build-psl.cjs tools/honmono/work/public_suffix_list.dat
// ・ICANN の部と PRIVATE の部（github.io・pages.dev など、誰でもサブドメインを作れる所）の両方を使う。
//   PRIVATE を入れないと「xxx.pages.dev」の持ち主が「pages.dev」と出てしまい、持ち主の単位として誤る
// ・日本語などの規則はブラウザが URL を読むときと同じ punycode（xn--）に直して入れる
// ・リストは Mozilla Public License 2.0。出力の先頭に元の告知と VERSION・COMMIT を残す
'use strict';
const fs = require('fs');
const path = require('path');
const url = require('url');
const src = process.argv[2];
if (!src) { console.error('使い方: node tools/honmono/build-psl.cjs <public_suffix_list.dat>'); process.exit(1); }
const text = fs.readFileSync(src, 'utf8');
const version = (text.match(/\/\/ VERSION: (\S+)/) || [])[1];
const commit = (text.match(/\/\/ COMMIT: (\S+)/) || [])[1];
if (!version || !commit) throw new Error('VERSION・COMMIT が見つからない');
let section = '';
const icann = [], priv = [];
for (const raw of text.split('\n')) {
  const line = raw.trim();
  if (line.includes('===BEGIN ICANN DOMAINS===')) section = 'icann';
  else if (line.includes('===BEGIN PRIVATE DOMAINS===')) section = 'private';
  if (!line || line.startsWith('//')) continue;
  const rule = line.split(/\s/)[0];
  const neg = rule.startsWith('!') ? '!' : '';
  const body = neg ? rule.slice(1) : rule;
  const ascii = body.split('.').map((l) => (l === '*' ? '*' : url.domainToASCII(l) || l.toLowerCase())).join('.');
  (section === 'private' ? priv : icann).push(neg + ascii);
}
if (icann.length < 5000 || priv.length < 1000) throw new Error('規則の数が少なすぎる: ' + icann.length + ' / ' + priv.length);
const out = `// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Public Suffix List（https://publicsuffix.org/）の規則を、1 行 1 規則の文字列にしたもの（tools/honmono/build-psl.cjs が作る。手で直さない）
// 元のリスト: VERSION ${version}・COMMIT ${commit}。日本語などの規則は punycode（xn--）に直した。コメントは省いた
(function (root) {
  'use strict';
  var PSL = {
    version: ${JSON.stringify(version)},
    commit: ${JSON.stringify(commit)},
    icann: ${JSON.stringify(icann.join('\n'))},
    private: ${JSON.stringify(priv.join('\n'))},
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PSL;
  else root.PslData = PSL;
})(this);
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'honmono', 'psl-data.js'), out);
console.log('ICANN', icann.length, 'PRIVATE', priv.length, 'bytes', Buffer.byteLength(out));
