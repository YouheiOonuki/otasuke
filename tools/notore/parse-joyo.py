# 常用漢字表（平成22年内閣告示第2号。文化庁の PDF）から、本表（字・音訓・例・備考）と付表（語・読み）を取り出す
# 使い方（README の「脳トレプリントの漢字の語を作り直す」）:
#   curl -o work/joyo.pdf https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/joyokanjihyo_20101130.pdf
#   python3 tools/notore/parse-joyo.py tools/notore/work/joyo.pdf tools/notore/work/joyo.json   （PyMuPDF が要る）
# 字の位置（x 座標）で欄を分ける: 漢字欄は大きな字、音訓欄 x≈134、例欄 x≈208、備考欄 x≥355。1 字下げの音訓は全角空白で始まる
import pymupdf, json, re, sys
d = pymupdf.open(sys.argv[1] if len(sys.argv) > 1 else 'joyo.pdf')
OUT = sys.argv[2] if len(sys.argv) > 2 else 'joyo.json'
entries = []; cur = None
KANJI = re.compile(r'^[㐀-鿿豈-﫿\U00020000-\U0002ffff々]')
for pno in range(len(d)):
    p = d[pno]
    spans = []
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                if s['text'].strip(): spans.append((round(s['bbox'][1]), s['bbox'][0], s['size'], s['text']))
    if not any(sz > 16 and x < 90 for (_, x, sz, _) in spans): continue   # 本表のページだけ
    spans.sort(key=lambda t: (t[0], t[1]))
    rowreading = None
    for y, x, sz, t in spans:
        if sz > 16 and x < 90:
            m = re.match(r'\s*(\S)\s*(?:（(\S+)）)?', t)
            cur = {'char': m.group(1), 'old': m.group(2) or '', 'readings': [], 'notes': [], 'page': pno + 1}
            entries.append(cur); continue
        if cur is None: continue
        if 120 < x < 200:
            ind = t.startswith('　') or t.startswith(' 　')
            cur['readings'].append({'r': t.strip(), 'special': ind, 'ex': [], 'y': y})
        elif 200 <= x < 355:
            if cur['readings'] and abs(cur['readings'][-1]['y'] - y) <= 3:
                cur['readings'][-1]['ex'].append(t.strip())
            elif cur['readings']:
                cur['readings'][-1]['ex'].append(t.strip())   # 折り返し
        elif x >= 355:
            cur['notes'].append({'y': y, 't': t.strip()})
# 許容字体（［餌］など）と康熙字典体の括弧が大きな字で別の行に出たものは、前の字にまとめる
merged = []
for e in entries:
    if not KANJI.match(e['char']):
        merged[-1]['readings'] += e['readings']; merged[-1]['notes'] += e['notes']; continue
    merged.append(e)
entries = merged
for e in entries:
    e['notes'] = ''.join(n['t'] for n in sorted(e['notes'], key=lambda n: n['y']))
    for r in e['readings']:
        r['ex'] = [w for w in re.split(r'[，,]', ''.join(r['ex'])) if w]
        del r['y']
assert len(entries) == 2136, len(entries)
assert sum(len(e['readings']) for e in entries) == 4388
# 付表（語の形で読みを示したもの。読みの平仮名の行と語の行が交互に並ぶ）
fu = []; reading = None
for pno in range(len(d) - 3, len(d)):
    for line in d[pno].get_text().split('\n'):
        line = line.strip()
        if not line or line.startswith('※') or '例「' in line or '「居士' in line or line.startswith('付'): continue
        if re.fullmatch(r'[ぁ-ん]+', line): reading = line; continue
        m = re.match(r'（(.*?)）(.*)', line)
        note = m.group(1) if m else ''
        word = m.group(2) if m else line
        if reading and re.fullmatch(r'[\u4e00-\u9fffぁ-んァ-ン々]+', word) and re.search(r'[\u4e00-\u9fff]', word):
            fu.append({'reading': reading, 'word': word, 'note': note})
json.dump({'main': entries, 'fuhyo': fu}, open(OUT, 'w'), ensure_ascii=False)
print('本表', len(entries), '付表', len(fu), file=sys.stderr)
