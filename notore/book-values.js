// ===========================
// 脳トレの本（KDP のペーパーバック、ROADMAP K127）— 判型・裁ち落とし・余白・ページ数の値（出典・確認日つき。値はここ 1 か所だけに持つ）
// 値は KDP の公式ヘルプ（日本語版と英語版の同じページ）を開いて写した（下の SOURCES）。
// 確認日（CHECKED）はサイト横断チェック（check-site）が読む。ブラウザでは window.NotoreBookValues、Node では module.exports
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-10-02';   // 下の 3 ページをこの日に開いて、表の値を 1 つずつ確かめた

  var SOURCES = {
    trim: {
      title: 'Kindle ダイレクト・パブリッシング ヘルプ「判型、裁ち落とし、マージンの設定」',
      url: 'https://kdp.amazon.co.jp/ja_JP/help/topic/GVBQ3CMEQW3W2VL6',
      urlEn: 'https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6',
      checked: CHECKED,
    },
    submit: {
      title: 'Kindle ダイレクト・パブリッシング ヘルプ「ペーパーバックの提出ガイドライン」',
      url: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G201857950',
      checked: CHECKED,
    },
    fonts: {
      title: 'Kindle ダイレクト・パブリッシング ヘルプ「ペーパーバックのフォント」',
      url: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G202145450',
      checked: CHECKED,
    },
  };

  // 判型: 「判型仕様（幅 x 高さ）と最小/最大ページ数（kdp.amazon.co.jp）」の大判の行「18.2 x 25.7 cm (7.17 x 10.12 インチ)」（B5）
  // PDF のページの大きさは表のインチの値を使う（mm の 182×257 とは 0.1 mm 未満の差）
  var TRIM = { name: 'B5', widthIn: 7.17, heightIn: 10.12, widthMm: 182, heightMm: 257, large: true };

  // ページ数: 同じ表の B5 の行、「黒インクと用紙 (白)」の列「24 ～ 828」
  var PAGES = { min: 24, max: 828, ink: '黒インクと用紙 (白)' };

  // 裁ち落とし: 「上、下、外側の端から 3.2 mm (0.125 インチ) 切り取る」。
  // PDF は「高さを 6.4 mm (0.25 インチ)、幅を 3.2 mm (0.125 インチ) 大きく」（ノド側には足さない）
  var BLEED_IN = 0.125;

  // 余白: 「ページ数ごとの最小マージン サイズ（裁ち落としあり/なし）」の表
  // 内側（ノド）はページ数で変わる。[最初のページ数, 最後のページ数, 内側の最小（インチ）]
  var GUTTER = [
    [24, 150, 0.375],
    [151, 300, 0.5],
    [301, 500, 0.625],
    [501, 700, 0.75],
    [701, 828, 0.875],
  ];
  // 上・下・外側の最小（インチ）。裁ち落としなし 0.25（6.4 mm）、あり 0.375（9.6 mm）
  var OUTSIDE_MIN_IN = { noBleed: 0.25, bleed: 0.375 };

  // フォント: 最小 7 ポイント、すべて埋め込む（「ペーパーバックの提出ガイドライン」「ペーパーバックのフォント」）
  var MIN_FONT_PT = 7;

  /** ページ数に対する内側（ノド）の最小（インチ）。範囲外は null */
  function gutterIn(pages) {
    for (var i = 0; i < GUTTER.length; i++) if (pages >= GUTTER[i][0] && pages <= GUTTER[i][1]) return GUTTER[i][2];
    return null;
  }
  /** PDF の 1 ページの大きさ（インチ）。裁ち落としありは幅 +0.125・高さ +0.25 */
  function pageSizeIn(bleed) {
    return bleed ? { w: round4(TRIM.widthIn + BLEED_IN), h: round4(TRIM.heightIn + BLEED_IN * 2) } : { w: TRIM.widthIn, h: TRIM.heightIn };
  }
  function round4(n) { return Math.round(n * 10000) / 10000; }

  var api = {
    CHECKED: CHECKED, SOURCES: SOURCES, TRIM: TRIM, PAGES: PAGES, BLEED_IN: BLEED_IN, GUTTER: GUTTER,
    OUTSIDE_MIN_IN: OUTSIDE_MIN_IN, MIN_FONT_PT: MIN_FONT_PT, gutterIn: gutterIn, pageSizeIn: pageSizeIn,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NotoreBookValues = api;
})(this);
