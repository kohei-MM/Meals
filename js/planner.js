/*
 * 献立プランナー
 *
 * 期間中の「主菜・副菜・汁物」の組み合わせを焼きなまし法で探索する。
 * 評価関数（小さいほど良い）は次の要素の重み付き和:
 *   - 栄養: 日ごと・期間合計の P/F/C が目標からどれだけずれているか（ご飯の量は日ごとに自動調整）
 *   - 食材の余り: 買い物の頻度に合わせてパック単位で買ったときに残る量・期限切れになる量（傷みやすい食材ほど重い）
 *   - 在庫: 「残っている食材」を使い切れていない量、まったく使っていない食材
 *   - 鮮度: 買ってから保存日数を過ぎた日に使う食材（冷凍できる肉・魚は軽め）
 *   - バリエーション: 同じ料理の繰り返し、同じたんぱく源の連続
 *   - 備考・評価: 優先/控えめ/頻度の指定、過去の★評価、直近に食べた料理
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.MealData;
  const N = isNode ? require('./notes.js') : root.MealNotes;

  const W = {
    nutDay: 30,
    nutTotal: 60,
    waste: 8,
    buyPack: 0.6,
    stockLeft: 10,
    stockUnused: 8,
    fresh: 4,
    repeatMain: 10,
    repeatMainNear: 8,
    repeatSide: 4,
    repeatSoup: 1.5,
    soupNear: 2,
    proteinSeq: 2.5,
    cuisineMismatch: 2,
    prefer: 2.5,
    avoid: 5,
    freq: 4,
    rating: 1.5,
    recent: 2,
  };
  const NUT_W = { p: 1.3, f: 1.0, c: 1.0 };

  function perishWeight(shelf) {
    if (shelf <= 3) return 1.5;
    if (shelf <= 7) return 1.0;
    if (shelf <= 14) return 0.6;
    if (shelf <= 30) return 0.3;
    return 0.1;
  }

  // ---------- 日付ユーティリティ ----------
  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SLOTS = ['main', 'side', 'soup'];

  function kcal(n) { return n.p * 4 + n.f * 9 + n.c * 4; }

  /** 1 日分（1 人あたり）の栄養とご飯の量を決める */
  function dayNutrition(day, target, noRice) {
    const base = { p: 0, f: 0, c: 0 };
    let riceAllowed = !noRice;
    for (const slot of ['main', 'side', 'soup']) {
      const id = day[slot];
      if (!id) continue;
      const r = D.RECIPE_BY_ID[id];
      base.p += r.nut.p; base.f += r.nut.f; base.c += r.nut.c;
      if (r.noRice) riceAllowed = false;
    }
    let best = null;
    const options = riceAllowed ? D.RICE.options : [0];
    for (const g of options) {
      const n = { p: base.p + D.RICE.p * g / 100, f: base.f + D.RICE.f * g / 100, c: base.c + D.RICE.c * g / 100 };
      const err = nutError(n, target);
      // 主食がある日にご飯 0g は不自然なので少しだけペナルティ
      const adj = err + (riceAllowed && g === 0 ? 0.02 : 0);
      if (!best || adj < best.adj) best = { riceG: g, nut: n, err, adj };
    }
    return best;
  }

  function nutError(n, t) {
    let e = 0;
    for (const k of ['p', 'f', 'c']) {
      if (!t[k]) continue;
      const d = (n[k] - t[k]) / t[k];
      e += NUT_W[k] * d * d;
    }
    return e;
  }

  /**
   * 在庫と買い物のシミュレーション
   * usageDays[d][idx] : d 日目に使う量（人数分）
   * 買い物は interval 日ごと（0 日目, interval 日目, ...）。各買い物ではその回の担当期間に足りない分をパック単位で買う。
   * 古いもの（在庫 → 先に買ったもの）から使い、保存期限を過ぎたものは廃棄扱い。
   */
  function simulateInventory(usageDays, ctx, detail) {
    const nDays = usageDays.length;
    const k = ctx.interval;
    const cost = { waste: 0, stock: 0, fresh: 0 };
    const out = detail ? { purchases: [], leftovers: [], expired: [], stockUse: [], lateUse: [] } : null;

    for (let idx = 0; idx < D.INGREDIENTS.length; idx++) {
      const ing = D.INGREDIENTS[idx];
      if (ing.pantry) continue;
      const have = ctx.stockArr[idx];
      let anyUse = false;
      for (let d = 0; d < nDays; d++) if (usageDays[d][idx] > 0) { anyUse = true; break; }
      if (!anyUse && !have) continue;
      const pw = perishWeight(ing.shelf) * (ing.daily ? 0.3 : 1);
      if (!anyUse) {
        cost.stock += W.stockUnused + W.stockLeft * pw;
        if (detail) {
          out.stockUse.push({ id: ing.id, have, used: 0, left: have });
          out.leftovers.push({ id: ing.id, amount: have, source: 'stock' });
        }
        continue;
      }
      const keep = ing.freeze ? Math.max(ing.shelf, 30) : ing.shelf + 2; // 使える上限（冷凍可は 30 日）
      const items = [];
      if (have > 0) items.push({ amt: have, buy: 0, fresh: ing.shelf, hard: keep, stock: true });
      let stockExpired = 0;
      let maxLate = 0;

      for (let d = 0; d < nDays; d++) {
        if (d % k === 0) {
          // この買い物で担当する期間の不足分を計算
          const end = Math.min(nDays, d + k);
          const rem = items.map((it) => it.amt);
          let deficit = 0;
          for (let e = d; e < end; e++) {
            let need = usageDays[e][idx];
            for (let j = 0; j < items.length && need > 1e-9; j++) {
              if (e >= items[j].hard || rem[j] <= 1e-9) continue;
              const take = Math.min(rem[j], need);
              rem[j] -= take; need -= take;
            }
            deficit += need;
          }
          if (deficit > 1e-9) {
            const packs = Math.ceil(deficit / ing.pack - 1e-9);
            items.push({ amt: packs * ing.pack, buy: d, fresh: d + ing.shelf, hard: Math.max(d + keep, end), stock: false });
            cost.waste += W.buyPack * packs;
            if (detail) out.purchases.push({ id: ing.id, day: d, packs, need: deficit });
          }
        }
        // 期限切れの廃棄
        for (const it of items) {
          if (it.amt > 1e-9 && d >= it.hard) {
            cost.waste += W.waste * 1.5 * pw * (it.amt / ing.pack);
            if (it.stock) stockExpired += it.amt;
            if (detail) out.expired.push({ id: ing.id, day: d, amount: it.amt });
            it.amt = 0;
          }
        }
        let need = usageDays[d][idx];
        if (need <= 0) continue;
        for (const it of items) {
          if (need <= 1e-9) break;
          if (it.amt <= 1e-9) continue;
          const take = Math.min(it.amt, need);
          it.amt -= take; need -= take;
          if (d >= it.fresh) {
            const late = d - it.fresh + 1;
            if (late > maxLate) maxLate = late;
            cost.fresh += W.fresh * pw * (ing.freeze ? 0.25 : 1) * late;
            if (detail) out.lateUse.push({ id: ing.id, day: d, buyDay: it.buy, freeze: ing.freeze });
          }
        }
      }
      let leftBuy = 0, leftStock = 0;
      for (const it of items) { if (it.stock) leftStock += it.amt; else leftBuy += it.amt; }
      if (leftBuy > 1e-9) cost.waste += W.waste * pw * (leftBuy / ing.pack);
      if (have > 0) {
        const notUsed = leftStock + stockExpired;
        cost.stock += W.stockLeft * pw * (notUsed / have);
        if (detail) out.stockUse.push({ id: ing.id, have, used: have - notUsed, left: leftStock });
      }
      if (detail) {
        if (leftBuy > 1e-6) out.leftovers.push({ id: ing.id, amount: leftBuy, source: 'buy' });
        if (leftStock > 1e-6) out.leftovers.push({ id: ing.id, amount: leftStock, source: 'stock' });
      }
    }
    return detail ? Object.assign(out, { cost }) : cost;
  }

  /**
   * 献立を評価する。days: [{main, side, soup}]
   * ctx: buildContext の結果
   */
  function evaluate(days, ctx, detail) {
    const { servings, target } = ctx;
    const nIng = D.INGREDIENTS.length;
    const nDays = days.length;
    const usageDays = [];
    const br = { nutrition: 0, waste: 0, stock: 0, fresh: 0, variety: 0, notes: 0 };
    const total = { p: 0, f: 0, c: 0 };
    const dayInfo = [];

    for (let di = 0; di < nDays; di++) {
      const day = days[di];
      const u = new Float64Array(nIng);
      for (const slot of SLOTS) {
        const id = day[slot];
        if (!id) continue;
        for (const [idx, amt] of D.RECIPE_BY_ID[id].ingList) u[idx] += amt * servings;
      }
      usageDays.push(u);
      const dn = cachedDayNutrition(day, ctx);
      dayInfo.push(dn);
      total.p += dn.nut.p; total.f += dn.nut.f; total.c += dn.nut.c;
      br.nutrition += W.nutDay * dn.err;
    }
    br.nutrition += W.nutTotal * nutError(
      { p: total.p / nDays, f: total.f / nDays, c: total.c / nDays }, target);

    const inv = simulateInventory(usageDays, ctx, detail);
    const invCost = detail ? inv.cost : inv;
    br.waste = invCost.waste; br.stock = invCost.stock; br.fresh = invCost.fresh;

    // バリエーション・備考・評価
    const count = { main: {}, side: {}, soup: {} };
    for (let di = 0; di < nDays; di++) {
      const day = days[di];
      const m = D.RECIPE_BY_ID[day.main];
      for (const slot of SLOTS) {
        const id = day[slot];
        if (!id) continue;
        count[slot][id] = (count[slot][id] || 0) + 1;
        br.notes += ctx.noteScore[id] || 0;
      }
      br.notes += W.recent * (ctx.recentCount[day.main] || 0);
      if (di > 0) {
        const prev = days[di - 1];
        if (m.protein === D.RECIPE_BY_ID[prev.main].protein) br.variety += W.proteinSeq;
        if (day.soup && day.soup === prev.soup) br.variety += W.soupNear;
        if (day.side && day.side === prev.side) br.variety += W.repeatSide;
      }
      for (let k = Math.max(0, di - 3); k < di; k++) if (days[k].main === day.main) br.variety += W.repeatMainNear;
      if (day.soup) {
        const sc = D.RECIPE_BY_ID[day.soup].cuisine;
        if (m.cuisine !== sc && (m.cuisine === '洋' || sc === '洋')) br.variety += W.cuisineMismatch;
      }
    }
    // 料理の種類より日数が多い場合の繰り返しは避けられないので、その分は差し引く
    const repeatCost = (counts, nCand, w) => {
      let extra = 0;
      for (const c of Object.values(counts)) extra += c - 1;
      const unavoidable = Math.max(0, nDays - nCand);
      return w * Math.max(0, extra - unavoidable) + w * 0.3 * Math.min(extra, unavoidable);
    };
    br.variety += repeatCost(count.main, ctx.cand.main.length, W.repeatMain);
    br.variety += repeatCost(count.side, ctx.cand.side.length, W.repeatSide);
    br.variety += repeatCost(count.soup, ctx.cand.soup.length, W.repeatSoup);
    for (const fq of ctx.freq) {
      const expected = Math.round((fq.perWeek * nDays) / 7);
      let actual = 0;
      for (const d of days) if (fq.mains.has(d.main)) actual++;
      br.notes += W.freq * Math.abs(actual - expected);
    }

    let score = 0;
    for (const v of Object.values(br)) score += v;
    return { score, breakdown: br, dayInfo, total, inv: detail ? inv : null };
  }

  function cachedDayNutrition(day, ctx) {
    const key = day.main + '|' + day.side + '|' + day.soup;
    let v = ctx.nutCache.get(key);
    if (!v) { v = dayNutrition(day, ctx.target, ctx.notes.noRice); ctx.nutCache.set(key, v); }
    return v;
  }

  /** 入力を正規化して探索用のコンテキストを作る */
  function buildContext(input) {
    const notes = input.notes || N.emptyResult();
    const servings = Math.max(1, Number(input.servings) || 1);
    const target = { p: +input.target.p || 0, f: +input.target.f || 0, c: +input.target.c || 0 };
    const stock = {};
    for (const s of input.stock || []) {
      if (!s || !s.id || !(s.amount > 0)) continue;
      const ing = D.ING_BY_ID[s.id];
      if (!ing || ing.pantry) continue;
      stock[s.id] = (stock[s.id] || 0) + Number(s.amount);
    }
    const warnings = [];
    const allowed = (r) => !notes.exclude.some((t) => N.recipeMatches(r, t));
    const timeOk = (r) => !notes.maxTime || r.time <= notes.maxTime;
    const pick = (slot) => {
      const base = D.RECIPES.filter((r) => r.slot === slot && allowed(r));
      const timed = base.filter(timeOk);
      if (timed.length) return timed;
      if (base.length && notes.maxTime) warnings.push(`${notes.maxTime}分以内の${slotName(slot)}が見つからないため、時間の条件を外しました。`);
      return base;
    };
    const cand = { main: pick('main'), side: notes.noSide ? [] : pick('side'), soup: notes.noSoup ? [] : pick('soup') };
    const recentCount = {};
    for (const id of input.recentMains || []) recentCount[id] = (recentCount[id] || 0) + 1;

    // 料理ごとに一定の「備考・評価」スコアを前計算しておく
    const ratings = input.ratings || {};
    const noteScore = {};
    for (const r of D.RECIPES) {
      const weight = r.slot === 'main' ? 1 : 0.5;
      let v = 0;
      for (const t of notes.prefer) if (N.recipeMatches(r, t)) v -= W.prefer * weight;
      for (const t of notes.avoid) if (N.recipeMatches(r, t)) v += W.avoid * weight;
      if (ratings[r.id] !== undefined) v += W.rating * (3 - ratings[r.id]) * weight;
      if (v) noteScore[r.id] = v;
    }
    const freq = notes.freq.map((fq) => ({
      perWeek: fq.perWeek,
      mains: new Set(cand.main.filter((r) => N.recipeMatches(r, fq.target)).map((r) => r.id)),
    }));
    const stockArr = new Float64Array(D.INGREDIENTS.length);
    for (const [id, amt] of Object.entries(stock)) stockArr[D.ING_BY_ID[id].idx] = amt;
    const interval = Math.max(1, Math.min(31, Number(input.shopInterval) || 7));
    return { servings, target, stock, stockArr, notes, cand, warnings, noteScore, freq, recentCount, interval, nutCache: new Map() };
  }

  function slotName(slot) {
    return { main: '主菜', side: '副菜', soup: '汁物' }[slot];
  }

  /** 焼きなまし法で献立を探索 */
  function optimize(nDays, ctx, opts) {
    const rand = mulberry32(opts.seed || 1);
    const pickFrom = (arr) => arr[Math.floor(rand() * arr.length)].id;
    const slots = SLOTS.filter((s) => ctx.cand[s].length);
    const iterations = opts.iterations || 2500 + 350 * Math.min(nDays, 14);
    const restarts = opts.restarts || 2;
    const locked = opts.locked || [];
    const free = [];
    for (let i = 0; i < nDays; i++) if (!locked[i]) free.push(i);

    let globalBest = null;
    for (let rs = 0; rs < restarts; rs++) {
      const cur = Array.from({ length: nDays }, (_, i) => {
        if (locked[i]) return { main: locked[i].main, side: locked[i].side || null, soup: locked[i].soup || null };
        return {
          main: pickFrom(ctx.cand.main),
          side: ctx.cand.side.length ? pickFrom(ctx.cand.side) : null,
          soup: ctx.cand.soup.length ? pickFrom(ctx.cand.soup) : null,
        };
      });
      let curScore = evaluate(cur, ctx).score;
      let best = cur.map((d) => Object.assign({}, d)), bestScore = curScore;
      if (!free.length) break;
      const T0 = 8, T1 = 0.05;

      for (let it = 0; it < iterations; it++) {
        const T = T0 * Math.pow(T1 / T0, it / iterations);
        let undo;
        if (rand() < 0.2 && free.length > 1) {
          // 2 日を入れ替え（鮮度・買い物タイミングの調整）
          const a = free[Math.floor(rand() * free.length)], b = free[Math.floor(rand() * free.length)];
          if (a === b) continue;
          const tmp = cur[a]; cur[a] = cur[b]; cur[b] = tmp;
          undo = () => { const t2 = cur[a]; cur[a] = cur[b]; cur[b] = t2; };
        } else {
          const di = free[Math.floor(rand() * free.length)];
          const slot = slots[Math.floor(rand() * slots.length)];
          const old = cur[di][slot];
          const nv = pickFrom(ctx.cand[slot]);
          if (nv === old) continue;
          cur[di] = Object.assign({}, cur[di], { [slot]: nv });
          undo = () => { cur[di] = Object.assign({}, cur[di], { [slot]: old }); };
        }
        const sc = evaluate(cur, ctx).score;
        const delta = sc - curScore;
        if (delta <= 0 || rand() < Math.exp(-delta / T)) {
          curScore = sc;
          if (sc < bestScore - 1e-9) { bestScore = sc; best = cur.map((d) => Object.assign({}, d)); }
        } else {
          undo();
        }
      }
      if (!globalBest || bestScore < globalBest.score) globalBest = { days: best, score: bestScore };
    }
    const days = globalBest ? globalBest.days : [];
    return { days, ev: evaluate(days, ctx, true) };
  }

  /** 評価結果から画面表示用の詳細（買い物リスト・余り・在庫消費）を作る */
  function describe(days, ev, ctx, startDate) {
    const n = days.length;
    const outDays = days.map((d, i) => ({
      date: addDays(startDate, i),
      main: d.main, side: d.side || null, soup: d.soup || null,
      riceG: ev.dayInfo[i].riceG,
      nut: Object.assign({}, ev.dayInfo[i].nut, { kcal: kcal(ev.dayInfo[i].nut) }),
    }));
    const inv = ev.inv;
    const warnings = ctx.warnings.slice();
    const info = (id) => D.ING_BY_ID[id];

    // 買い物（回ごと）
    const tripMap = new Map();
    for (const p of inv.purchases) {
      if (!tripMap.has(p.day)) tripMap.set(p.day, []);
      const ing = info(p.id);
      const late = inv.lateUse.filter((l) => l.id === p.id && l.buyDay === p.day);
      let note = '';
      if (late.length) {
        const lastDay = Math.max(...late.map((l) => l.day));
        note = ing.freeze
          ? `${addDays(startDate, lastDay).slice(5).replace('-', '/')}まで使うので、早めに使わない分は冷凍保存`
          : `保存目安(${ing.shelf}日)を過ぎて使う日があります。早めに使ってください`;
      }
      tripMap.get(p.day).push({
        id: p.id, name: ing.name, cat: ing.cat, unit: ing.unit, need: p.need, packs: p.packs,
        packLabel: ing.packLabel, buyAmount: p.packs * ing.pack, note,
      });
    }
    const catIdx = (c) => D.CATEGORY_ORDER.indexOf(c);
    const trips = [...tripMap.entries()].sort((a, b) => a[0] - b[0]).map(([day, items]) => {
      items.sort((a, b) => catIdx(a.cat) - catIdx(b.cat) || a.name.localeCompare(b.name, 'ja'));
      const until = Math.min(n, day + ctx.interval) - 1;
      return { day, date: addDays(startDate, day), coversUntil: addDays(startDate, until), items };
    });

    const decorate = (x) => {
      const ing = info(x.id);
      return Object.assign({ name: ing.name, unit: ing.unit, pack: ing.pack, shelf: ing.shelf, cat: ing.cat }, x);
    };
    // パックの 3% 未満のわずかな残りは表示しない（計算上の端数）
    const leftovers = inv.leftovers.map(decorate).filter((l) => l.amount >= l.pack * 0.03).sort((a, b) => a.shelf - b.shelf);
    const expired = inv.expired.map((x) => Object.assign(decorate(x), { date: addDays(startDate, x.day) }));
    const stockUse = inv.stockUse.map(decorate);
    for (const e of expired) warnings.push(`${e.name} が ${e.date.slice(5).replace('-', '/')} に保存目安を過ぎます（約 ${fmtAmount(e.amount, e.unit)}）。`);

    // 調味料・常備品
    const pantryMap = {};
    for (const d of days) for (const slot of SLOTS) {
      if (!d[slot]) continue;
      for (const [id, amt] of Object.entries(D.RECIPE_BY_ID[d[slot]].ing)) {
        if (info(id).pantry) pantryMap[id] = (pantryMap[id] || 0) + amt * ctx.servings;
      }
    }
    const pantry = Object.entries(pantryMap).map(([id, amount]) => ({ id, name: info(id).name, amount, unit: info(id).unit }))
      .sort((a, b) => b.amount - a.amount);

    const riceTotal = outDays.reduce((s, d) => s + d.riceG, 0) * ctx.servings;
    const total = { p: ev.total.p, f: ev.total.f, c: ev.total.c };
    total.kcal = kcal(total);
    const targetTotal = { p: ctx.target.p * n, f: ctx.target.f * n, c: ctx.target.c * n };
    targetTotal.kcal = kcal(targetTotal);
    return {
      startDate, days: outDays, servings: ctx.servings, target: ctx.target, shopInterval: ctx.interval,
      total, targetTotal, trips, leftovers, expired, stockUse, pantry, riceTotal, warnings,
      score: ev.score, breakdown: ev.breakdown,
    };
  }

  function fmtAmount(amount, unit) {
    const v = unit === 'g' || unit === 'ml' ? Math.round(amount) : Math.round(amount * 10) / 10;
    return `${v}${unit}`;
  }

  /**
   * 献立を作成する
   * input: { startDate, days, servings, target:{p,f,c}, stock:[{id,amount}], notes(parseNotes の結果),
   *          ratings:{recipeId: 平均★}, recentMains:[recipeId], seed, locked:[{main,side,soup}|null] }
   */
  function plan(input) {
    const nDays = Math.max(1, Math.min(31, Number(input.days) || 7));
    const ctx = buildContext(input);
    if (!ctx.cand.main.length) {
      return { error: '条件に合う主菜がありません。備考の「使わない」指定を見直してください。' };
    }
    const { days, ev } = optimize(nDays, ctx, { seed: input.seed, iterations: input.iterations, restarts: input.restarts, locked: input.locked });
    return describe(days, ev, ctx, input.startDate);
  }

  /** 手動で変更した献立を再評価する（ご飯の量・買い物リストを再計算） */
  function reevaluate(input, days) {
    const ctx = buildContext(input);
    const clean = days.map((d) => ({ main: d.main, side: d.side || null, soup: d.soup || null }));
    return describe(clean, evaluate(clean, ctx, true), ctx, input.startDate);
  }

  const api = { plan, reevaluate, evaluate, buildContext, dayNutrition, kcal, addDays, daysBetween, fmtAmount, W };
  if (isNode) module.exports = api;
  else root.MealPlanner = api;
})(typeof self !== 'undefined' ? self : this);
