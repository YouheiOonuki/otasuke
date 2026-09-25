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
    // --- 脳トレプリント「漢字の読み」の語と読み（notore/kanji-data.js は tools/notore/build-kanji.cjs がここから作る） ---
    // 本表の例欄の語（両方の字の例欄に載る 2 字の熟語と、訓の語）と付表の語。読みは表の音訓・付表のとおり。
    // つなぎ目の音の変わり方（促音・連濁）は表の「表の見方」11 のとおり表に全部は無いので、IPADIC（mecab-ipadic 2.7.0）の読みと合う語だけ採った。
    // むずかしさの目安は学年別漢字配当表（小学校学習指導要領 平成29年告示の別表。tools/notore/grades.json）
    joyoKanji: {
      source: '常用漢字表（平成22年内閣告示第2号）本表・付表',
      url: 'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/joyokanjihyo_20101130.pdf',
      page: 'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/',
      counts: { kanji: 2136, readings: 4388, fuhyo: 116 },
      grades: '文部科学省「小学校学習指導要領（平成29年告示）」別表 学年別漢字配当表',
      gradesUrl: 'https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm',
      checked: CHECKED,
    },
    // --- 季語カレンダー（kigo/） ---
    // 季語の季節: 語ごとにデジタル大辞泉・精選版 日本国語大辞典（コトバンク）の季語の印で確かめた（tools/kigo/build-kigo.py・verified.json）。
    // 説明文は自作で、辞書・歳時記の文と例句は載せない
    kigo: {
      source: 'コトバンク「デジタル大辞泉」「精選版 日本国語大辞典」（小学館）の各項目の季語の印（《季 春》など）',
      url: 'https://kotobank.jp/',
      checked: CHECKED,
    },
    // 二十四節気（国立天文台 暦要項の日本時間。季節の区切りは立春・立夏・立秋・立冬の日）。表に無い年は kigo/sekki.js で計算する
    sekki: {
      table: {
        2026: { 小寒: '2026-01-05 17:23', 大寒: '2026-01-20 10:45', 立春: '2026-02-04 05:02', 雨水: '2026-02-19 00:52', 啓蟄: '2026-03-05 22:59', 春分: '2026-03-20 23:46',
          清明: '2026-04-05 03:40', 穀雨: '2026-04-20 10:39', 立夏: '2026-05-05 20:49', 小満: '2026-05-21 09:37', 芒種: '2026-06-06 00:48', 夏至: '2026-06-21 17:25',
          小暑: '2026-07-07 10:57', 大暑: '2026-07-23 04:13', 立秋: '2026-08-07 20:43', 処暑: '2026-08-23 11:19', 白露: '2026-09-07 23:41', 秋分: '2026-09-23 09:05',
          寒露: '2026-10-08 15:29', 霜降: '2026-10-23 18:38', 立冬: '2026-11-07 18:52', 小雪: '2026-11-22 16:23', 大雪: '2026-12-07 11:53', 冬至: '2026-12-22 05:50' },
        2027: { 小寒: '2027-01-05 23:10', 大寒: '2027-01-20 16:30', 立春: '2027-02-04 10:46', 雨水: '2027-02-19 06:33', 啓蟄: '2027-03-06 04:40', 春分: '2027-03-21 05:25',
          清明: '2027-04-05 09:17', 穀雨: '2027-04-20 16:18', 立夏: '2027-05-06 02:25', 小満: '2027-05-21 15:18', 芒種: '2027-06-06 06:26', 夏至: '2027-06-21 23:11',
          小暑: '2027-07-07 16:37', 大暑: '2027-07-23 10:05', 立秋: '2027-08-08 02:27', 処暑: '2027-08-23 17:14', 白露: '2027-09-08 05:28', 秋分: '2027-09-23 15:02',
          寒露: '2027-10-08 21:17', 霜降: '2027-10-24 00:33', 立冬: '2027-11-08 00:39', 小雪: '2027-11-22 22:16', 大雪: '2027-12-07 17:38', 冬至: '2027-12-22 11:42' },
      },
      source: '国立天文台 暦計算室「暦要項」令和 8 年（2026）・令和 9 年（2027）の二十四節気および雑節',
      url: 'https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html',
      url2: 'https://eco.mtk.nao.ac.jp/koyomi/yoko/2027/rekiyou272.html',
      checked: CHECKED,
    },

    // --- 「このメール・SMS は本物？」（honmono/） ---
    // 公式のドメインは、各社・各機関の公式サイトをその日に開いて、そのドメインで本人のサイトが出ることを確かめたもの。
    // note は公式の注意喚起のページに書いてあること（書いてある社だけ）。ここに無い会社は「確かめたドメインの一覧に無い」とだけ出す
    // words: 文に出てくる名前（大文字と小文字は区別しない。wordsRe は語の区切りつきで探す短い名前）
    honmono: {
      brands: [
        { id: 'nta', name: '国税庁（e-Tax）', domains: ['nta.go.jp'], words: ['国税庁', '税務署', 'e-Tax', 'eTax', 'イータックス'], tokens: ['nta', 'etax', 'e-tax', 'kokuzei'],
          note: '国税庁は、URL を書いた案内を SMS で送ることはなく、税金の納付の求めや差押えについて SMS・メール・LINE を送ることもないと案内しています。e-Tax のメールは、原則として本文に URL を書いていないとしています。',
          src: '国税庁「不審なメールや電話にご注意ください」・e-Tax「『税務署からのお知らせ』等のメールが届いた方へ」', url: 'https://www.nta.go.jp/information/attention/attention.htm', url2: 'https://www.e-tax.nta.go.jp/topics/topics_oshirase_mail.htm' },
        { id: 'nenkin', name: '日本年金機構', domains: ['nenkin.go.jp'], words: ['日本年金機構', '年金機構'], tokens: ['nenkin'] },
        { id: 'myna', name: 'マイナポータル', domains: ['myna.go.jp'], words: ['マイナポータル'], tokens: ['myna', 'mynaportal'] },
        { id: 'japanpost', name: '日本郵便・ゆうちょ銀行', domains: ['japanpost.jp'], words: ['日本郵便', '郵便局', 'ゆうパック', 'ゆうちょ', 'JP POST', 'Japan Post'], tokens: ['japanpost', 'jppost', 'japan-post', 'jp-post', 'yubin', 'yuubin', 'yucho', 'yuucho', 'jpbank', 'jp-bank'],
          note: '日本郵便は、Web サイトなどで使う URL に「.net」と「.top」は使っていないと案内しています。',
          src: '日本郵便「日本郵便を装った不審メール及び架空Webサイトにご注意ください。」', url: 'https://www.post.japanpost.jp/notification/notice/fraud-mail.html' },
        { id: 'yamato', name: 'ヤマト運輸', domains: ['kuronekoyamato.co.jp'], words: ['ヤマト運輸', 'クロネコ', 'ヤマト'], tokens: ['yamato', 'kuroneko', 'kuronekoyamato'],
          note: 'ヤマト運輸は、SMS（ショートメール）での連絡はしていないと案内しています。メールは kuronekoyamato.co.jp（と楽天市場の一部の荷物の shop.rakuten.co.jp）から送るとしています。',
          src: 'ヤマト運輸 よくあるご質問「ヤマト運輸からのメールや SMS が『迷惑（詐欺）メール』かを見分ける方法はありますか？」', url: 'https://faq.kuronekoyamato.co.jp/app/answers/detail/a_id/2507' },
        { id: 'sagawa', name: '佐川急便', domains: ['sagawa-exp.co.jp'], words: ['佐川'], tokens: ['sagawa'],
          note: '佐川急便は、荷物の集配について SMS（ショートメール）での案内はしていないと案内しています。',
          src: '佐川急便「佐川急便を装った迷惑メールにご注意ください」', url: 'https://www2.sagawa-exp.co.jp/whatsnew/detail/721/' },
        { id: 'mufg', name: '三菱UFJ銀行', domains: ['mufg.jp'], words: ['三菱UFJ', '三菱ＵＦＪ', 'MUFG'], tokens: ['mufg'] },
        { id: 'smbc', name: '三井住友銀行', domains: ['smbc.co.jp'], words: ['三井住友銀行', 'SMBC'], tokens: ['smbc'] },
        { id: 'amazon', name: 'Amazon', domains: ['amazon.co.jp', 'amazon.com'], words: ['Amazon', 'アマゾン'], tokens: ['amazon', 'amazom', 'amzn'] },
        { id: 'rakuten', name: '楽天', domains: ['rakuten.co.jp'], words: ['楽天', 'Rakuten'], tokens: ['rakuten'],
          note: '楽天グループは、サービスによっていろいろなドメインからメールを送っていると案内しています（公式でも rakuten.co.jp ではないことがあります）。',
          src: '楽天グループ「楽天グループにおけるなりすまし・フィッシングメール対策について」', url: 'https://corp.rakuten.co.jp/security/anti-fraud/' },
        { id: 'docomo', name: 'NTTドコモ', domains: ['docomo.ne.jp'], words: ['ドコモ', 'docomo'], tokens: ['docomo', 'nttdocomo'] },
        { id: 'au', name: 'au（KDDI）', domains: ['au.com', 'kddi.com'], words: ['KDDI'], wordsRe: ['au'], tokens: ['kddi', 'aupay', 'au-pay'] },
        { id: 'softbank', name: 'ソフトバンク・ワイモバイル', domains: ['softbank.jp', 'ymobile.jp'], words: ['ソフトバンク', 'SoftBank', 'ワイモバイル', 'Y!mobile'], tokens: ['softbank', 'ymobile'] },
        { id: 'jcb', name: 'JCB', domains: ['jcb.co.jp'], words: [], wordsRe: ['JCB'], tokens: ['jcb'] },
        { id: 'saison', name: 'セゾンカード', domains: ['saisoncard.co.jp'], words: ['セゾン'], tokens: ['saison', 'saisoncard'] },
        { id: 'paypay', name: 'PayPay', domains: ['paypay.ne.jp'], words: ['PayPay', 'ペイペイ'], tokens: ['paypay'] },
        { id: 'mercari', name: 'メルカリ', domains: ['mercari.com'], words: ['メルカリ', 'mercari'], tokens: ['mercari'] },
        { id: 'apple', name: 'Apple', domains: ['apple.com'], words: ['Apple', 'アップル'], tokens: ['apple', 'appleid', 'apple-id'] },
        { id: 'line', name: 'LINE', domains: ['line.me'], words: [], wordsRe: ['LINE'], tokens: [] },
        { id: 'yahoo', name: 'Yahoo! JAPAN', domains: ['yahoo.co.jp'], words: ['Yahoo', 'ヤフー'], tokens: ['yahoo'] },
      ],
      source: '各社・各機関の公式サイト（nta.go.jp・e-tax.nta.go.jp・nenkin.go.jp・myna.go.jp・post.japanpost.jp・jp-bank.japanpost.jp・kuronekoyamato.co.jp・sagawa-exp.co.jp・bk.mufg.jp・smbc.co.jp・amazon.co.jp・amazon.com・rakuten.co.jp・docomo.ne.jp・au.com・kddi.com・softbank.jp・ymobile.jp・jcb.co.jp・saisoncard.co.jp・paypay.ne.jp・jp.mercari.com・apple.com・line.me・yahoo.co.jp）を開いて確かめた',
      url: 'https://www.npa.go.jp/bureau/cyber/countermeasures/phishing.html',
      checked: CHECKED,
      // 画面の「確かめ方」の根拠（言い換えて 1 文ずつ使う）
      advice: {
        npa: { name: '警察庁「フィッシング対策」', url: 'https://www.npa.go.jp/bureau/cyber/countermeasures/phishing.html' },   // 送信元の名前・アドレスは簡単に偽装できる／フィッシング 110 番・警察へ
        caa: { name: '消費者庁「クレジットカードの不正利用にご注意ください!」', url: 'https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_039' },   // SMS やメールでいきなりカード番号を求めることはない
        antiphishing: { name: 'フィッシング対策協議会「フィッシングとは」', url: 'https://www.antiphishing.jp/consumer/abt_phishing.html' },   // 見破れない・鍵マークでも偽物がある・いつもの公式アプリとブックマークから
        kokusen: { name: '国民生活センター「通販サイト、カード会社、宅配便事業者などをかたる偽SMS・メールに警戒を！」（2022-12-21）', url: 'https://www.kokusen.go.jp/news/data/n-20221221_2.html' },   // 消費者ホットライン 188
        etax: { name: 'e-Tax「不審なショートメッセージやメールにご注意ください」', url: 'https://www.e-tax.nta.go.jp/topics/2022/topics_20220815.htm' },   // 文面のリンクの表示と行き先がちがう事例
      },
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
