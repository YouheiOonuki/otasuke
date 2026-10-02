// PDF のページ数・各ページの MediaBox・埋め込みフォントの名前を読む（依存なし。Chromium が書く PDF の形を前提にした簡易版）
// 圧縮されたオブジェクト（/ObjStm）の中も zlib で開いて探す
'use strict';
const zlib = require('node:zlib');

function texts(buf) {
  const out = [buf.toString('latin1')];
  const s = out[0];
  const re = /\/Type\s*\/ObjStm[\s\S]*?stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    try { out.push(zlib.inflateSync(buf.subarray(start, end)).toString('latin1')); } catch (e) { /* 圧縮していないか、別の形 */ }
  }
  return out;
}

function pdfInfo(buf) {
  const all = texts(buf).join('\n');
  // ページのオブジェクト（/Type /Page。/Pages は除く）の MediaBox。オブジェクトは endobj で区切る。ページに無ければ親（/Pages）の値
  const objs = all.split(/endobj/);
  const parentBox = ((objs.find((o) => /\/Type\s*\/Pages\b/.test(o)) || '').match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1];
  const boxes = objs.filter((o) => /\/Type\s*\/Page(?![s\w])/.test(o)).map((o) => {
    const mb = o.match(/\/MediaBox\s*\[([^\]]+)\]/);
    return (mb ? mb[1] : parentBox || '').trim().split(/\s+/).map(Number);
  });
  const fonts = [...new Set((all.match(/\/FontName\s*\/([^\s/<>\[\]]+)/g) || []).map((x) => x.replace(/\/FontName\s*\//, '')))];
  const embedded = /\/FontFile[23]?\b/.test(all);
  return { pages: boxes.length, boxes, fonts: embedded ? fonts : [] };
}

/**
 * ページの MediaBox を判型ちょうどの大きさに直す（Chromium の PDF はページの大きさを 1/75 インチ刻みに切り上げるため。
 * 7.17 インチは 7.18 インチになる）。ページの要素は左上から判型の大きさで組んであるので、右と下の余り（1 mm 未満）を切る。
 * 書き換えは同じバイト数（空白で埋める）なので、xref の位置は変わらない。MediaBox が圧縮の中にある PDF は扱わない
 */
function setMediaBox(buf, wPt, hPt) {
  const s = buf.toString('latin1');
  let n = 0;
  const out = s.replace(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g, (all, w, h) => {
    const W = Number(w), H = Number(h);
    if (W + 0.001 < wPt || H + 0.001 < hPt) throw new Error('PDF のページが判型より小さい: ' + W + '×' + H);
    const box = '/MediaBox [0 ' + fmt(H - hPt) + ' ' + fmt(wPt) + ' ' + fmt(H) + ']';
    if (box.length > all.length) throw new Error('MediaBox を同じ長さで書けない: ' + box);
    n++;
    return box + ' '.repeat(all.length - box.length);
  });
  if (!n) throw new Error('MediaBox が見つからない');
  return Buffer.from(out, 'latin1');
}
function fmt(x) { return String(Math.round(x * 1000) / 1000); }

module.exports = { pdfInfo, setMediaBox };
