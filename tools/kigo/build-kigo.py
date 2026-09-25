#!/usr/bin/env python3
# 季語の一覧（tools/kigo/kigo.tsv）の季節を辞書で確かめて、kigo/kigo-data.js と tools/kigo/verified.json を作る。
# 確かめ方: コトバンク（https://kotobank.jp/word/<見出し>）の「デジタル大辞泉」「精選版 日本国語大辞典」（どちらも小学館）の項目にある
#   季語の印（《季 春》・《 季語・春 》）を読み、その辞書の最初の印が tsv の季節と同じなら採る。どちらの辞書にも無い・違うときは止める。
# 説明文は自分で書いたもの（辞書・歳時記の文は写さない）。例句も載せない。
# 使い方: python3 tools/kigo/build-kigo.py [--cache DIR]   （ネットワークが要る。取ったページは DIR にためて再利用）
import json, os, re, subprocess, sys, time, urllib.parse, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cache = 'tools/kigo/work'
if '--cache' in sys.argv: cache = sys.argv[sys.argv.index('--cache') + 1]
os.makedirs(os.path.join(ROOT, cache), exist_ok=True)
DICTS = {'daijisen': 'デジタル大辞泉', 'nikkokuseisen': '精選版 日本国語大辞典'}
TAG = re.compile(r'《\s*季(?:語)?\s*[・\s]?\s*(新年|春|夏|秋|冬)[^》]{0,20}》')

rows, verified, bad = [], {}, []
for line in open(os.path.join(ROOT, 'tools/kigo/kigo.tsv'), encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'): continue
    season, word, yomi, expl, look = line.split('|')
    url = 'https://kotobank.jp/word/' + urllib.parse.quote(look)
    f = os.path.join(ROOT, cache, look + '.kotobank')
    if not os.path.exists(f) or os.path.getsize(f) < 1000:
        subprocess.run(['curl', '-sSL', '-m', '30', '-A', 'Mozilla/5.0', '-o', f, url], check=True)
        time.sleep(0.7)
    s = open(f, encoding='utf-8', errors='replace').read()
    found = {}
    for sec in re.split(r'class="dictype cf ', s)[1:]:
        name = sec.split('"', 1)[0]
        if name not in DICTS: continue
        tags = TAG.findall(re.sub(r'<[^>]+>', '', sec))
        if tags: found[name] = tags
    ok = [n for n, t in found.items() if t[0] == season]
    if not ok: bad.append((season, word, found)); continue
    verified[word] = {'season': season, 'lookup': look, 'url': url, 'dicts': {DICTS[n]: found[n] for n in found}}
    rows.append([season, word, yomi, expl])

if bad:
    for b in bad: print('確かめられない:', b)
    sys.exit(1)
today = datetime.date.today().isoformat()
json.dump({'checked': today, 'source': 'コトバンク（デジタル大辞泉・精選版 日本国語大辞典）', 'words': verified},
          open(os.path.join(ROOT, 'tools/kigo/verified.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
js = ['// 季語の一覧（tools/kigo/build-kigo.py が tools/kigo/kigo.tsv から作る。手で直さない）',
      '// [季節, 季語, 読み, 説明]。説明は自作。季節はデジタル大辞泉・精選版 日本国語大辞典（コトバンク）の季語の印で確かめた（tools/kigo/verified.json）',
      '(function (root) {', "  'use strict';", '  var KIGO = [']
for r in rows: js.append('    ' + json.dumps(r, ensure_ascii=False) + ',')
js += ['  ];', "  if (typeof module !== 'undefined' && module.exports) module.exports = KIGO;", '  else root.KigoData = KIGO;', '})(this);', '']
open(os.path.join(ROOT, 'kigo/kigo-data.js'), 'w', encoding='utf-8').write('\n'.join(js))
print('OK', len(rows), '語')
