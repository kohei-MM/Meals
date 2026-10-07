/* 献立計算を UI スレッドから切り離すための Web Worker */
/* global importScripts, MealPlanner */
importScripts('data.js', 'notes.js', 'planner.js');

self.onmessage = (e) => {
  try {
    self.postMessage({ ok: true, result: MealPlanner.plan(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
