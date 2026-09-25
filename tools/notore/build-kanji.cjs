// 脳トレプリント「漢字の読み」の語を、常用漢字表（平成22年内閣告示第2号）から作り、notore/kanji-data.js に書き出す
// 使い方（README「脳トレプリントの漢字の語を作り直す」）:
//   npm i --no-save lindera-wasm-nodejs-ipadic@2.0.0
//   node tools/notore/build-kanji.cjs tools/notore/work/joyo.json
//
// 語の選び方（他サイトの問題は写さない。語も読みも常用漢字表から）
// 1. 訓の語: 本表の例欄のうち、字だけ（位）か「字＋送り仮名」（囲む）で、読みが音訓欄の訓と同じもの
// 2. 2 字の熟語: 例欄の 2 字の語で、両方の字の例欄に載っているもの。読みは両方の字の音訓をつないだ形で、
//    つなぎ目の音の変わり方（促音・連濁・半濁音。表の「表の見方」11）は、IPADIC の読みと合うものだけ採る
// 3. 付表の語（熟字訓・当て字）: 読みは付表のとおり
// 読みが割れる語は外す: 同じ字の 2 つ以上の音訓の例欄に出る語（開く＝あく／ひらく）、付表の語で本表の例欄にも出るもの（梅雨）、
// 付表でよく知られた別の読みがある語（EXCLUDE_WORDS）
// 採る語はすべて IPADIC でも 1 語として同じ読みになること（照合）。IPADIC は語を選ぶための照合にだけ使い、公開物には入れない
// 学年（むずかしさの目安）は学年別漢字配当表（grades.json。小学校学習指導要領 平成29年告示の別表、1,026 字）
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('lindera-wasm-nodejs-ipadic');

const J = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, 'work/joyo.json'), 'utf8'));
const GRADES = JSON.parse(fs.readFileSync(path.join(__dirname, 'grades.json'), 'utf8'));
const OUT = path.join(__dirname, '../../notore/kanji-data.js');

const grade = {};
Object.keys(GRADES).forEach((g) => { for (const c of GRADES[g]) grade[c] = Number(g); });
const b = new L.TokenizerBuilder(); b.setDictionary('embedded://ipadic'); b.setMode('normal');
const tk = b.build();
const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanji = (c) => /[一-鿿々\u{20B9F}]/u.test(c);
function ipadic(w) {
  const t = tk.tokenize(w);
  return t.length === 1 && t[0].reading ? hira(t[0].reading) : '';
}

// 高齢の方に配る紙に向かない語（死・病気・暴力・犯罪など）は、字か語で外す
const EXCLUDE_CHARS = '死殺葬病癌棺墓遺骸屍呪刑獄罪犯賊暴虐淫妾娼拷弔喪患症疫瘍痢衰惨憎恨怨鬱盗奪爆弾銃闘侵斬絞狂愚醜卑蔑痴忘嫉妬賭尻股乳娠胎尿便疾毒傷';
const EXCLUDE_WORDS = [
  // 付表で、よく知られた別の読みがある語（答えが割れる）
  '明日', '昨日', '今日', '今年', '一日', '二十', '五月', '上手', '下手', '紅葉', '仮名', '博士', '河岸', '白髪', '凸凹', '雑魚', '意気地',
  // 付表・例欄の語で、配る紙に向かないもの
  '浮気', '八百長', '最期', '通夜', '成仏', '供養', '回向', '亡者', '流罪', '謀反', '殺生', '相殺',
  // 表では 2 つの読み（寄贈＝キソウ〈1 字下げ〉／IPADIC はキゾウ）
  '寄贈',
];
const excluded = (w) => EXCLUDE_WORDS.includes(w) || [...w].some((c) => EXCLUDE_CHARS.includes(c));

const byChar = new Map(J.main.map((e) => [e.char, e]));
// 同じ字の 2 つ以上の音訓の例欄に出る語（読みが割れる）
const rowsOf = new Map();
J.main.forEach((e) => e.readings.forEach((r) => r.ex.forEach((w) => {
  const k = w + '\t' + e.char;
  rowsOf.set(k, (rowsOf.get(k) || 0) + 1);
})));
const split = (w) => [...new Set([...w])].some((c) => (rowsOf.get(w + '\t' + c) || 0) > 1);

const SOKU = 'くきつち';
const DAKU = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HAN = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
function joins(a, c) {   // 表の読み a・c をつないだ形と、つなぎ目の音の変わり方
  const v = [a + c];
  const last = a.slice(-1), first = c[0];
  if (SOKU.includes(last) && /[かきくけこさしすせそたちつてとはひふへほ]/.test(first)) {
    v.push(a.slice(0, -1) + 'っ' + c);
    if (HAN[first]) v.push(a.slice(0, -1) + 'っ' + HAN[first] + c.slice(1));
  }
  if (DAKU[first]) v.push(a + DAKU[first] + c.slice(1));
  if (last === 'ん' && HAN[first]) v.push(a + HAN[first] + c.slice(1));
  return v;
}

