// ===========================
// くらしのおたすけ — 出典のある値・文（値・出典・確認日をセットで 1 か所に）
// 画面と印刷物はここから読む。確認日（CHECKED）はサイト横断チェック（check-site）が読む
// ブラウザでは window.Constants、Node（テスト）では module.exports で使う
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-09-25';   // 下の出典をすべてこの日に開いて確かめた

  var CONSTANTS = {
    CHECKED: CHECKED,

    // --- 写経（般若心経。玄奘訳。経文は古典で著作権の対象外） ---
    // 本文 262 字は、文化デジタルライブラリーの天台宗・真言宗豊山派の経文（2 宗派で本文は同じ字）と一字ずつ照合した（tests/shakyo.test.js）。
    // 字体（咒・罣礙・顚）も同ページに合わせた。Wikisource の「真言宗聖典」（大正 15 年）版は 呪・罜礙・顛 の字体で、字の並びは同じ。
    // 大正新修大蔵経の本文は「遠離顛倒夢想」（一切が無い）で、日本で唱える経文とは 2 字ちがう
    sutra: {
      body: '観自在菩薩行深般若波羅蜜多時照見五蘊皆空度一切苦厄舎利子色不異空空不異色色即是空空即是色受想行識亦復如是' +
        '舎利子是諸法空相不生不滅不垢不浄不増不減是故空中無色無受想行識無眼耳鼻舌身意無色声香味触法無眼界乃至無意識界' +
        '無無明亦無無明尽乃至無老死亦無老死尽無苦集滅道無智亦無得以無所得故菩提薩埵依般若波羅蜜多故心無罣礙無罣礙故' +
        '無有恐怖遠離一切顚倒夢想究竟涅槃三世諸仏依般若波羅蜜多故得阿耨多羅三藐三菩提故知般若波羅蜜多是大神咒是大明咒' +
        '是無上咒是無等等咒能除一切苦真実不虚故説般若波羅蜜多咒即説咒曰羯諦羯諦波羅羯諦波羅僧羯諦菩提薩婆訶',
      bodyLength: 262,
      titleWith: '仏説摩訶般若波羅蜜多心経',     // 真言宗豊山派の経文の題
      titleWithout: '摩訶般若波羅蜜多心経',       // 天台宗の経文の題
      endTitle: '般若心経',                       // 両宗派とも経文の末尾
      source: '文化デジタルライブラリー「読経」（独立行政法人日本芸術文化振興会）の天台宗・真言宗豊山派「般若心経」経文、Wikisource「般若心経」（玄奘訳テキスト・大正新修大蔵経収録テキスト）',
      url: 'https://www2.ntj.jac.go.jp/dglib/contents/learn/edc28/kiku/shoho/dokkyou.html',
      url2: 'https://ja.wikisource.org/wiki/%E8%88%AC%E8%8B%A5%E5%BF%83%E7%B5%8C',
      checked: CHECKED,
    },
    // 書き終わりの並び（願文・日付・氏名・謹写）と願文の例
    shakyoHowto: {
      prayers: ['家内安全', '心願成就', '諸縁吉祥', '学道増進', '世界平和', '諸災消除'],   // 大雄寺の「願文の例」のうち、名前を入れずに書けるもの
      source: '曹洞宗 黒羽山 大雄寺「写経体験・写経について」（写経の仕方・願文の例）',
      url: 'https://www.daiouji.or.jp/sutra.html',
      checked: CHECKED,
    },

    // --- 救急情報シート（自治体の救急医療情報キットの記入用紙の項目から） ---
    kyukyu: {
      source: '多摩市「『救急医療情報キット』を配付しています」（情報シート PDF）、西東京市「救急医療情報キット（無料配布）」（救急情報用紙・記入例 PDF）、八王子市「救急医療情報（用紙）のご利用を」、港区「救急医療情報キット」',
      url: 'https://www.city.tama.lg.jp/kenkofukushi/1008237/1016873/1016937/1002942.html',
      url2: 'https://www.city.nishitokyo.lg.jp/kurasi/iza/bosai/josei/iryoukitto.html',
      url3: 'https://www.city.hachioji.tokyo.jp/emergency/medical/p005727.html',
      url4: 'https://www.city.minato.tokyo.jp/azabuhokenfukushi/kenko/kenko/kyukyu.html',
      checked: CHECKED,
    },

    // --- 血圧記録表（家庭血圧の測り方。記録欄の形にだけ使う。判定や目標値は載せない） ---
    ketsuatsu: {
      howto: '朝は起きて1時間以内・朝食と薬の前、晩は寝る直前。トイレを済ませ、1〜2分いすに座ってから。',
      source: '日本高血圧学会「家庭で血圧を測定しましょう」（パンフレット PDF）',
      url: 'https://www.jpnsh.jp/pub_katei.html',
      checked: CHECKED,
    },

    // --- アカウント台帳（デジタル終活） ---
    digital: {
      source: '国民生活センター「今から考えておきたい『デジタル終活』」（2024-11-20 公表・報告書 PDF）',
      url: 'https://www.kokusen.go.jp/news/data/n-20241120_1.html',
      apple: 'Apple「Apple Account の故人アカウント管理連絡先を追加する方法」',
      appleUrl: 'https://support.apple.com/ja-jp/102631',
      google: 'Google アカウント ヘルプ「アカウント無効化管理ツールについて」',
      googleUrl: 'https://support.google.com/accounts/answer/3036546?hl=ja',
      checked: CHECKED,
    },

    // --- 手順カードのひな形（公式の手順のとおり。画面が変わったら直す） ---
    steps: {
      // 公式の手順を、親に伝わる言い方に 1 行ずつ直したもの（手順の数と順は公式のまま）
      templates: {
        line: { title: 'LINE で写真を送る', steps: ['LINE を開く', '「ホーム」で送る相手の名前を探して押す', '「トーク」を押す', '文字を書く欄の横の「写真」の絵を押す', '送りたい写真を選んで、送るボタンを押す'] },
        qr: { title: 'QR コードを読む（iPhone）', steps: ['「カメラ」を開く', '「写真」のまま、QR コードに向ける', 'QR コードを枠の中に入れる', '画面の下に出る文字を押す'] },
        call: { title: '電話に出る', steps: [] },
        blank: { title: '', steps: [] },
      },
      source: 'LINEみんなの使い方ガイド「写真／動画を送信する」（2024-08-28 更新）、Apple「iPhone のカメラで QR コードをスキャンする」（iPhone ユーザガイド iOS 27）',
      url: 'https://guide.line.me/ja/chats-calls-notifications/chats/send-images-videos.html',
      url2: 'https://support.apple.com/ja-jp/guide/iphone/iphe8bda8762/ios',
      checked: CHECKED,
    },

    // --- 大時計（画面を消さない機能が動くブラウザ。MDN の互換性データ 8.1.3） ---
    wakeLock: {
      note: 'Chrome・Edge 84 以降、iPhone・iPad の Safari 16.4 以降（ホーム画面に追加したときは 18.4 以降）、Firefox 126 以降',
      source: 'MDN browser-compat-data 8.1.3（api.WakeLock）',
      url: 'https://developer.mozilla.org/ja/docs/Web/API/Screen_Wake_Lock_API',
      checked: CHECKED,
    },
    // 令和の始まり（和暦の表示）
    reiwa: {
      start: '2019-05-01',
      source: '元号を改める政令（平成 31 年政令第 143 号。施行 2019-05-01）',
      url: 'https://laws.e-gov.go.jp/law/431CO0000000143',
      checked: CHECKED,
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONSTANTS;
  else root.Constants = CONSTANTS;
})(this);
