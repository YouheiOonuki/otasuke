// ===========================
// 健診結果の経年グラフ — 項目と、グラフに引く線の値（出典・確認日つき。値はここ 1 か所だけに持つ）
// 線の値は厚生労働省「標準的な健診・保健指導プログラム（令和6年度版）」の PDF を開いて写した（下の source）。
// 線の名前は資料の語のまま（保健指導判定値・受診勧奨判定値・内臓脂肪蓄積のリスク判定）。「異常」「正常」は使わない。
// 確認日（CHECKED）はサイト横断チェック（check-site）が読む。ブラウザでは window.KenshinValues、Node では module.exports
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-10-02';   // 下の 2 つの PDF をこの日に開いて、表の値を 1 つずつ確かめた

  // 線の種類（資料の語。kind → 名前）
  var KINDS = {
    guide: '保健指導判定値',
    refer: '受診勧奨判定値',
    strat: '内臓脂肪蓄積のリスク判定',
  };

  // 出典
  var SOURCES = {
    // 第2編 別紙5「健診検査項目の保健指導判定値及び受診勧奨判定値」（p.125）。添付資料 p.126 の見開き版も同じ値
    table: {
      title: '厚生労働省「標準的な健診・保健指導プログラム（令和6年度版）」第2編 別紙5「健診検査項目の保健指導判定値及び受診勧奨判定値」（p.125）',
      short: '標準的な健診・保健指導プログラム（令和6年度版）別紙5',
      url: 'https://www.mhlw.go.jp/content/10900000/001231392.pdf',
      checked: CHECKED,
    },
    // 第2編 第3章 3-1(2)「具体的な階層化の方法」ステップ1（p.57）。腹囲・BMI は別紙5 の表に無く、特定保健指導の対象を選ぶ値
    strat: {
      title: '同 第2編 第3章「具体的な階層化の方法」ステップ1（内臓脂肪蓄積のリスク判定、p.57）',
      short: '同 第2編第3章 ステップ1',
      url: 'https://www.mhlw.go.jp/content/10900000/001081570.pdf',
      checked: CHECKED,
    },
    // プログラムの一覧のページ（各 PDF への入口）
    page: {
      title: '厚生労働省「標準的な健診・保健指導プログラム（令和6年度版）」',
      url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000194155_00004.html',
      checked: CHECKED,
    },
  };

  // 項目（順は画面と印刷の並び）。unit は資料の書き方。打ち間違いを止める範囲は ../calc.js の KENSHIN_RANGE（線の値ではない）
  // name は資料の項目名（別紙5 の表にある項目）か、健診の結果票でふつうに使う名前
  // lines: op は資料の記号（≧ は「以上」、＜ は「未満」）。sex は m・f（腹囲）、when は fasting・random（中性脂肪）
  var ITEMS = [
    { key: 'height', name: '身長', unit: 'cm', step: 0.1, lines: [] },
    { key: 'weight', name: '体重', unit: 'kg', step: 0.1, lines: [] },
    { key: 'bmi', name: 'BMI', unit: 'kg/m²', step: 0.1, calc: true, lines: [
      { kind: 'strat', op: '≧', v: 25, note: '腹囲が上の値に当たらないときに使う' },
    ] },
    { key: 'waist', name: '腹囲', unit: 'cm', step: 0.1, lines: [
      { kind: 'strat', op: '≧', v: 85, sex: 'm' },
      { kind: 'strat', op: '≧', v: 90, sex: 'f' },
    ] },
    { key: 'sbp', name: '収縮期血圧', unit: 'mmHg', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 130 }, { kind: 'refer', op: '≧', v: 140 },
    ] },
    { key: 'dbp', name: '拡張期血圧', unit: 'mmHg', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 85 }, { kind: 'refer', op: '≧', v: 90 },
    ] },
    { key: 'fbs', name: '空腹時血糖', unit: 'mg/dl', step: 1, lines: [
      // 随時血糖も資料では同じ値（≧100・≧126）
      { kind: 'guide', op: '≧', v: 100 }, { kind: 'refer', op: '≧', v: 126 },
    ] },
    { key: 'hba1c', name: 'HbA1c（NGSP）', unit: '%', step: 0.1, lines: [
      { kind: 'guide', op: '≧', v: 5.6 }, { kind: 'refer', op: '≧', v: 6.5 },
    ] },
    { key: 'ldl', name: 'LDLコレステロール', unit: 'mg/dl', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 120 }, { kind: 'refer', op: '≧', v: 140 },
    ] },
    { key: 'hdl', name: 'HDLコレステロール', unit: 'mg/dl', step: 1, lines: [
      // 受診勧奨判定値は資料の表で「－」（値なし）
      { kind: 'guide', op: '＜', v: 40 },
    ] },
    { key: 'tg', name: '中性脂肪', unit: 'mg/dl', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 150, when: 'fasting' },   // 空腹時中性脂肪
      { kind: 'guide', op: '≧', v: 175, when: 'random' },    // 随時中性脂肪
      { kind: 'refer', op: '≧', v: 300 },                    // 空腹時・随時とも
    ] },
    { key: 'ast', name: 'AST（GOT）', unit: 'U/L', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 31 }, { kind: 'refer', op: '≧', v: 51 },
    ] },
    { key: 'alt', name: 'ALT（GPT）', unit: 'U/L', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 31 }, { kind: 'refer', op: '≧', v: 51 },
    ] },
    { key: 'ggt', name: 'γ-GT（γ-GTP）', unit: 'U/L', step: 1, lines: [
      { kind: 'guide', op: '≧', v: 51 }, { kind: 'refer', op: '≧', v: 101 },
    ] },
    { key: 'egfr', name: 'eGFR', unit: 'ml/min/1.73m²', step: 0.1, lines: [
      // 資料の表では「＜60*」「＜45*」と ＊ が付いている（表の中に ＊ の説明は無い）
      { kind: 'guide', op: '＜', v: 60, star: true }, { kind: 'refer', op: '＜', v: 45, star: true },
    ] },
    { key: 'ua', name: '尿酸', unit: 'mg/dl', step: 0.1, lines: [] },
  ];

  var SEX = { m: '男性', f: '女性' };
  var WHEN = { fasting: '空腹時', random: '随時' };

  // HbA1c の JDS 値と NGSP 値（第2編第3章 p.57 の注 i。平成25年度から NGSP 値で表記）
  var HBA1C = {
    ngspFrom: 2013,
    note: 'ＮＧＳＰ値（%）＝１.02×ＪＤＳ値（%）＋0.25%',
    url: SOURCES.strat.url,
  };

  var api = { CHECKED: CHECKED, KINDS: KINDS, SOURCES: SOURCES, ITEMS: ITEMS, SEX: SEX, WHEN: WHEN, HBA1C: HBA1C };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KenshinValues = api;
})(this);
