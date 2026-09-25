# くらしのおたすけ（親・シニア向け）

公開 URL: **https://yorozu-craft.com/otasuke/**

離れて暮らす親のために、子（40〜50 代）が作って印刷・設置する道具。企画は yorozu-plans の `docs/29_くらしのおたすけ.md`（ROADMAP K109・K113・K114・K116・K121）と `docs/36_脳トレプリント.md`（K107）。
yorozu-craft のツールの 1 つです（共通ルールは [youheioonuki.github.io の README](https://github.com/YouheiOonuki/youheioonuki.github.io) を参照）。

## このリポジトリだけの決まり

- **広告のスクリプトを読み込まない**（ROADMAP D118。高齢者向けのページ）。全ページとも AdSense は所有確認の `<meta name="google-adsense-account">` だけ（404 は無し）。`tests/pages.test.js` が、`adsbygoogle`・`pagead2` がどのページにも無いことと、meta がちょうど 1 個であることを確かめる。サイト横断チェック（check-site）では `/otasuke/` 以下を meta だけの扱いにする
- 各ページの `<main>` の最初の段落は定型文「このページは広告なし・登録なし・入力は端末の外に出ません。」（WRITING 2 章。テストあり）
- 字は 18px 基準、ボタンは高さ 48px 以上。印刷物は白黒・A4 縦（横長の用紙は、印刷のときに縦の紙へ 90 度回す）
- 保存のキーは `otasuke_`（`shakyo`・`reizoko`・`daicho`・`tejun`・`tokei`・`notore`）。書き出しはすべてをまとめて 1 ファイル（`otasuke-backup-YYYYMMDD.json`）
- 共有リンク（`#s=`）に名前・病気・薬・電話・写真・ID は入れない

## 機能

| ページ | できること |
|---|---|
| `/otasuke/` | 道具への入口 |
| `reizoko/` 冷蔵庫に貼る紙 3 枚 | 救急情報シート（自治体の救急医療情報キットの用紙の項目から。「冷蔵庫にあります」の貼り紙つき）・服薬カレンダー（1/2/4 週・飲む時）・血圧記録表（朝晩・1 回/2 回）。名前だけでも、空欄は手書きの線 |
| `tokei/` 日めくり大時計 | 日付・曜日・午前午後・時刻を画面いっぱいに。12/24 時間・令和・秒・配色。Screen Wake Lock API で画面を消さない（使えない端末は設定の案内）。オフライン可。ES5 で書いてある（古いタブレット向け） |
| `tejun/` 親のスマホ手順カード | 1 行 1 手順（6 行まで）・手順ごとの写真（端末内で長辺 640px に縮める）・「困ったら電話」。LINE で写真を送る・iPhone で QR コードを読むのひな形 |
| `daicho/` 紙のアカウント台帳 | 種類・サービス名・ID・支払い・解約先・パスワードの控えの場所（パスワードの欄は無い）。ロック解除の番号を隠す名刺大のカード |
| `shakyo/` 写経用紙（般若心経） | なぞり書き（濃さ 3 段階）・お手本・清書用、標準（A4 横 1 枚・17 字）・大きい（A4 縦 2 枚）・特大（1 行 14 字・3 枚）、行間、題の「仏説」、願文・名前・日付 |
| `notore/` 脳トレプリント（大人向け） | 計算・漢字の読み（常用漢字表から）・間違い探し（図形を生成）・かなクロスワード（語とカギは自作）・塗り絵カレンダー（模様を生成）。3 段階・1〜10 枚・答えのページ・問題番号（seed）で同じプリントを刷り直せる。字は 14pt 以上・白黒 |
| `print/` | 印刷物のクレジットの着地ページ（noindex・sitemap に載せない） |

## 値と出典

`constants.js` に出典・URL・確認日（`CHECKED`）をまとめてある。般若心経の本文 262 字は、文化デジタルライブラリー（天台宗・真言宗豊山派の経文）と Wikisource（真言宗聖典）の写しを `tests/shakyo.test.js` に置いて照合している。

## 脳トレプリントの漢字の語を作り直す

`notore/kanji-data.js` は手で直さない。常用漢字表が改定されたとき（または語の選び方を変えたとき）に作り直す。

```sh
mkdir -p tools/notore/work
curl -o tools/notore/work/joyo.pdf https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/joyokanjihyo_20101130.pdf
python3 tools/notore/parse-joyo.py tools/notore/work/joyo.pdf tools/notore/work/joyo.json   # PyMuPDF が要る。本表 2,136 字・音訓 4,388 を確かめる
npm i --no-save lindera-wasm-nodejs-ipadic@2.0.0                                          # 読みの照合だけに使う（公開物には入れない）
node tools/notore/build-kanji.cjs tools/notore/work/joyo.json
node --test tests/*.test.js
```

`tools/notore/grades.json` は学年別漢字配当表（小学校学習指導要領 平成29年告示の別表、1,026 字。gakushu-print の `constants.js` と同じもの）。

## 保守

| 時期 | 確認すること | 直す場所 |
|------|------------|---------|
| 確認日から 12 か月まで（check-site のメモが出たら） | 救急医療情報キットの用紙（多摩市・西東京市）の項目、LINE・Apple の手順の画面、Wake Lock の対応（MDN）、Apple・Google の死後の設定の名前 | `constants.js`（`CHECKED`）、`tejun/` のひな形、各 `guide.html` の確認日と更新履歴 |

直したら、そのページの `guide.html` の「更新履歴」に日付と内容を 1 行足す。

## ファイル

| ファイル | 役割 |
|---------|------|
| `index.html` | 入口（ハブ） |
| `*/index.html`・`*/guide.html` | 各道具の画面と使い方 |
| `*/app.js`・`tokei/clock.js` | 各画面の制御 |
| `calc.js` | 画面から切り離した関数（日付・時計・写経の並び・正規化・共有・バックアップ） |
| `notore/gen.js` | 脳トレプリントの問題の生成（seed つきの乱数）と用紙の HTML |
| `notore/kanji-data.js`・`notore/kana-data.js` | 漢字の読みの語（作ったもの）・クロスワードの語とカギ（自作） |
| `tools/notore/` | 漢字の語を常用漢字表から作るスクリプト |
| `constants.js` | 出典のある値（経文・ひな形・出典と確認日） |
| `common.js` | 各ページ共通（保存・見本の縮小・印刷・共有・書き出し） |
| `screen.js` | 折りたたみの状態表示（yorozu-template） |
| `style.css` | 見た目（大きな字・ダークモード・印刷） |
| `sw.js` / `manifest.webmanifest` | オフライン対応。manifest は大時計だけが読み、ホーム画面に置くと大時計が開く（`id` は `/otasuke/`） |
| `404.html` | ツール配下の存在しない URL で出るページ（サイト共通のもの） |
| `tests/*.test.js` | テスト（`node --test tests/*.test.js`） |

## ライセンス

MIT License（`LICENSE`）。般若心経の経文は古典で著作権の対象外。
