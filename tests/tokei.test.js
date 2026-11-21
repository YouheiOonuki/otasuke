// 日めくり大時計の画面（tokei/clock.js）のテスト（Q-415）: 開いた時から時計が出る・分の変わり目で字が変わる・保存した設定で出る・
// 画面を消さない設定は、ボタンを押したか保存がある端末でだけ取りにいく。DOM は持たないので、clock.js が触る分だけの作り物で動かす
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../constants.js');
const Calc = require('../calc.js');

const SRC = fs.readFileSync(path.join(__dirname, '../tokei/clock.js'), 'utf8');
const IDS = ['setup', 'open-setup', 'start', 'fs', 'wl-status', 'wl-note', 'h24', 'wareki', 'seconds', 'clock', 'c-date', 'c-week', 'c-ampm', 'c-time', 'c-sec'];

function el(id) {
  const ls = {};
  return {
    id, hidden: false, textContent: '', checked: false, className: '', value: '', style: {}, parentNode: { style: {} },
    addEventListener(t, f) { (ls[t] = ls[t] || []).push(f); },
    fire(t) { (ls[t] || []).forEach((f) => f({})); },
  };
}

// now: 開いた時の時刻（Date）。store: localStorage の中身
function open(now, store) {
  const els = {};
  IDS.forEach((id) => { els[id] = el(id); });
  const themes = ['dark', 'light'].map((v) => Object.assign(el('theme-' + v), { value: v, name: 'theme' }));
  const inputs = [els.h24, els.wareki, els.seconds, ...themes];
  let t = now.getTime();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(t); }
    static now() { return t; }
  }
  const timers = [];
  const locks = [];
  const doc = {
    body: { className: '' }, visibilityState: 'visible',
    getElementById: (id) => els[id],
    querySelector: (q) => {
      if (/:checked/.test(q)) return themes.find((r) => r.checked) || null;
      const m = q.match(/value="(\w+)"/); return m ? themes.find((r) => r.value === m[1]) : null;
    },
    querySelectorAll: () => inputs,
    addEventListener() {},
  };
  const win = { Constants: C, Calc, innerWidth: 1280, innerHeight: 800, addEventListener() {} };
  const ctx = {
    window: win, document: doc, Date: FakeDate, Math, JSON, String, Number,
    navigator: { wakeLock: { request: () => { locks.push(1); return { then() {} }; } } },
    location: { protocol: 'file:', hostname: '' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    setTimeout: (f) => { timers.push(f); },
  };
  vm.runInNewContext(SRC, ctx);
  return {
    els, themes, locks, body: doc.body,
    // 時刻を進めて、待っている 1 秒ごとの呼び出しを 1 回だけ動かす
    advance(ms) { t += ms; const f = timers.shift(); if (f) f(); },
  };
}

test('開いた時から時計が出る（設定の箱は閉じ、押す数 0）', () => {
  const s = open(new Date(2026, 10, 18, 9, 30, 0), {});
  assert.equal(s.els.setup.hidden, true);
  assert.equal(s.els['open-setup'].hidden, false);
  assert.equal(s.els['c-time'].textContent, '9:30');
  assert.equal(s.els['c-ampm'].textContent, '午前');
  assert.equal(s.els['c-week'].textContent, '水曜日');
  assert.equal(s.els['c-date'].textContent, '2026年 11月18日');
});

test('分の変わり目で字が変わる（9:59 → 10:00、11 月 18 日 23:59 → 19 日 0:00）', () => {
  const s = open(new Date(2026, 10, 18, 9, 59, 59, 500), {});
  assert.equal(s.els['c-time'].textContent, '9:59');
  s.advance(600);
  assert.equal(s.els['c-time'].textContent, '10:00');
  const n = open(new Date(2026, 10, 18, 23, 59, 59, 500), {});
  assert.equal(n.els['c-ampm'].textContent, '午後');
  assert.equal(n.els['c-time'].textContent, '11:59');
  n.advance(600);
  assert.equal(n.els['c-ampm'].textContent, '午前');
  assert.equal(n.els['c-time'].textContent, '0:00');
  assert.equal(n.els['c-week'].textContent, '木曜日');
  assert.equal(n.els['c-date'].textContent, '2026年 11月19日');
});

test('設定を変えて開き直すと、同じ設定で時計が出る（保存の形は otasuke_tokei のまま）', () => {
  const store = {};
  const a = open(new Date(2026, 10, 18, 14, 5, 7), store);
  a.els.h24.checked = true; a.els.seconds.checked = true;
  a.themes[0].checked = false; a.themes[1].checked = true;
  a.els.h24.fire('change');
  assert.deepEqual(JSON.parse(store.otasuke_tokei), { h24: true, wareki: false, seconds: true, theme: 'light' });
  const b = open(new Date(2026, 10, 18, 14, 5, 7), store);
  assert.equal(b.els.setup.hidden, true);
  assert.equal(b.body.className, 'light');
  assert.equal(b.els['c-ampm'].textContent, '');
  assert.equal(b.els['c-time'].textContent, '14:05');
  assert.equal(b.els['c-sec'].textContent, '07');
});

test('画面を消さない設定: 保存の無い端末は押した時だけ、保存のある端末は開いた時に取りにいく', () => {
  const store = {};
  const a = open(new Date(2026, 10, 18, 9, 0, 0), store);
  assert.equal(a.locks.length, 0);
  a.els['open-setup'].fire('click');
  assert.equal(a.els.setup.hidden, false);
  a.els.start.fire('click');
  assert.equal(a.els.setup.hidden, true);
  assert.equal(a.locks.length, 1);
  assert.ok(store.otasuke_tokei);
  const b = open(new Date(2026, 10, 18, 9, 0, 0), store);
  assert.equal(b.locks.length, 1);
});

// Q-726・D583: 目立たせない作りの「設定」も、字と地の比は 4.5 以上。0.35 は黒い地で #595959（2.99）だった。
// 0.6 で黒い地 #999（7.4）・白い地 #666（5.7）。押した時・当てた時の 1 は残す
test('「設定」のボタン（.gear）の薄さは 0.6 以上（字と地の比 4.5 以上。D583）', () => {
  const css = fs.readFileSync(path.join(__dirname, '../tokei/tokei.css'), 'utf8');
  const rule = css.match(/\.gear\s*\{([^}]*)\}/);
  assert.ok(rule, '.gear の規則が無い');
  const m = rule[1].match(/opacity:\s*([\d.]+)/);
  assert.ok(m, '.gear に opacity が無い');
  assert.ok(Number(m[1]) >= 0.6, `.gear の opacity が ${m[1]}`);
  assert.match(css, /\.gear:focus,\s*\.gear:hover\s*\{\s*opacity:\s*1;\s*\}/);
});
