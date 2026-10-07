/*
 * 1 週間のレビュー（集計とコメント生成）
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.MealData;
  const P = isNode ? require('./planner.js') : root.MealPlanner;

  const PROTEIN_LABEL = { pork: '豚肉', chicken: '鶏肉', beef: '牛肉', fish: '魚介', soy: '大豆', egg: '卵' };

  /** 1 人分の栄養（保存されているご飯の量を使う） */
  function entryNutrition(e) {
    const n = { p: 0, f: 0, c: 0 };
    let veg = 0;
    for (const slot of ['main', 'side', 'soup']) {
      const r = e[slot] && D.RECIPE_BY_ID[e[slot]];
      if (!r) continue;
      n.p += r.nut.p; n.f += r.nut.f; n.c += r.nut.c;
      for (const [id, amt] of Object.entries(r.ing)) {
        const ing = D.ING_BY_ID[id];
        if (ing.tags.includes('veg') || ing.tags.includes('mushroom')) veg += amt * ing.g;
      }
    }
    const rice = e.riceG || 0;
    n.p += (D.RICE.p * rice) / 100; n.f += (D.RICE.f * rice) / 100; n.c += (D.RICE.c * rice) / 100;
    n.kcal = P.kcal(n);
    return { nut: n, veg };
  }

  /**
   * calendar: { 'YYYY-MM-DD': entry }  entry = { main, side, soup, riceG, status, rating, memo, target }
   * status: 'planned' | 'done' | 'skipped'
   */
  function summarizeWeek(calendar, startDate, fallbackTarget) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = P.addDays(startDate, i);
      const e = calendar[date];
      if (!e || !e.main) { days.push({ date, empty: true }); continue; }
      const { nut, veg } = entryNutrition(e);
      days.push(Object.assign({ date, nut, veg, target: e.target || fallbackTarget }, e));
    }
    const counted = days.filter((d) => !d.empty && d.status !== 'skipped');
    const done = days.filter((d) => !d.empty && d.status === 'done');
    const skipped = days.filter((d) => !d.empty && d.status === 'skipped');
    const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

    const total = { p: sum(counted, (d) => d.nut.p), f: sum(counted, (d) => d.nut.f), c: sum(counted, (d) => d.nut.c) };
    total.kcal = P.kcal(total);
    const targetTotal = { p: sum(counted, (d) => d.target.p), f: sum(counted, (d) => d.target.f), c: sum(counted, (d) => d.target.c) };
    targetTotal.kcal = P.kcal(targetTotal);
    const n = counted.length;
    const avg = n ? { p: total.p / n, f: total.f / n, c: total.c / n, kcal: total.kcal / n } : null;
    const energyRatio = total.kcal > 0
      ? { p: (total.p * 4) / total.kcal, f: (total.f * 9) / total.kcal, c: (total.c * 4) / total.kcal }
      : null;
    const vegAvg = n ? sum(counted, (d) => d.veg) / n : 0;

    const proteins = {};
    for (const d of counted) {
      const pr = D.RECIPE_BY_ID[d.main].protein;
      proteins[pr] = (proteins[pr] || 0) + 1;
    }
    const rated = days.filter((d) => !d.empty && d.rating);
    const ratingAvg = rated.length ? sum(rated, (d) => d.rating) / rated.length : null;
    const best = rated.filter((d) => d.rating >= 4).map((d) => D.RECIPE_BY_ID[d.main].name);
    const worst = rated.filter((d) => d.rating <= 2).map((d) => D.RECIPE_BY_ID[d.main].name);

    const comments = [];
    if (!n) {
      comments.push({ level: 'info', text: 'この週の献立はまだありません。「献立作成」で作成すると、ここに集計が表示されます。' });
    } else {
      const names = { p: 'たんぱく質', f: '脂質', c: '炭水化物' };
      for (const k of ['p', 'f', 'c']) {
        const ratio = total[k] / targetTotal[k];
        const diff = (total[k] - targetTotal[k]) / n;
        if (!isFinite(ratio)) continue;
        if (ratio < 0.9) comments.push({ level: 'warn', text: `${names[k]}が目標の ${Math.round(ratio * 100)}%（1日あたり約 ${Math.abs(diff).toFixed(0)}g 不足）。${advice(k, 'low')}` });
        else if (ratio > 1.1) comments.push({ level: 'warn', text: `${names[k]}が目標の ${Math.round(ratio * 100)}%（1日あたり約 ${diff.toFixed(0)}g 超過）。${advice(k, 'high')}` });
        else comments.push({ level: 'good', text: `${names[k]}は目標の ${Math.round(ratio * 100)}% で、ほぼ目標どおりです。` });
      }
      if (energyRatio) {
        const pct = (x) => Math.round(x * 100);
        const ok = energyRatio.p >= 0.13 && energyRatio.p <= 0.2 && energyRatio.f >= 0.2 && energyRatio.f <= 0.3 && energyRatio.c >= 0.5 && energyRatio.c <= 0.65;
        comments.push({
          level: ok ? 'good' : 'info',
          text: `エネルギー比は P ${pct(energyRatio.p)}% / F ${pct(energyRatio.f)}% / C ${pct(energyRatio.c)}%（食事摂取基準の目安: P 13〜20% / F 20〜30% / C 50〜65%）${ok ? '。バランス良好です。' : '。'}`,
        });
      }
      if (vegAvg < 120) comments.push({ level: 'info', text: `夕食の野菜・きのこは1人あたり平均 ${Math.round(vegAvg)}g。1日350gの目安の1/3（約120g）に少し届いていません。副菜や汁物で野菜を足しましょう。` });
      else comments.push({ level: 'good', text: `夕食の野菜・きのこは1人あたり平均 ${Math.round(vegAvg)}g で、1日350gの目安の1/3以上とれています。` });
      const fish = proteins.fish || 0;
      if (fish < 2 && n >= 5) comments.push({ level: 'info', text: `魚料理は ${fish} 回でした。備考に「魚は週2回」などと書くと次の献立で増やせます。` });
      if (skipped.length) comments.push({ level: 'info', text: `${skipped.length} 日は作らなかった日（外食など）として集計から外しています。` });
      if (best.length) comments.push({ level: 'good', text: `評価が高かった料理: ${[...new Set(best)].join('、')}。次回以降の献立で優先されます。` });
      if (worst.length) comments.push({ level: 'info', text: `評価が低かった料理: ${[...new Set(worst)].join('、')}。次回以降は出にくくなります。` });
    }

    return {
      startDate, days, total, targetTotal, avg, energyRatio, vegAvg, proteins, proteinLabels: PROTEIN_LABEL,
      countedDays: n, doneDays: done.length, skippedDays: skipped.length, ratingAvg, comments,
    };
  }

  function advice(k, dir) {
    const a = {
      p: { low: '鶏むね肉・魚・豆腐などの主菜や、卵・納豆の副菜を増やすと補えます。', high: '主菜の量を少し控えるか、野菜中心の副菜に置き換えましょう。' },
      f: { low: '炒め物やごま和えなど、油を使う料理を少し増やしてもOKです。', high: '揚げ物・バター・マヨネーズを使う料理を減らすか、備考に「揚げ物は控えめ」と書いてください。' },
      c: { low: 'ご飯の量を少し増やすか、いも・かぼちゃの副菜を取り入れましょう。', high: 'ご飯の量を減らすか、麺類・いも類の料理を控えめにしましょう。' },
    };
    return a[k][dir];
  }

  /** 過去の★評価から料理ごとの平均評価を作る（主菜に反映） */
  function ratingsFromCalendar(calendar) {
    const acc = {};
    for (const e of Object.values(calendar)) {
      if (!e || !e.rating || !e.main) continue;
      (acc[e.main] = acc[e.main] || []).push(e.rating);
    }
    const out = {};
    for (const [id, arr] of Object.entries(acc)) out[id] = arr.reduce((a, b) => a + b, 0) / arr.length;
    return out;
  }

  /** 開始日の直前 7 日間に食べた主菜 */
  function recentMains(calendar, startDate) {
    const out = [];
    for (let i = 1; i <= 7; i++) {
      const e = calendar[P.addDays(startDate, -i)];
      if (e && e.main && e.status !== 'skipped') out.push(e.main);
    }
    return out;
  }

  const api = { summarizeWeek, ratingsFromCalendar, recentMains, entryNutrition };
  if (isNode) module.exports = api;
  else root.MealReview = api;
})(typeof self !== 'undefined' ? self : this);
