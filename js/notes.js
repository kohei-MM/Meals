/*
 * 備考欄（自由記述）の解釈
 *
 * 文を「、。,改行」や「けど・ただし」などで区切り、各区切りの中から
 *   ・対象（食材 / 食材カテゴリ / 料理名 / 料理ジャンル / 汁物・副菜・ご飯）
 *   ・意図（除外 / 控えめ / 優先）
 * を読み取る。解釈できた内容は画面に表示し、ユーザーが確認できるようにする。
 */
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.MealData;

  // 対象となる語 → マッチ対象
  const CATEGORY_TERMS = [
    [['魚介', '魚', 'さかな', '魚料理'], { kind: 'itag', tag: 'fish', label: '魚' }],
    [['肉料理', '肉類', 'お肉', '肉'], { kind: 'itag', tag: 'meat', label: '肉' }],
    [['豚肉', 'ぶた肉', '豚', 'ポーク'], { kind: 'itag', tag: 'pork', label: '豚肉' }],
    [['鶏肉', 'とり肉', '鳥肉', '鶏', 'チキン'], { kind: 'itag', tag: 'chicken', label: '鶏肉' }],
    [['牛肉', '牛', 'ビーフ'], { kind: 'itag', tag: 'beef', label: '牛肉' }],
    [['卵', 'たまご', 'タマゴ', '玉子'], { kind: 'itag', tag: 'egg', label: '卵（マヨネーズ含む）' }],
    [['乳製品', '乳'], { kind: 'itag', tag: 'dairy', label: '乳製品' }],
    [['きのこ', 'キノコ'], { kind: 'itag', tag: 'mushroom', label: 'きのこ' }],
    [['甲殻類', 'えび', 'エビ', '海老'], { kind: 'itag', tag: 'shellfish', label: 'えび・甲殻類' }],
    [['小麦'], { kind: 'itag', tag: 'wheat', label: '小麦' }],
    [['大豆製品', '大豆'], { kind: 'itag', tag: 'soy', label: '大豆製品' }],
    [['野菜'], { kind: 'itag', tag: 'veg', label: '野菜' }],
    [['葉物', '緑黄色野菜', '青菜'], { kind: 'itag', tag: 'greens', label: '葉物野菜' }],
    [['辛いもの', '辛い料理', '辛いの', '辛い', '激辛', '辛め'], { kind: 'rtag', tag: 'spicy', label: '辛い料理' }],
    [['揚げ物', '揚げもの', 'フライ'], { kind: 'rtag', tag: 'fried', label: '揚げ物' }],
    [['麺類', '麺'], { kind: 'rtag', tag: '麺', label: '麺類' }],
    [['丼もの', '丼物', '丼'], { kind: 'rtag', tag: '丼', label: '丼もの' }],
    [['煮物', '煮込み'], { kind: 'rtag', tag: '煮物', label: '煮物' }],
    [['鍋'], { kind: 'rtag', tag: '鍋', label: '鍋' }],
    [['ヘルシー', 'あっさり', '低脂肪'], { kind: 'rtag', tag: 'healthy', label: 'ヘルシーな料理' }],
    [['和食', '和風'], { kind: 'cuisine', v: '和', label: '和食' }],
    [['洋食', '洋風'], { kind: 'cuisine', v: '洋', label: '洋食' }],
    [['中華'], { kind: 'cuisine', v: '中', label: '中華' }],
    [['汁物', '味噌汁', 'みそ汁', 'スープ'], { kind: 'slot', slot: 'soup', label: '汁物' }],
    [['副菜'], { kind: 'slot', slot: 'side', label: '副菜' }],
    [['ご飯', 'ごはん', '白米', 'お米', 'ライス'], { kind: 'slot', slot: 'rice', label: 'ご飯' }],
  ];

  const RECIPE_KEYWORDS = {
    m_curry: ['カレー'], m_karaage: ['唐揚げ', 'からあげ', '唐揚'], m_shogayaki: ['生姜焼き', 'しょうが焼き'],
    m_mabo: ['麻婆', 'マーボー'], m_hamburg: ['ハンバーグ'], m_ebichili: ['エビチリ', 'えびチリ'],
    m_nikujaga: ['肉じゃが'], m_gyudon: ['牛丼'], m_oyakodon: ['親子丼'], m_carbonara: ['カルボナーラ'],
    m_yakisoba: ['焼きそば', 'やきそば'], m_yakiudon: ['焼うどん', '焼きうどん'], m_sabamiso: ['さば味噌', 'サバ味噌', '鯖味噌', 'さばの味噌煮'],
    m_buridaikon: ['ぶり大根'], m_hoikoro: ['回鍋肉', 'ホイコーロー'], m_chinjao: ['チンジャオ', '青椒肉絲'],
    m_butakimchi: ['豚キムチ'], m_teriyaki: ['照り焼き'], m_meuniere: ['ムニエル'], m_millefeuille: ['ミルフィーユ'],
  };

  const HARD_NEG = /(アレルギー|あれるぎー|なし|無し|抜き|ぬき|禁止|ng|ダメ|だめ|食べられない|たべられない|食べない|使わない|使用しない|入れない|除外|いらない|不要|やめ|嫌い|きらい|苦手|にがて|ないで|控えたい|避けたい|避けて|さけて)/;
  const SOFT_NEG = /(控えめ|ひかえめ|少なめ|すくなめ|減らし|へらし|控え|あまり)/;
  const POS = /(多め|おおめ|多く|増やし|ふやし|中心|好き|すき|食べたい|たべたい|入れて|使って|使いたい|メイン|優先|欲しい|ほしい|積極|しっかり)/;
  const QUICK = /(時短|簡単|かんたん|手軽|てがる|忙しい|いそがしい|パパッと|ぱぱっと|すぐ)/;

  function toHalfWidth(s) {
    return s.replace(/[０-９ａ-ｚＡ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  }

  function buildTerms() {
    const terms = [];
    for (const [words, target] of CATEGORY_TERMS) for (const w of words) terms.push({ w, target });
    for (const [rid, words] of Object.entries(RECIPE_KEYWORDS)) {
      const r = D.RECIPE_BY_ID[rid];
      for (const w of words) terms.push({ w, target: { kind: 'recipe', id: rid, label: r.name } });
    }
    for (const ing of D.INGREDIENTS) {
      if (ing.id === 'stock') continue;
      for (const w of [ing.name, ...ing.aliases]) {
        if (w.length < 2) continue;
        terms.push({ w, target: { kind: 'ing', id: ing.id, label: ing.name } });
      }
    }
    // 長い語を優先してマッチさせる
    terms.sort((a, b) => b.w.length - a.w.length);
    return terms;
  }
  let TERMS = null;

  function findTargets(clause) {
    TERMS = TERMS || buildTerms();
    const used = new Array(clause.length).fill(false);
    const found = [];
    for (const t of TERMS) {
      let from = 0;
      for (;;) {
        const i = clause.indexOf(t.w, from);
        if (i < 0) break;
        from = i + 1;
        let overlap = false;
        for (let k = i; k < i + t.w.length; k++) if (used[k]) overlap = true;
        if (overlap) continue;
        for (let k = i; k < i + t.w.length; k++) used[k] = true;
        found.push({ pos: i, target: t.target });
      }
    }
    found.sort((a, b) => a.pos - b.pos);
    return found.map((f) => f.target);
  }

  function emptyResult() {
    return {
      exclude: [],      // 使わない（ハード制約）
      avoid: [],        // 控えめ（ペナルティ）
      prefer: [],       // 優先（ボーナス）
      freq: [],         // { target, perWeek }
      maxTime: null,
      noSoup: false,
      noSide: false,
      noRice: false,
      understood: [],   // 画面表示用
      unparsed: [],
    };
  }

  function parseNotes(text) {
    const res = emptyResult();
    if (!text || !text.trim()) return res;
    const src = toHalfWidth(text);
    const clauses = src
      .split(/[、。,，.\n!！?？・;；]|けど|けれど|だけど|ただし|でも|but/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      let handled = false;
      const lower = clause.toLowerCase();

      // 調理時間
      const tm = lower.match(/(\d+)\s*分/);
      if (tm && /(以内|まで|以下|で作|程度|くらい|ぐらい|未満|内)/.test(lower)) {
        res.maxTime = res.maxTime ? Math.min(res.maxTime, +tm[1]) : +tm[1];
        res.understood.push(`主菜・副菜は調理時間 ${tm[1]} 分以内`);
        handled = true;
      } else if (QUICK.test(clause)) {
        res.maxTime = res.maxTime ? Math.min(res.maxTime, 20) : 20;
        res.understood.push('時短：主菜・副菜は調理時間 20 分以内');
        handled = true;
      }

      const targets = findTargets(clause);
      if (targets.length) {
        const weekly = lower.match(/週\s*(\d+)\s*(回|日|食)/);
        let intent = null;
        if (HARD_NEG.test(lower)) intent = 'exclude';
        else if (SOFT_NEG.test(lower)) intent = 'avoid';
        else if (weekly) intent = 'freq';
        else if (POS.test(lower)) intent = 'prefer';
        else if (targets.every((t) => t.kind === 'cuisine' || t.kind === 'recipe')) intent = 'prefer';

        for (const t of targets) {
          if (intent === 'exclude') {
            if (t.kind === 'slot') {
              if (t.slot === 'soup') res.noSoup = true;
              if (t.slot === 'side') res.noSide = true;
              if (t.slot === 'rice') res.noRice = true;
              res.understood.push(`${t.label}なし`);
            } else {
              res.exclude.push(t);
              res.understood.push(`使わない：${t.label}`);
            }
            handled = true;
          } else if (intent === 'avoid' && t.kind !== 'slot') {
            res.avoid.push(t);
            res.understood.push(`控えめ：${t.label}`);
            handled = true;
          } else if (intent === 'freq' && t.kind !== 'slot') {
            res.freq.push({ target: t, perWeek: +weekly[1] });
            res.understood.push(`${t.label}：週 ${weekly[1]} 回程度`);
            handled = true;
          } else if (intent === 'prefer' && t.kind !== 'slot') {
            res.prefer.push(t);
            res.understood.push(`優先：${t.label}`);
            handled = true;
          }
        }
      }
      if (!handled) res.unparsed.push(clause);
    }
    res.understood = [...new Set(res.understood)];
    return res;
  }

  /** レシピが対象にマッチするか */
  function recipeMatches(recipe, t) {
    switch (t.kind) {
      case 'ing':
        return Object.prototype.hasOwnProperty.call(recipe.ing, t.id);
      case 'itag':
        if (recipe.protein === t.tag) return true;
        return Object.keys(recipe.ing).some((id) => (D.ING_BY_ID[id].tags || []).includes(t.tag));
      case 'rtag':
        if (recipe.tags.includes(t.tag)) return true;
        return Object.keys(recipe.ing).some((id) => (D.ING_BY_ID[id].tags || []).includes(t.tag));
      case 'cuisine':
        return recipe.cuisine === t.v;
      case 'recipe':
        return recipe.id === t.id;
      default:
        return false;
    }
  }

  const api = { parseNotes, recipeMatches, emptyResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MealNotes = api;
})(typeof self !== 'undefined' ? self : this);
