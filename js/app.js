/* 画面の制御（入力・献立表示・買い物リスト・週間レビュー） */
/* global MealData, MealNotes, MealPlanner, MealReview */
(function () {
  'use strict';
  const D = MealData, N = MealNotes, P = MealPlanner, RV = MealReview;
  const STORE_KEY = 'meals.v1';
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => [...(el || document).querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];

  // ---------------- 保存データ ----------------
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function defaultState() {
    const start = todayStr();
    return {
      settings: {
        startDate: start, endDate: P.addDays(start, 6), servings: 2, shopInterval: 7,
        target: { p: 30, f: 22, c: 95 }, stock: [{ name: '', amount: '' }], notesText: '',
      },
      plan: null,          // { input, result, locks: [bool], seed }
      calendar: {},        // 'YYYY-MM-DD' -> { main, side, soup, riceG, status, rating, memo, target, servings }
      checked: {},         // 買い物リストのチェック
      reviewStart: null,
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* 保存領域が使えない環境でも動くようにする */ }
    return defaultState();
  }
  let state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
  }

  // ---------------- 共通表示 ----------------
  function fmtDate(s, withDow) {
    const [y, m, d] = s.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return withDow ? { md: `${m}/${d}`, dow: DOW[dow], dowIdx: dow } : `${m}/${d}`;
  }
  function fmtDateDow(s) { const f = fmtDate(s, true); return `${f.md}(${f.dow})`; }
  const fmtAmt = (amount, unit) => P.fmtAmount(amount, unit);
  const r0 = (x) => Math.round(x);
  const kcalOf = (n) => n.p * 4 + n.f * 9 + n.c * 4;

  function meter(label, key, value, target, unit) {
    const pct = target > 0 ? value / target : 0;
    const width = Math.min(pct, 1.5) / 1.5 * 100;
    const tpos = (1 / 1.5) * 100;
    const over = pct > 1.1 || pct < 0.9;
    return `<div class="meter" role="img" aria-label="${esc(label)} ${r0(value)}${unit} / 目標 ${r0(target)}${unit}">
      <span class="name">${esc(label)}</span>
      <span class="track"><span class="fill ${key}" style="width:${width}%"></span><span class="target" style="left:calc(${tpos}% - 1px)"></span></span>
      <span class="val ${over ? 'over' : ''}">${r0(value)} / ${r0(target)}${unit}</span>
    </div>`;
  }

  // ---------------- タブ ----------------
  function showTab(id) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.id === id));
    $$('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    if (id === 'tab-review') renderReview();
    if (id === 'tab-shop') renderShop();
    window.scrollTo(0, 0);
  }
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---------------- 条件入力 ----------------
  function initInputs() {
    const s = state.settings;
    $('#in-start').value = s.startDate;
    $('#in-end').value = s.endDate;
    $('#in-servings').value = s.servings;
    $('#in-interval').value = String(s.shopInterval);
    $('#in-p').value = s.target.p; $('#in-f').value = s.target.f; $('#in-c').value = s.target.c;
    $('#in-notes').value = s.notesText;
    $('#ing-names').innerHTML = D.INGREDIENTS.filter((i) => !i.pantry).map((i) => `<option value="${esc(i.name)}">`).join('');
    renderStock(); updateDaysHint(); updateNutHint(); updateNotesParsed();
  }

  function readInputs() {
    const s = state.settings;
    s.startDate = $('#in-start').value || todayStr();
    s.endDate = $('#in-end').value || s.startDate;
    s.servings = Math.max(1, parseInt($('#in-servings').value, 10) || 1);
    s.shopInterval = parseInt($('#in-interval').value, 10) || 7;
    s.target = { p: +$('#in-p').value || 0, f: +$('#in-f').value || 0, c: +$('#in-c').value || 0 };
    s.notesText = $('#in-notes').value;
    save();
  }

  function periodDays() {
    const s = state.settings;
    return P.daysBetween(s.startDate, s.endDate) + 1;
  }
  function updateDaysHint() {
    const n = periodDays();
    const el = $('#in-days-hint');
    if (n < 1) el.textContent = '終了日は開始日以降にしてください。';
    else if (n > 31) el.textContent = `${n}日間：一度に作れるのは31日分までです。`;
    else el.textContent = `${fmtDateDow(state.settings.startDate)} 〜 ${fmtDateDow(state.settings.endDate)} の ${n} 日分`;
  }
  function updateNutHint() {
    const t = state.settings.target;
    const k = kcalOf(t);
    const pct = (x) => (k ? Math.round(x / k * 100) : 0);
    $('#nut-hint').textContent = `約 ${r0(k)} kcal（P ${pct(t.p * 4)}% / F ${pct(t.f * 9)}% / C ${pct(t.c * 4)}%）。ご飯の量は日ごとに自動で調整します。`;
    $$('#nut-presets .chip').forEach((c) => c.classList.toggle('on', c.dataset.preset === `${t.p},${t.f},${t.c}`));
  }
  function updateNotesParsed() {
    const res = N.parseNotes($('#in-notes').value);
    const el = $('#notes-parsed');
    if (!$('#in-notes').value.trim()) { el.innerHTML = '<span class="unk">食材・料理名・ジャンル（和食/洋食/中華）・時間・「〜なし」「〜多め」「週◯回」などを読み取ります。</span>'; return; }
    const tags = res.understood.map((u) => `<span class="tag ${/^(使わない|控えめ|.*なし$)/.test(u) ? 'neg' : ''}">${esc(u)}</span>`).join('');
    const unk = res.unparsed.length ? `<span class="unk">読み取れなかった部分：「${res.unparsed.map(esc).join('」「')}」</span>` : '';
    el.innerHTML = (tags ? `<span class="unk">解釈した内容：</span>${tags}` : '') + unk;
  }

  function renderStock() {
    const list = $('#stock-list');
    if (!state.settings.stock.length) state.settings.stock.push({ name: '', amount: '' });
    list.innerHTML = state.settings.stock.map((s, i) => {
      const ing = D.findIngredient(s.name);
      const match = !s.name ? '' : ing && !ing.pantry
        ? `<span class="match">→ ${esc(ing.name)}（${esc(ing.packLabel)}）</span>`
        : `<span class="match bad">登録されていない食材です（献立には使えません）</span>`;
      return `<div class="stock-row" data-i="${i}">
        <input type="text" list="ing-names" class="st-name" value="${esc(s.name)}" placeholder="例）キャベツ" aria-label="食材名">
        <input type="number" class="st-amt" value="${esc(s.amount)}" min="0" step="any" inputmode="decimal" placeholder="量" aria-label="量">
        <span class="unit">${ing ? esc(ing.unit) : ''}</span>
        <button type="button" class="btn icon ghost st-del" aria-label="削除">✕</button>
        ${match}
      </div>`;
    }).join('');
  }
  $('#stock-list').addEventListener('change', (e) => {
    const row = e.target.closest('.stock-row'); if (!row) return;
    const s = state.settings.stock[+row.dataset.i];
    if (e.target.classList.contains('st-name')) {
      s.name = e.target.value;
      renderStock();
    }
    if (e.target.classList.contains('st-amt')) s.amount = e.target.value;
    save();
  });
  $('#stock-list').addEventListener('click', (e) => {
    if (!e.target.classList.contains('st-del')) return;
    const row = e.target.closest('.stock-row');
    state.settings.stock.splice(+row.dataset.i, 1);
    save(); renderStock();
  });
  $('#stock-add').addEventListener('click', () => {
    state.settings.stock.push({ name: '', amount: '' });
    renderStock();
    const inputs = $$('#stock-list .st-name');
    inputs[inputs.length - 1].focus();
  });

  ['#in-start', '#in-end', '#in-servings', '#in-interval', '#in-p', '#in-f', '#in-c'].forEach((sel) =>
    $(sel).addEventListener('input', () => {
      if (sel === '#in-start') {
        // 開始日を動かしたら期間の長さを保つ
        const n = periodDays();
        readInputs();
        if (n >= 1 && n <= 31) { state.settings.endDate = P.addDays(state.settings.startDate, n - 1); $('#in-end').value = state.settings.endDate; save(); }
      } else readInputs();
      updateDaysHint(); updateNutHint();
    }));
  $('#in-notes').addEventListener('input', () => { readInputs(); updateNotesParsed(); });
  $('#nut-presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const [p, f, c] = b.dataset.preset.split(',').map(Number);
    $('#in-p').value = p; $('#in-f').value = f; $('#in-c').value = c;
    readInputs(); updateNutHint();
  });

  // ---------------- 献立作成 ----------------
  function stockForPlan() {
    return state.settings.stock
      .map((s) => ({ ing: D.findIngredient(s.name), amount: parseFloat(s.amount) }))
      .filter((x) => x.ing && !x.ing.pantry && x.amount > 0)
      .map((x) => ({ id: x.ing.id, amount: x.amount }));
  }

  function buildInput(seed, locked) {
    const s = state.settings;
    return {
      startDate: s.startDate,
      days: periodDays(),
      servings: s.servings,
      shopInterval: s.shopInterval,
      target: s.target,
      stock: stockForPlan(),
      notes: N.parseNotes(s.notesText),
      ratings: RV.ratingsFromCalendar(state.calendar),
      recentMains: RV.recentMains(state.calendar, s.startDate),
      seed,
      locked,
    };
  }

  function runPlanner(input) {
    return new Promise((resolve, reject) => {
      let worker = null;
      try { if (location.protocol !== 'file:' && window.Worker) worker = new Worker('js/worker.js'); } catch (e) { worker = null; }
      if (worker) {
        worker.onmessage = (e) => { worker.terminate(); e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)); };
        worker.onerror = (e) => { worker.terminate(); e.preventDefault(); setTimeout(() => runMain(input).then(resolve, reject), 0); };
        worker.postMessage(input);
      } else {
        runMain(input).then(resolve, reject);
      }
    });
  }
  function runMain(input) {
    // file:// で開いた場合などは画面描画を待ってからメインスレッドで計算
    return new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(P.plan(input)); } catch (e) { reject(e); }
    }, 30));
  }

  async function makePlan(keepLocks) {
    readInputs();
    const n = periodDays();
    if (n < 1 || n > 31) { alert('期間は1〜31日で指定してください。'); return; }
    if (!state.settings.target.p || !state.settings.target.f || !state.settings.target.c) { alert('栄養の目標をすべて入力してください。'); return; }

    let locked = [];
    let locks = [];
    if (keepLocks && state.plan) {
      locks = state.plan.locks.slice();
      locked = state.plan.result.days.map((d, i) => (locks[i] ? { main: d.main, side: d.side, soup: d.soup } : null));
    } else {
      const s = state.settings;
      const recorded = [];
      for (let i = 0; i < n; i++) {
        const e = state.calendar[P.addDays(s.startDate, i)];
        if (e && (e.status === 'done' || e.rating || e.memo)) recorded.push(fmtDate(P.addDays(s.startDate, i)));
      }
      if (recorded.length && !confirm(`${recorded.join('、')} には記録（作った・評価・メモ）があります。献立を作り直すと記録は消えます。続けますか？`)) return;
    }

    const seed = Math.floor(Math.random() * 1e9);
    const input = buildInput(seed, locked);
    $('#busy').hidden = false;
    try {
      const result = await runPlanner(input);
      if (result.error) { alert(result.error); return; }
      if (!locks.length) locks = result.days.map(() => false);
      state.plan = { input: Object.assign({}, input, { locked: undefined }), result, locks };
      state.checked = {};
      writeCalendar(result);
      save();
      renderPlan();
      showTab('tab-plan');
    } catch (err) {
      alert('献立の作成に失敗しました: ' + err.message);
    } finally {
      $('#busy').hidden = true;
    }
  }
  $('#btn-plan').addEventListener('click', () => makePlan(false));
  $('#btn-reroll').addEventListener('click', () => makePlan(true));

  function writeCalendar(result) {
    for (const d of result.days) {
      const prev = state.calendar[d.date];
      const same = prev && prev.main === d.main && prev.side === d.side && prev.soup === d.soup;
      state.calendar[d.date] = {
        main: d.main, side: d.side, soup: d.soup, riceG: d.riceG,
        status: same ? prev.status : 'planned',
        rating: same ? prev.rating : 0,
        memo: same ? prev.memo : '',
        target: result.target, servings: result.servings,
      };
    }
  }

  // ---------------- 献立表示 ----------------
  function optionList(slot, selected, allowNone) {
    const notes = state.plan.input.notes;
    const banned = (r) => notes.exclude.some((t) => N.recipeMatches(r, t));
    const opts = D.RECIPES.filter((r) => r.slot === slot && (!banned(r) || r.id === selected));
    let html = allowNone ? `<option value="">（なし）</option>` : '';
    for (const c of ['和', '洋', '中']) {
      const group = opts.filter((r) => r.cuisine === c);
      if (!group.length) continue;
      html += `<optgroup label="${{ 和: '和食', 洋: '洋食', 中: '中華' }[c]}">` + group.map((r) =>
        `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}（${r.time}分）</option>`).join('') + '</optgroup>';
    }
    return html;
  }

  function renderPlan() {
    const has = !!(state.plan && state.plan.result);
    $('#plan-empty').hidden = has;
    $('#plan-view').hidden = !has;
    if (!has) return;
    const res = state.plan.result;
    const n = res.days.length;

    const buyCount = res.trips.reduce((s, t) => s + t.items.length, 0);
    const leftBuy = res.leftovers.filter((l) => l.source === 'buy' && D.ING_BY_ID[l.id].shelf <= 14);
    const stockHave = res.stockUse.length;
    const stockFull = res.stockUse.filter((s) => s.left <= 1e-6).length;
    $('#plan-summary').innerHTML = `
      <div class="summary-head">
        <span class="period">${fmtDateDow(res.days[0].date)} 〜 ${fmtDateDow(res.days[n - 1].date)}（${n}日・${res.servings}人分）</span>
        <span class="hint">1人あたり・期間合計</span>
      </div>
      ${meter('たんぱく質', 'p', res.total.p, res.targetTotal.p, 'g')}
      ${meter('脂質', 'f', res.total.f, res.targetTotal.f, 'g')}
      ${meter('炭水化物', 'c', res.total.c, res.targetTotal.c, 'g')}
      <div class="kpis">
        <div class="kpi"><div class="v">${r0(res.total.kcal / n)}<small> kcal</small></div><div class="l">1日平均（目標 ${r0(res.targetTotal.kcal / n)}）</div></div>
        <div class="kpi"><div class="v">${buyCount}<small> 品</small></div><div class="l">買う食材（${res.trips.length}回の買い物）</div></div>
        <div class="kpi"><div class="v">${leftBuy.length}<small> 品</small></div><div class="l">傷みやすい食材の余り見込み</div></div>
        <div class="kpi"><div class="v">${stockHave ? `${stockFull}/${stockHave}` : '—'}</div><div class="l">残り食材を使い切り</div></div>
      </div>`;

    const warn = [];
    if (state.plan.input.notes.understood.length) warn.push(`<div class="alert info">備考から反映した条件：${state.plan.input.notes.understood.map(esc).join('／')}</div>`);
    for (const w of res.warnings) warn.push(`<div class="alert warn">${esc(w)}</div>`);
    $('#plan-warnings').innerHTML = warn.join('');

    $('#plan-days').innerHTML = res.days.map((d, i) => {
      const f = fmtDate(d.date, true);
      const t = res.target;
      const noSide = state.plan.input.notes.noSide, noSoup = state.plan.input.notes.noSoup;
      const dishRow = (slot, label, allowNone) => `
        <div class="dish">
          <span class="slot">${label}</span>
          <select data-i="${i}" data-slot="${slot}" aria-label="${fmtDate(d.date)} ${label}">${optionList(slot, d[slot], allowNone)}</select>
          ${d[slot] ? `<button type="button" class="btn ghost info" data-recipe="${d[slot]}" aria-label="材料を見る">材料</button>` : '<span></span>'}
        </div>`;
      const mainR = D.RECIPE_BY_ID[d.main];
      const riceText = mainR.noRice ? '主食：麺・パスタ（ご飯なし）' : d.riceG ? `ご飯 ${d.riceG}g / 人` : 'ご飯なし';
      return `<article class="card day">
        <div class="day-head">
          <span class="date">${f.md}<span class="dow ${f.dowIdx === 0 ? 'sun' : f.dowIdx === 6 ? 'sat' : ''}">(${f.dow})</span></span>
          <button type="button" class="lock ${state.plan.locks[i] ? 'on' : ''}" data-lock="${i}" aria-pressed="${state.plan.locks[i]}" title="この日の献立を固定">${state.plan.locks[i] ? '🔒' : '🔓'}</button>
        </div>
        ${dishRow('main', '主菜', false)}
        ${noSide && !d.side ? '' : dishRow('side', '副菜', true)}
        ${noSoup && !d.soup ? '' : dishRow('soup', '汁物', true)}
        <div class="rice">${riceText} ・ ${r0(d.nut.kcal)} kcal</div>
        ${meter('P', 'p', d.nut.p, t.p, 'g')}
        ${meter('F', 'f', d.nut.f, t.f, 'g')}
        ${meter('C', 'c', d.nut.c, t.c, 'g')}
      </article>`;
    }).join('');
  }

  $('#plan-days').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-slot]'); if (!sel) return;
    const i = +sel.dataset.i;
    const days = state.plan.result.days.map((d) => ({ main: d.main, side: d.side, soup: d.soup }));
    days[i][sel.dataset.slot] = sel.value || null;
    state.plan.result = P.reevaluate(state.plan.input, days);
    state.plan.locks[i] = true; // 手で選んだ日は「別の案」でも残す
    writeCalendar(state.plan.result);
    save();
    renderPlan();
  });
  $('#plan-days').addEventListener('click', (e) => {
    const lock = e.target.closest('[data-lock]');
    if (lock) {
      const i = +lock.dataset.lock;
      state.plan.locks[i] = !state.plan.locks[i];
      save(); renderPlan();
      return;
    }
    const info = e.target.closest('[data-recipe]');
    if (info) openRecipe(info.dataset.recipe);
  });

  function openRecipe(id) {
    const r = D.RECIPE_BY_ID[id];
    const servings = state.plan ? state.plan.result.servings : state.settings.servings;
    const rows = Object.entries(r.ing).map(([iid, amt]) => {
      const ing = D.ING_BY_ID[iid];
      return `<li><span>${esc(ing.name)}</span><span>${fmtAmt(amt * servings, ing.unit)}</span></li>`;
    }).join('');
    $('#recipe-body').innerHTML = `
      <h3>${esc(r.name)}</h3>
      <div class="meta">${{ 和: '和食', 洋: '洋食', 中: '中華' }[r.cuisine]}・約${r.time}分・1人あたり P ${r0(r.nut.p)}g / F ${r0(r.nut.f)}g / C ${r0(r.nut.c)}g（${r0(kcalOf(r.nut))} kcal）</div>
      <p class="hint">材料（${servings}人分）</p>
      <ul class="list-plain">${rows}</ul>`;
    const dlg = $('#recipe-dialog');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  // ---------------- 買い物・食材 ----------------
  function renderShop() {
    const has = !!(state.plan && state.plan.result);
    $('#shop-empty').hidden = has;
    $('#shop-view').hidden = !has;
    if (!has) return;
    const res = state.plan.result;
    const parts = [];

    for (const trip of res.trips) {
      let html = `<div class="card shop-trip"><h3><span>${fmtDateDow(trip.date)} の買い物</span><small>${fmtDate(trip.date)}〜${fmtDate(trip.coversUntil)} の分</small></h3>`;
      let lastCat = null;
      for (const it of trip.items) {
        if (it.cat !== lastCat) { html += `<div class="cat-label">${esc(it.cat)}</div>`; lastCat = it.cat; }
        const key = `${trip.date}:${it.id}`;
        const done = !!state.checked[key];
        html += `<label class="check-item ${done ? 'done' : ''}">
          <input type="checkbox" data-check="${esc(key)}" ${done ? 'checked' : ''}>
          <span><span class="nm">${esc(it.name)}</span>${it.note ? `<span class="note">${esc(it.note)}</span>` : ''}</span>
          <span class="qty">${esc(it.packLabel)} × ${it.packs}<br>使う量 ${fmtAmt(it.need, it.unit)}</span>
        </label>`;
      }
      html += '</div>';
      parts.push(html);
    }
    if (!res.trips.length) parts.push('<div class="card"><p>買い足す食材はありません。残っている食材だけで作れます。</p></div>');

    const rice = res.riceTotal;
    parts.push(`<div class="card"><h2>常備品・調味料</h2>
      <p class="hint">ご飯：期間合計 ${r0(rice)}g（お米 約 ${(rice / 330).toFixed(1)} 合）</p>
      <ul class="pantry">${res.pantry.map((p) => `<li><span>${esc(p.name)}</span><span>${fmtAmt(p.amount, p.unit)}</span></li>`).join('')}</ul>
    </div>`);

    if (res.stockUse.length) {
      parts.push(`<div class="card"><h2>残っている食材の使い切り</h2>
        ${res.stockUse.map((s) => {
          const pct = s.have > 0 ? s.used / s.have : 0;
          return `<div class="meter"><span class="name">${esc(s.name)}</span>
            <span class="track"><span class="fill c" style="width:${Math.min(1, pct) * 100}%"></span></span>
            <span class="val">${fmtAmt(s.used, s.unit)} / ${fmtAmt(s.have, s.unit)}</span></div>`;
        }).join('')}
        <p class="hint">緑のバーが満タンなら使い切りです。</p></div>`);
    }

    const left = res.leftovers.filter((l) => l.amount > 1e-6);
    parts.push(`<div class="card"><h2>期間終了時の残り見込み</h2>
      ${left.length ? `<ul class="list-plain">${left.map((l) => `<li><span>${esc(l.name)}${l.source === 'stock' ? '（もともとの在庫）' : ''}${l.shelf <= 7 ? ' ⚠ 傷みやすい' : ''}</span><span>${fmtAmt(l.amount, l.unit)}</span></li>`).join('')}</ul>
        <p class="hint">次の献立を作るときに「残っている食材」に入れると、優先して使い切ります。</p>
        <button type="button" class="btn ghost" id="btn-carry">残り見込みを「残っている食材」に入れる</button>`
        : '<p>余る食材はありません 🎉</p>'}
    </div>`);
    $('#shop-view').innerHTML = parts.join('');
  }
  $('#shop-view').addEventListener('change', (e) => {
    const key = e.target.dataset && e.target.dataset.check;
    if (!key) return;
    state.checked[key] = e.target.checked;
    e.target.closest('.check-item').classList.toggle('done', e.target.checked);
    save();
  });
  $('#shop-view').addEventListener('click', (e) => {
    if (e.target.id !== 'btn-carry') return;
    const left = state.plan.result.leftovers.filter((l) => l.amount > 1e-6);
    const merged = {};
    for (const l of left) merged[l.name] = (merged[l.name] || 0) + l.amount;
    state.settings.stock = Object.entries(merged).map(([name, amount]) => ({
      name, amount: String(Math.round(amount * 10) / 10),
    }));
    const end = state.plan.result.days[state.plan.result.days.length - 1].date;
    const n = state.plan.result.days.length;
    state.settings.startDate = P.addDays(end, 1);
    state.settings.endDate = P.addDays(end, n);
    save();
    initInputs();
    showTab('tab-input');
  });

  // ---------------- レビュー ----------------
  function mondayOf(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return P.addDays(dateStr, -((dow + 6) % 7));
  }
  function reviewStart() {
    if (!state.reviewStart) {
      state.reviewStart = state.plan ? state.plan.result.days[0].date : mondayOf(todayStr());
    }
    return state.reviewStart;
  }
  $('#wk-prev').addEventListener('click', () => { state.reviewStart = P.addDays(reviewStart(), -7); save(); renderReview(); });
  $('#wk-next').addEventListener('click', () => { state.reviewStart = P.addDays(reviewStart(), 7); save(); renderReview(); });
  $('#wk-start').addEventListener('change', (e) => { if (e.target.value) { state.reviewStart = e.target.value; save(); renderReview(); } });

  function renderReview() {
    const start = reviewStart();
    $('#wk-start').value = start;
    const sm = RV.summarizeWeek(state.calendar, start, state.settings.target);
    const parts = [];
    const n = sm.countedDays;

    parts.push(`<div class="card">
      <h2>${fmtDateDow(start)} 〜 ${fmtDateDow(P.addDays(start, 6))} のまとめ</h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${sm.doneDays}<small> / ${sm.days.filter((d) => !d.empty).length} 日</small></div><div class="l">作った日</div></div>
        <div class="kpi"><div class="v">${sm.ratingAvg ? sm.ratingAvg.toFixed(1) : '—'}<small> ★</small></div><div class="l">平均評価</div></div>
        <div class="kpi"><div class="v">${sm.avg ? r0(sm.avg.kcal) : '—'}<small> kcal</small></div><div class="l">1日平均（1人）</div></div>
        <div class="kpi"><div class="v">${n ? r0(sm.vegAvg) : '—'}<small> g</small></div><div class="l">野菜・きのこ 1日平均</div></div>
      </div>
      ${n ? `<h3>週の合計（1人あたり・${n}日分）</h3>
        ${meter('たんぱく質', 'p', sm.total.p, sm.targetTotal.p, 'g')}
        ${meter('脂質', 'f', sm.total.f, sm.targetTotal.f, 'g')}
        ${meter('炭水化物', 'c', sm.total.c, sm.targetTotal.c, 'g')}
        ${meter('エネルギー', 'c', sm.total.kcal, sm.targetTotal.kcal, 'kcal')}` : ''}
    </div>`);

    if (n) parts.push(`<div class="card"><h2>日ごとのエネルギー（P/F/C 内訳）</h2>${chartHtml(sm)}</div>`);

    parts.push(`<div class="card"><h2>振り返り</h2>${sm.comments.map((c) => `<div class="alert ${c.level}">${esc(c.text)}</div>`).join('')}
      ${n ? `<p class="hint">主なたんぱく源：${Object.entries(sm.proteins).map(([k, v]) => `${sm.proteinLabels[k] || k} ${v}回`).join('・')}</p>` : ''}</div>`);

    const rows = sm.days.map((d) => {
      const f = fmtDateDow(d.date);
      if (d.empty) return `<div class="rv-day"><div class="rv-top"><strong>${f}</strong><span class="hint">献立なし</span></div></div>`;
      const names = ['main', 'side', 'soup'].filter((s) => d[s]).map((s) => D.RECIPE_BY_ID[d[s]].name).join(' / ');
      const st = d.status || 'planned';
      return `<div class="rv-day" data-date="${d.date}">
        <div class="rv-top"><strong>${f}</strong>
          <span class="seg" role="group" aria-label="${f} の状況">
            <button type="button" data-status="planned" class="${st === 'planned' ? 'on' : ''}">予定</button>
            <button type="button" data-status="done" class="${st === 'done' ? 'on' : ''}">作った</button>
            <button type="button" data-status="skipped" class="${st === 'skipped' ? 'on' : ''}">作らなかった</button>
          </span>
        </div>
        <div class="menu">${esc(names)}</div>
        <span class="stars" role="group" aria-label="評価">${[1, 2, 3, 4, 5].map((k) => `<button type="button" data-star="${k}" class="${(d.rating || 0) >= k ? 'on' : ''}" aria-label="★${k}">★</button>`).join('')}</span>
        <input type="text" class="memo" data-memo placeholder="メモ（味の感想・量・家族の反応など）" value="${esc(d.memo || '')}">
      </div>`;
    }).join('');
    parts.push(`<div class="card"><h2>日ごとの記録</h2><p class="hint">「作った」「★評価」を記録すると、評価の高い料理が次の献立で出やすくなります。</p>${rows}</div>`);
    $('#review-view').innerHTML = parts.join('');
  }

  $('#review-view').addEventListener('click', (e) => {
    const day = e.target.closest('.rv-day[data-date]'); if (!day) return;
    const entry = state.calendar[day.dataset.date]; if (!entry) return;
    const st = e.target.closest('[data-status]');
    const star = e.target.closest('[data-star]');
    if (st) entry.status = st.dataset.status;
    else if (star) { const v = +star.dataset.star; entry.rating = entry.rating === v ? 0 : v; if (entry.status === 'planned') entry.status = 'done'; }
    else return;
    save(); renderReview();
  });
  $('#review-view').addEventListener('change', (e) => {
    if (!e.target.matches('[data-memo]')) return;
    const day = e.target.closest('.rv-day[data-date]');
    state.calendar[day.dataset.date].memo = e.target.value;
    save();
  });

  // 積み上げ棒グラフ（日ごとの kcal を P/F/C に分解）
  function chartHtml(sm) {
    const W = 360, H = 210, padL = 34, padR = 4, padT = 10, padB = 24;
    const days = sm.days;
    const values = days.map((d) => (d.empty || d.status === 'skipped' ? null : { p: d.nut.p * 4, f: d.nut.f * 9, c: d.nut.c * 4, d }));
    const targetK = kcalOf(sm.days.find((d) => !d.empty).target);
    const maxV = Math.max(targetK, ...values.filter(Boolean).map((v) => v.p + v.f + v.c)) * 1.1;
    const niceStep = maxV > 1200 ? 400 : 200;
    const yMax = Math.ceil(maxV / niceStep) * niceStep;
    const y = (v) => padT + (H - padT - padB) * (1 - v / yMax);
    const band = (W - padL - padR) / 7;
    const bw = Math.min(28, band * 0.6);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="日ごとのエネルギーと目標">`;
    for (let v = 0; v <= yMax; v += niceStep) {
      svg += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    values.forEach((v, i) => {
      const cx = padL + band * i + band / 2;
      const x = cx - bw / 2;
      const f = fmtDate(days[i].date, true);
      svg += `<text class="axis" x="${cx}" y="${H - 8}" text-anchor="middle">${f.md}</text>`;
      if (!v) { svg += `<text class="axis" x="${cx}" y="${y(0) - 6}" text-anchor="middle">—</text>`; return; }
      let base = 0;
      const segs = [['c', v.c], ['p', v.p], ['f', v.f]];
      segs.forEach(([k, val], si) => {
        const top = si === segs.length - 1;
        const y1 = y(base + val), y0 = y(base);
        const gap = si > 0 ? 2 : 0; // 区切りの 2px の隙間
        const h = Math.max(0, y0 - y1 - gap);
        if (top) {
          const r = Math.min(4, h, bw / 2);
          svg += `<path class="seg-${k}" d="M${x},${y0 - gap} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0 - gap} Z"/>`;
        } else {
          svg += `<rect class="seg-${k}" x="${x}" y="${y1}" width="${bw}" height="${h}"/>`;
        }
        base += val;
      });
      svg += `<rect class="hit" tabindex="0" data-tip="${i}" x="${padL + band * i}" y="${padT}" width="${band}" height="${H - padT - padB}"/>`;
    });
    svg += `<line class="targetline" x1="${padL}" x2="${W - padR}" y1="${y(targetK)}" y2="${y(targetK)}"/>`;
    svg += '</svg>';

    const legend = `<div class="legend"><span><i class="c"></i>炭水化物</span><span><i class="p"></i>たんぱく質</span><span><i class="f"></i>脂質</span><span><i class="t"></i>目標 ${r0(targetK)} kcal</span></div>`;
    const table = `<details><summary class="hint">表で見る</summary><div class="table-scroll"><table class="data">
      <thead><tr><th>日付</th><th>P (g)</th><th>F (g)</th><th>C (g)</th><th>kcal</th></tr></thead><tbody>
      ${days.map((d) => d.empty || d.status === 'skipped'
        ? `<tr><td>${fmtDateDow(d.date)}</td><td colspan="4">${d.empty ? '献立なし' : '作らなかった'}</td></tr>`
        : `<tr><td>${fmtDateDow(d.date)}</td><td>${r0(d.nut.p)}</td><td>${r0(d.nut.f)}</td><td>${r0(d.nut.c)}</td><td>${r0(d.nut.kcal)}</td></tr>`).join('')}
      </tbody></table></div></details>`;
    chartData = values;
    return legend + `<div class="chart-wrap">${svg}</div>` + table;
  }
  let chartData = [];
  function showTip(i, x, yPos) {
    const v = chartData[i]; if (!v) return;
    const d = v.d;
    const tip = $('#tooltip');
    tip.innerHTML = `<strong>${fmtDateDow(d.date)}</strong> ${r0(d.nut.kcal)} kcal<br>
      <div class="tt-row"><span><i style="background:var(--series-p)"></i>たんぱく質</span><span>${r0(d.nut.p)}g</span></div>
      <div class="tt-row"><span><i style="background:var(--series-f)"></i>脂質</span><span>${r0(d.nut.f)}g</span></div>
      <div class="tt-row"><span><i style="background:var(--series-c)"></i>炭水化物</span><span>${r0(d.nut.c)}g</span></div>
      <div class="hint" style="margin:4px 0 0">${esc(D.RECIPE_BY_ID[d.main].name)}</div>`;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + 'px';
    tip.style.top = Math.max(8, yPos - h - 12) + 'px';
  }
  const hideTip = () => { $('#tooltip').hidden = true; };
  $('#review-view').addEventListener('pointermove', (e) => {
    const hit = e.target.closest('[data-tip]');
    if (hit) showTip(+hit.dataset.tip, e.clientX, e.clientY); else hideTip();
  });
  $('#review-view').addEventListener('pointerleave', hideTip);
  $('#review-view').addEventListener('focusin', (e) => {
    const hit = e.target.closest('[data-tip]'); if (!hit) return;
    const r = hit.getBoundingClientRect();
    showTip(+hit.dataset.tip, r.left + r.width / 2, r.top + 20);
  });
  $('#review-view').addEventListener('focusout', hideTip);

  // ---------------- データ管理 ----------------
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `meals-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#btn-import').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('形式が正しくありません');
      state = Object.assign(defaultState(), data);
      save(); initInputs(); renderPlan(); alert('読み込みました。');
    } catch (err) { alert('読み込めませんでした: ' + err.message); }
    e.target.value = '';
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('献立・記録・設定をすべて削除します。よろしいですか？')) return;
    state = defaultState(); save(); initInputs(); renderPlan();
  });

  // ---------------- 起動 ----------------
  initInputs();
  renderPlan();
  if (state.plan) showTab('tab-plan');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
