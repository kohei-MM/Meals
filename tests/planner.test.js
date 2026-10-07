const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/data.js');
const P = require('../js/planner.js');
const { parseNotes, recipeMatches } = require('../js/notes.js');

const base = { startDate: '2026-10-05', days: 7, servings: 2, shopInterval: 7, target: { p: 30, f: 22, c: 95 }, seed: 42 };
const dishes = (res) => res.days.flatMap((d) => [d.main, d.side, d.soup]).filter(Boolean).map((id) => D.RECIPE_BY_ID[id]);

test('全レシピの食材がデータに存在し、栄養値が計算できる', () => {
  for (const r of D.RECIPES) {
    for (const id of Object.keys(r.ing)) assert.ok(D.ING_BY_ID[id], `${r.id}: ${id}`);
    assert.ok(r.nut.p >= 0 && r.nut.f >= 0 && r.nut.c >= 0);
  }
});

test('指定した日数・日付で献立ができる', () => {
  const res = P.plan(base);
  assert.strictEqual(res.days.length, 7);
  assert.strictEqual(res.days[0].date, '2026-10-05');
  assert.strictEqual(res.days[6].date, '2026-10-11');
  for (const d of res.days) assert.ok(d.main && d.side && d.soup);
});

test('期間合計の栄養が目標の ±10% 以内', () => {
  const res = P.plan(base);
  for (const k of ['p', 'f', 'c']) {
    const ratio = res.total[k] / res.targetTotal[k];
    assert.ok(ratio > 0.9 && ratio < 1.1, `${k}: ${ratio}`);
  }
});

test('同じ seed なら同じ結果', () => {
  assert.deepStrictEqual(P.plan(base).days, P.plan(base).days);
});

test('備考で除外した食材・料理は使われない', () => {
  const notes = parseNotes('卵アレルギー、辛いものは苦手、汁物なし、20分以内');
  const res = P.plan(Object.assign({}, base, { notes }));
  for (const r of dishes(res)) {
    for (const t of notes.exclude) assert.ok(!recipeMatches(r, t), `${r.name} は除外対象`);
    if (r.slot !== 'soup') assert.ok(r.time <= 20, `${r.name} ${r.time}分`);
  }
  assert.ok(res.days.every((d) => d.soup === null));
});

test('残っている食材を使い切る方向で献立を組む', () => {
  const stock = [{ id: 'cabbage', amount: 400 }, { id: 'spinach', amount: 120 }, { id: 'potato', amount: 2 }];
  const res = P.plan(Object.assign({}, base, { stock }));
  for (const s of res.stockUse) assert.ok(s.used / s.have >= 0.9, `${s.id}: ${s.used}/${s.have}`);
});

test('買う量は必要量以上で、パック単位になっている', () => {
  const res = P.plan(Object.assign({}, base, { shopInterval: 4, days: 10 }));
  assert.ok(res.trips.length >= 2);
  for (const t of res.trips) for (const it of t.items) {
    const ing = D.ING_BY_ID[it.id];
    assert.ok(it.buyAmount + 1e-9 >= it.need);
    assert.ok(Math.abs(it.buyAmount / ing.pack - Math.round(it.buyAmount / ing.pack)) < 1e-9);
  }
});

test('固定した日はそのまま残る', () => {
  const locked = [{ main: 'm_curry', side: 's_coleslaw', soup: 'p_minestrone' }, null, null, null, null, null, null];
  const res = P.plan(Object.assign({}, base, { locked }));
  assert.strictEqual(res.days[0].main, 'm_curry');
  assert.strictEqual(res.days[0].side, 's_coleslaw');
});

test('手動変更の再計算', () => {
  const res = P.plan(base);
  const days = res.days.map((d) => ({ main: d.main, side: d.side, soup: d.soup }));
  days[0].main = 'm_carbonara';
  const re = P.reevaluate(base, days);
  assert.strictEqual(re.days[0].main, 'm_carbonara');
  assert.strictEqual(re.days[0].riceG, 0); // パスタの日はご飯なし
});

test('31日分でも作成できる', () => {
  const res = P.plan(Object.assign({}, base, { days: 31, iterations: 800, restarts: 1 }));
  assert.strictEqual(res.days.length, 31);
});
