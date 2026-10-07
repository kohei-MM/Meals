const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/planner.js');
const RV = require('../js/review.js');

function calendarFromPlan() {
  const res = P.plan({ startDate: '2026-10-05', days: 7, servings: 2, target: { p: 30, f: 22, c: 95 }, seed: 7 });
  const cal = {};
  for (const d of res.days) cal[d.date] = { main: d.main, side: d.side, soup: d.soup, riceG: d.riceG, status: 'done', rating: 0, memo: '', target: res.target };
  return { res, cal };
}

test('週の合計は献立の合計と一致する', () => {
  const { res, cal } = calendarFromPlan();
  const sm = RV.summarizeWeek(cal, '2026-10-05', res.target);
  assert.strictEqual(sm.countedDays, 7);
  for (const k of ['p', 'f', 'c']) assert.ok(Math.abs(sm.total[k] - res.total[k]) < 1e-6);
  assert.ok(sm.comments.length > 0);
});

test('作らなかった日は集計から外す', () => {
  const { res, cal } = calendarFromPlan();
  cal['2026-10-06'].status = 'skipped';
  const sm = RV.summarizeWeek(cal, '2026-10-05', res.target);
  assert.strictEqual(sm.countedDays, 6);
  assert.strictEqual(sm.skippedDays, 1);
});

test('評価の平均と直近の主菜', () => {
  const { cal } = calendarFromPlan();
  const main = cal['2026-10-05'].main;
  cal['2026-10-05'].rating = 5;
  assert.strictEqual(RV.ratingsFromCalendar(cal)[main], 5);
  assert.strictEqual(RV.recentMains(cal, '2026-10-12').length, 7);
});