const words = new Map();   // 語 → { r, kind, special }
for (const e of J.main) {
  for (const row of e.readings) {
    for (const w of row.ex) {
      if (words.has(w) || excluded(w) || split(w)) continue;
      const kun = /^[ぁ-ん]+$/.test(row.r);
      const okuri = w.slice(1);
      if (kun && (w === e.char || (w[0] === e.char && /^[ぁ-ん]+$/.test(okuri) && row.r.endsWith(okuri)))) {
        if (ipadic(w) === row.r) words.set(w, { r: row.r, kind: 'kun', special: row.special });
        continue;
      }
      const cs = [...w];
      if (cs.length !== 2 || !cs.every(isKanji) || cs[0] === cs[1] || !byChar.has(cs[0]) || !byChar.has(cs[1])) continue;
      const other = byChar.get(cs[0] === e.char ? cs[1] : cs[0]);
      const oRows = other.readings.filter((x) => x.ex.includes(w));
      if (oRows.length !== 1) continue;   // 両方の字の例欄に載っている語だけ
      const got = ipadic(w);
      if (!got) continue;
      const [ra, rc] = cs[0] === e.char ? [row.r, oRows[0].r] : [oRows[0].r, row.r];
      if (joins(hira(ra), hira(rc)).includes(got)) words.set(w, { r: got, kind: 'comp', special: row.special || oRows[0].special });
    }
  }
}
// 付表の語が本表の例欄にも出るもの（梅雨＝ばいう、今朝＝こんちょう、二十歳＝にじっさい）は、音読みもあるので外す
const inExamples = new Set();
J.main.forEach((e) => e.readings.forEach((r) => r.ex.forEach((w) => inExamples.add(w))));
for (const f of J.fuhyo) {
  if (excluded(f.word) || words.has(f.word) || inExamples.has(f.word)) continue;
  const alt = (/「(.+?)」/.exec(f.note) || [])[1] || '';   // 師走（「しはす」とも言う。）
  words.set(f.word, { r: f.reading, kind: 'fuhyo', special: true, alt });
}

// むずかしさ（字の学年と読みの特別さで決める。語の「よく使う・使わない」は測っていない）
// やさしい: 小学校で習う字だけの語（1・2 年の字 1 字の訓〈山・川〉は大人には易しすぎるので外す）
// ふつう: 中学以降の字を含む語。付表・1 字下げの語でも、字が小学 4 年までのもの（大人・今朝・景色）
// むずかしい: 付表・1 字下げ（特別な読み）の語で 5 年以上の字を含むもの、中学以降の字 2 字の熟語、中学以降の字で読みが 5 字以上の訓（弄ぶ）
function maxGrade(w) { return Math.max(...[...w].filter(isKanji).map((c) => grade[c] || 7)); }
function minGrade(w) { return Math.min(...[...w].filter(isKanji).map((c) => grade[c] || 7)); }
const level = { easy: [], normal: [], hard: [] };
for (const [w, x] of words) {
  const item = x.alt ? [w, x.r, x.alt] : [w, x.r];
  const g = maxGrade(w);
  if (x.special) (g <= 4 ? level.normal : level.hard).push(item);
  else if (g <= 6) {
    if (x.kind === 'kun' && w.length === 1 && g <= 2) continue;
    level.easy.push(item);
  } else if ((x.kind === 'comp' && minGrade(w) === 7) || (x.kind === 'kun' && x.r.length >= 5)) level.hard.push(item);
  else level.normal.push(item);
}
const counts = { easy: level.easy.length, normal: level.normal.length, hard: level.hard.length };
const src = `// ===========================
// 脳トレプリント「漢字の読み」の語（tools/notore/build-kanji.cjs が常用漢字表から作ったもの。手で直さない）
// 出典: 常用漢字表（平成22年内閣告示第2号）の本表の音訓・例欄と付表（文化庁の PDF）。むずかしさの目安は学年別漢字配当表
// 語の数: やさしい ${counts.easy}・ふつう ${counts.normal}・むずかしい ${counts.hard}（[語, 読み] か [語, 読み, 別の読み]）
// ===========================
(function (root) {
  'use strict';
  var KANJI_WORDS = ${JSON.stringify(level).replace(/\],\[/g, '],\n    [').replace(/:\[\[/g, ': [\n    [')};
  if (typeof module !== 'undefined' && module.exports) module.exports = KANJI_WORDS;
  else root.NotoreKanji = KANJI_WORDS;
})(this);
`;
fs.writeFileSync(OUT, src);
console.log(counts);
