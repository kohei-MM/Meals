/*
 * 食材・レシピデータ
 *
 * 栄養値は「日本食品標準成分表（八訂）」を参考にした 100g あたりの概算値です。
 *   p: たんぱく質(g) f: 脂質(g) c: 炭水化物(g)
 * unit  : 在庫入力・レシピ分量の単位
 * g     : 1 unit あたりのグラム数（unit が g/ml の場合は 1）
 * pack  : 店で買うときの 1 パックの量（unit 単位）
 * packLabel : 買い物リストでの表示
 * shelf : 冷蔵での目安保存日数（買った日を 0 日目として）
 * pantry: 調味料など。買い物リストの「余り」計算対象外
 */
(function (root) {
  'use strict';

  const CATEGORY_ORDER = ['肉', '魚介', '卵・大豆製品', '野菜', 'きのこ', '乳製品', '主食・麺', '缶詰・加工品', '調味料・乾物'];

  const INGREDIENTS = [
    // ---- 肉 ----
    { id: 'pork_koma', name: '豚こま切れ肉', aliases: ['豚こま', '豚肉', '豚小間', 'ぶた肉'], cat: '肉', unit: 'g', g: 1, pack: 300, packLabel: '300gパック', shelf: 3, p: 18.0, f: 15.0, c: 0.2, tags: ['pork', 'meat'] },
    { id: 'pork_loin', name: '豚ロース薄切り肉', aliases: ['豚ロース', '豚しゃぶ', '豚薄切り'], cat: '肉', unit: 'g', g: 1, pack: 200, packLabel: '200gパック', shelf: 3, p: 19.3, f: 19.2, c: 0.2, tags: ['pork', 'meat'] },
    { id: 'pork_mince', name: '豚ひき肉', aliases: ['豚ミンチ'], cat: '肉', unit: 'g', g: 1, pack: 200, packLabel: '200gパック', shelf: 2, p: 17.7, f: 17.2, c: 0.1, tags: ['pork', 'meat', 'mince'] },
    { id: 'chicken_thigh', name: '鶏もも肉', aliases: ['鶏もも', 'とりもも', '鶏肉', 'とり肉', '鳥もも'], cat: '肉', unit: 'g', g: 1, pack: 300, packLabel: '1枚(約300g)', shelf: 2, p: 16.6, f: 14.2, c: 0.0, tags: ['chicken', 'meat'] },
    { id: 'chicken_breast', name: '鶏むね肉', aliases: ['鶏むね', 'とりむね', '鶏胸肉', '鳥むね'], cat: '肉', unit: 'g', g: 1, pack: 300, packLabel: '1枚(約300g)', shelf: 2, p: 21.3, f: 5.9, c: 0.1, tags: ['chicken', 'meat'] },
    { id: 'chicken_mince', name: '鶏ひき肉', aliases: ['鶏ミンチ', 'とりひき肉'], cat: '肉', unit: 'g', g: 1, pack: 200, packLabel: '200gパック', shelf: 2, p: 17.5, f: 12.0, c: 0.0, tags: ['chicken', 'meat', 'mince'] },
    { id: 'beef_koma', name: '牛こま切れ肉', aliases: ['牛こま', '牛肉', '牛小間'], cat: '肉', unit: 'g', g: 1, pack: 200, packLabel: '200gパック', shelf: 3, p: 17.0, f: 22.0, c: 0.3, tags: ['beef', 'meat'] },
    { id: 'mixed_mince', name: '合いびき肉', aliases: ['合挽き肉', 'あいびき肉', '合い挽き'], cat: '肉', unit: 'g', g: 1, pack: 300, packLabel: '300gパック', shelf: 2, p: 17.3, f: 21.0, c: 0.2, tags: ['beef', 'pork', 'meat', 'mince'] },
    { id: 'bacon', name: 'ベーコン', aliases: [], cat: '肉', unit: 'g', g: 1, pack: 70, packLabel: '70gパック', shelf: 10, p: 12.9, f: 39.1, c: 0.3, tags: ['pork', 'meat', 'processed'] },

    // ---- 魚介 ----
    { id: 'salmon', name: '生鮭(切り身)', aliases: ['鮭', 'さけ', 'サーモン', '生鮭', 'しゃけ'], cat: '魚介', unit: '切れ', g: 80, pack: 2, packLabel: '2切れパック', shelf: 2, p: 22.3, f: 4.1, c: 0.1, tags: ['fish'] },
    { id: 'mackerel', name: 'さば(切り身)', aliases: ['さば', 'サバ', '鯖'], cat: '魚介', unit: '切れ', g: 80, pack: 2, packLabel: '2切れパック', shelf: 2, p: 20.6, f: 16.8, c: 0.3, tags: ['fish'] },
    { id: 'yellowtail', name: 'ぶり(切り身)', aliases: ['ぶり', 'ブリ', '鰤'], cat: '魚介', unit: '切れ', g: 80, pack: 2, packLabel: '2切れパック', shelf: 2, p: 21.4, f: 17.6, c: 0.3, tags: ['fish'] },
    { id: 'cod', name: 'たら(切り身)', aliases: ['たら', 'タラ', '鱈'], cat: '魚介', unit: '切れ', g: 80, pack: 2, packLabel: '2切れパック', shelf: 2, p: 17.6, f: 0.2, c: 0.1, tags: ['fish'] },
    { id: 'shrimp', name: '冷凍むきえび', aliases: ['えび', 'エビ', '海老', 'むきえび'], cat: '魚介', unit: 'g', g: 1, pack: 200, packLabel: '200g袋(冷凍)', shelf: 30, p: 19.6, f: 0.6, c: 0.3, tags: ['fish', 'shellfish'] },

    // ---- 卵・大豆製品 ----
    { id: 'egg', name: '卵', aliases: ['たまご', 'タマゴ', '玉子', '鶏卵'], cat: '卵・大豆製品', unit: '個', g: 50, pack: 10, packLabel: '10個パック', shelf: 14, p: 12.2, f: 10.2, c: 0.4, tags: ['egg'] },
    { id: 'tofu', name: '木綿豆腐', aliases: ['豆腐', 'とうふ', 'もめん豆腐'], cat: '卵・大豆製品', unit: '丁', g: 300, pack: 1, packLabel: '1丁(300g)', shelf: 4, p: 7.0, f: 4.9, c: 1.5, tags: ['soy'] },
    { id: 'natto', name: '納豆', aliases: ['なっとう'], cat: '卵・大豆製品', unit: 'パック', g: 45, pack: 3, packLabel: '3パック', shelf: 7, p: 16.5, f: 10.0, c: 12.1, tags: ['soy'] },
    { id: 'atsuage', name: '厚揚げ', aliases: ['あつあげ', '生揚げ'], cat: '卵・大豆製品', unit: '枚', g: 150, pack: 2, packLabel: '2枚パック', shelf: 4, p: 10.7, f: 11.3, c: 0.9, tags: ['soy'] },
    { id: 'aburaage', name: '油揚げ', aliases: ['あぶらあげ', 'あげ'], cat: '卵・大豆製品', unit: '枚', g: 30, pack: 2, packLabel: '2枚パック', shelf: 4, p: 23.4, f: 34.4, c: 0.4, tags: ['soy'] },

    // ---- 野菜 ----
    { id: 'cabbage', name: 'キャベツ', aliases: ['きゃべつ'], cat: '野菜', unit: 'g', g: 1, pack: 500, packLabel: '1/2玉(約500g)', shelf: 10, p: 1.3, f: 0.2, c: 5.2, tags: ['veg'] },
    { id: 'onion', name: '玉ねぎ', aliases: ['たまねぎ', 'タマネギ', '玉葱'], cat: '野菜', unit: '個', g: 200, pack: 3, packLabel: '3個袋', shelf: 30, p: 1.0, f: 0.1, c: 8.4, tags: ['veg'] },
    { id: 'carrot', name: 'にんじん', aliases: ['人参', 'ニンジン'], cat: '野菜', unit: '本', g: 150, pack: 3, packLabel: '3本袋', shelf: 14, p: 0.7, f: 0.1, c: 8.7, tags: ['veg'] },
    { id: 'potato', name: 'じゃがいも', aliases: ['ジャガイモ', 'じゃが芋', 'ポテト'], cat: '野菜', unit: '個', g: 150, pack: 4, packLabel: '4個袋', shelf: 30, p: 1.8, f: 0.1, c: 17.3, tags: ['veg'] },
    { id: 'spinach', name: 'ほうれん草', aliases: ['ほうれんそう', 'ホウレンソウ'], cat: '野菜', unit: 'g', g: 1, pack: 200, packLabel: '1束(約200g)', shelf: 3, p: 2.2, f: 0.4, c: 3.1, tags: ['veg', 'greens'] },
    { id: 'komatsuna', name: '小松菜', aliases: ['こまつな'], cat: '野菜', unit: 'g', g: 1, pack: 200, packLabel: '1束(約200g)', shelf: 3, p: 1.5, f: 0.2, c: 2.4, tags: ['veg', 'greens'] },
    { id: 'broccoli', name: 'ブロッコリー', aliases: ['ぶろっこりー'], cat: '野菜', unit: 'g', g: 1, pack: 200, packLabel: '1株(約200g)', shelf: 4, p: 5.4, f: 0.6, c: 6.6, tags: ['veg', 'greens'] },
    { id: 'moyashi', name: 'もやし', aliases: ['モヤシ'], cat: '野菜', unit: 'g', g: 1, pack: 200, packLabel: '1袋(200g)', shelf: 2, p: 1.7, f: 0.1, c: 2.6, tags: ['veg'] },
    { id: 'green_pepper', name: 'ピーマン', aliases: ['ぴーまん'], cat: '野菜', unit: '個', g: 35, pack: 5, packLabel: '5個袋', shelf: 7, p: 0.9, f: 0.2, c: 5.1, tags: ['veg'] },
    { id: 'eggplant', name: 'なす', aliases: ['ナス', '茄子'], cat: '野菜', unit: '本', g: 80, pack: 3, packLabel: '3本袋', shelf: 5, p: 1.1, f: 0.1, c: 5.1, tags: ['veg'] },
    { id: 'daikon', name: '大根', aliases: ['だいこん', 'ダイコン'], cat: '野菜', unit: 'g', g: 1, pack: 500, packLabel: '1/2本(約500g)', shelf: 7, p: 0.5, f: 0.1, c: 4.1, tags: ['veg'] },
    { id: 'hakusai', name: '白菜', aliases: ['はくさい', 'ハクサイ'], cat: '野菜', unit: 'g', g: 1, pack: 500, packLabel: '1/4株(約500g)', shelf: 7, p: 0.8, f: 0.1, c: 3.2, tags: ['veg'] },
    { id: 'tomato', name: 'トマト', aliases: ['とまと'], cat: '野菜', unit: '個', g: 150, pack: 1, packLabel: '1個', shelf: 5, p: 0.7, f: 0.1, c: 4.7, tags: ['veg'] },
    { id: 'cucumber', name: 'きゅうり', aliases: ['キュウリ', '胡瓜'], cat: '野菜', unit: '本', g: 100, pack: 3, packLabel: '3本袋', shelf: 5, p: 1.0, f: 0.1, c: 3.0, tags: ['veg'] },
    { id: 'negi', name: '長ねぎ', aliases: ['ねぎ', 'ネギ', '長ネギ', '白ねぎ'], cat: '野菜', unit: '本', g: 100, pack: 2, packLabel: '2本', shelf: 7, p: 1.4, f: 0.1, c: 8.3, tags: ['veg'] },
    { id: 'gobo', name: 'ごぼう', aliases: ['ゴボウ', '牛蒡'], cat: '野菜', unit: '本', g: 150, pack: 1, packLabel: '1本', shelf: 7, p: 1.8, f: 0.1, c: 15.4, tags: ['veg'] },
    { id: 'pumpkin', name: 'かぼちゃ', aliases: ['カボチャ', '南瓜'], cat: '野菜', unit: 'g', g: 1, pack: 400, packLabel: '1/4個(約400g)', shelf: 7, p: 1.9, f: 0.3, c: 20.6, tags: ['veg'] },
    { id: 'nira', name: 'にら', aliases: ['ニラ', '韮'], cat: '野菜', unit: '束', g: 100, pack: 1, packLabel: '1束', shelf: 3, p: 1.7, f: 0.3, c: 4.0, tags: ['veg', 'greens'] },

    // ---- きのこ ----
    { id: 'shimeji', name: 'しめじ', aliases: ['シメジ', 'ぶなしめじ'], cat: 'きのこ', unit: 'g', g: 1, pack: 100, packLabel: '1パック(100g)', shelf: 5, p: 2.7, f: 0.5, c: 4.8, tags: ['mushroom'] },
    { id: 'enoki', name: 'えのき', aliases: ['エノキ', 'えのきだけ'], cat: 'きのこ', unit: 'g', g: 1, pack: 100, packLabel: '1袋(100g)', shelf: 5, p: 2.7, f: 0.2, c: 7.6, tags: ['mushroom'] },

    // ---- 乳製品 ----
    { id: 'milk', name: '牛乳', aliases: ['ミルク'], cat: '乳製品', unit: 'ml', g: 1, pack: 1000, packLabel: '1Lパック', shelf: 7, p: 3.3, f: 3.8, c: 4.8, tags: ['dairy'] },
    { id: 'cheese', name: 'ピザ用チーズ', aliases: ['チーズ', 'とろけるチーズ'], cat: '乳製品', unit: 'g', g: 1, pack: 150, packLabel: '150g袋', shelf: 14, p: 25.0, f: 28.0, c: 1.5, tags: ['dairy'] },

    // ---- 主食・麺 ----
    { id: 'pasta', name: 'パスタ(乾)', aliases: ['パスタ', 'スパゲッティ', 'スパゲティ'], cat: '主食・麺', unit: 'g', g: 1, pack: 500, packLabel: '500g袋', shelf: 365, p: 12.9, f: 1.8, c: 73.1, tags: ['noodle', 'wheat'] },
    { id: 'udon', name: 'ゆでうどん', aliases: ['うどん'], cat: '主食・麺', unit: '玉', g: 200, pack: 3, packLabel: '3玉パック', shelf: 7, p: 2.6, f: 0.4, c: 21.6, tags: ['noodle', 'wheat'] },
    { id: 'yakisoba', name: '焼きそば麺', aliases: ['焼きそば', '中華麺', '蒸し麺'], cat: '主食・麺', unit: '玉', g: 150, pack: 3, packLabel: '3玉パック', shelf: 5, p: 5.3, f: 1.7, c: 38.4, tags: ['noodle', 'wheat'] },

    // ---- 缶詰・加工品 ----
    { id: 'tuna_can', name: 'ツナ缶', aliases: ['ツナ', 'シーチキン'], cat: '缶詰・加工品', unit: '缶', g: 70, pack: 3, packLabel: '3缶パック', shelf: 365, p: 17.7, f: 21.7, c: 0.1, tags: ['fish'] },
    { id: 'kimchi', name: 'キムチ', aliases: ['きむち'], cat: '缶詰・加工品', unit: 'g', g: 1, pack: 200, packLabel: '200gパック', shelf: 14, p: 2.3, f: 0.5, c: 5.4, tags: ['spicy'] },
    { id: 'curry_roux', name: 'カレールウ', aliases: ['カレールー', 'ルウ'], cat: '缶詰・加工品', unit: 'g', g: 1, pack: 200, packLabel: '1箱(約200g)', shelf: 365, p: 6.5, f: 34.0, c: 44.7, tags: [] },

    // ---- 調味料・乾物（常備品扱い） ----
    { id: 'oil', name: 'サラダ油', aliases: ['油'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0, f: 100, c: 0, tags: [] },
    { id: 'sesame_oil', name: 'ごま油', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0, f: 100, c: 0, tags: [] },
    { id: 'butter', name: 'バター', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0.6, f: 81.0, c: 0.2, tags: ['dairy'] },
    { id: 'sugar', name: '砂糖', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0, f: 0, c: 99.3, tags: [] },
    { id: 'mirin', name: 'みりん', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0.3, f: 0, c: 43.2, tags: [] },
    { id: 'soy', name: '醤油', aliases: ['しょうゆ'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 7.7, f: 0, c: 7.9, tags: [] },
    { id: 'miso', name: '味噌', aliases: ['みそ'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 12.5, f: 6.0, c: 21.9, tags: [] },
    { id: 'potato_starch', name: '片栗粉', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0.1, f: 0.1, c: 81.6, tags: [] },
    { id: 'flour', name: '小麦粉', aliases: ['薄力粉'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 8.3, f: 1.5, c: 75.8, tags: ['wheat'] },
    { id: 'panko', name: 'パン粉', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 14.6, f: 6.8, c: 63.4, tags: ['wheat'] },
    { id: 'ketchup', name: 'ケチャップ', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 1.6, f: 0.2, c: 27.4, tags: [] },
    { id: 'mayo', name: 'マヨネーズ', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 1.4, f: 76.0, c: 3.6, tags: ['egg'] },
    { id: 'sauce', name: 'ウスターソース', aliases: ['ソース'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 1.0, f: 0.1, c: 27.1, tags: [] },
    { id: 'doubanjiang', name: '豆板醤', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 2.0, f: 2.3, c: 7.9, tags: ['spicy'] },
    { id: 'sesame', name: 'いりごま', aliases: ['ごま'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 20.3, f: 54.2, c: 18.5, tags: [] },
    { id: 'wakame', name: '乾燥わかめ', aliases: ['わかめ', 'ワカメ'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 17.9, f: 4.0, c: 41.8, tags: [] },
    { id: 'vinegar', name: '酢', aliases: [], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0.1, f: 0, c: 2.4, tags: [] },
    { id: 'ginger', name: 'しょうが', aliases: ['生姜'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0, f: 0, c: 0, tags: [] },
    { id: 'garlic', name: 'にんにく', aliases: ['ニンニク'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0, f: 0, c: 0, tags: [] },
    { id: 'stock', name: 'だし・コンソメ等', aliases: ['だし', 'コンソメ'], cat: '調味料・乾物', unit: 'g', g: 1, pantry: true, p: 0, f: 0, c: 0, tags: [] },
  ];

  // ご飯（主食）は量を自動調整するため別扱い
  const RICE = { id: 'rice', name: 'ご飯', p: 2.5, f: 0.3, c: 37.1, options: [0, 100, 150, 200, 250, 300] };

  /*
   * レシピ: 分量はすべて 1 人分
   *   slot: main(主菜) / side(副菜) / soup(汁物)
   *   cuisine: 和 / 洋 / 中
   *   time: 調理時間の目安（分）
   *   noRice: 麺類などご飯を付けない主菜
   *   tags: 備考の解釈やバランス調整に使う
   */
  const R = (id, name, slot, cuisine, time, ing, opt) => Object.assign({ id, name, slot, cuisine, time, ing, tags: [] }, opt || {});

  const RECIPES = [
    // ======== 主菜 ========
    R('m_shogayaki', '豚の生姜焼き', 'main', '和', 20, { pork_loin: 100, onion: 0.25, cabbage: 50, soy: 9, mirin: 9, sugar: 2, oil: 4, ginger: 5 }, { protein: 'pork' }),
    R('m_nikujaga', '肉じゃが', 'main', '和', 35, { pork_koma: 70, potato: 1, onion: 0.25, carrot: 0.25, soy: 12, mirin: 12, sugar: 4, oil: 3 }, { protein: 'pork', tags: ['煮物'] }),
    R('m_hoikoro', '回鍋肉', 'main', '中', 20, { pork_koma: 90, cabbage: 100, green_pepper: 1, negi: 0.2, miso: 8, sugar: 3, soy: 3, oil: 6, doubanjiang: 2 }, { protein: 'pork', tags: ['spicy'] }),
    R('m_butakimchi', '豚キムチ炒め', 'main', '中', 15, { pork_koma: 90, kimchi: 70, nira: 0.3, moyashi: 50, sesame_oil: 5, soy: 3 }, { protein: 'pork', tags: ['spicy'] }),
    R('m_teriyaki', '鶏の照り焼き', 'main', '和', 20, { chicken_thigh: 130, cabbage: 40, soy: 10, mirin: 10, sugar: 3, oil: 3 }, { protein: 'chicken' }),
    R('m_karaage', '鶏の唐揚げ', 'main', '和', 30, { chicken_thigh: 130, potato_starch: 10, soy: 6, oil: 12, garlic: 2, ginger: 2, cabbage: 40 }, { protein: 'chicken', tags: ['fried'] }),
    R('m_chicken_tomato', 'チキンのトマト煮', 'main', '洋', 30, { chicken_thigh: 120, tomato: 1, onion: 0.25, shimeji: 30, ketchup: 10, oil: 4, stock: 2 }, { protein: 'chicken', tags: ['煮物'] }),
    R('m_chicken_broccoli', '鶏むねとブロッコリーの塩炒め', 'main', '中', 15, { chicken_breast: 130, broccoli: 70, potato_starch: 5, oil: 6, garlic: 2, stock: 1 }, { protein: 'chicken', tags: ['healthy'] }),
    R('m_oyakodon', '親子丼', 'main', '和', 20, { chicken_thigh: 80, egg: 1.5, onion: 0.25, soy: 10, mirin: 10, sugar: 3, stock: 1 }, { protein: 'chicken', tags: ['丼'] }),
    R('m_tsukune', '鶏つくね', 'main', '和', 25, { chicken_mince: 110, negi: 0.2, egg: 0.25, potato_starch: 4, soy: 8, mirin: 8, sugar: 3, oil: 3 }, { protein: 'chicken' }),
    R('m_mabo', '麻婆豆腐', 'main', '中', 20, { pork_mince: 60, tofu: 0.5, negi: 0.2, miso: 4, soy: 5, doubanjiang: 3, potato_starch: 3, sesame_oil: 3, oil: 3, garlic: 2 }, { protein: 'pork', tags: ['spicy'] }),
    R('m_hamburg', 'ハンバーグ', 'main', '洋', 35, { mixed_mince: 120, onion: 0.25, egg: 0.25, panko: 8, milk: 10, ketchup: 15, sauce: 8, oil: 4 }, { protein: 'beef' }),
    R('m_chinjao', '青椒肉絲（チンジャオロース）', 'main', '中', 20, { beef_koma: 90, green_pepper: 2, potato_starch: 3, soy: 6, sugar: 2, oil: 6 }, { protein: 'beef' }),
    R('m_gyudon', '牛丼', 'main', '和', 15, { beef_koma: 90, onion: 0.4, soy: 12, mirin: 12, sugar: 4, ginger: 3 }, { protein: 'beef', tags: ['丼'] }),
    R('m_curry', 'カレーライス', 'main', '洋', 40, { pork_koma: 70, potato: 0.7, onion: 0.4, carrot: 0.3, curry_roux: 22, oil: 4 }, { protein: 'pork', tags: ['煮物'] }),
    R('m_meuniere', '鮭のムニエル', 'main', '洋', 15, { salmon: 1, flour: 6, butter: 6, oil: 2, broccoli: 40 }, { protein: 'fish' }),
    R('m_chanchan', '鮭のちゃんちゃん焼き', 'main', '和', 20, { salmon: 1, cabbage: 80, onion: 0.15, carrot: 0.15, miso: 10, sugar: 3, mirin: 6, butter: 4 }, { protein: 'fish' }),
    R('m_sabamiso', 'さばの味噌煮', 'main', '和', 25, { mackerel: 1, negi: 0.3, miso: 10, sugar: 5, mirin: 8, ginger: 3 }, { protein: 'fish', tags: ['煮物'] }),
    R('m_buridaikon', 'ぶり大根', 'main', '和', 40, { yellowtail: 1, daikon: 120, soy: 12, mirin: 10, sugar: 4, ginger: 3 }, { protein: 'fish', tags: ['煮物'] }),
    R('m_buriteri', 'ぶりの照り焼き', 'main', '和', 15, { yellowtail: 1, soy: 9, mirin: 9, sugar: 2, oil: 3, komatsuna: 40 }, { protein: 'fish' }),
    R('m_foil', 'たらときのこのホイル焼き', 'main', '和', 20, { cod: 1.2, shimeji: 40, onion: 0.2, butter: 6, soy: 4 }, { protein: 'fish', tags: ['healthy'] }),
    R('m_ebichili', 'えびチリ', 'main', '中', 20, { shrimp: 110, negi: 0.25, ketchup: 20, doubanjiang: 2, potato_starch: 3, oil: 6, sugar: 2, egg: 0.5 }, { protein: 'fish', tags: ['spicy'] }),
    R('m_tofuhamburg', '豆腐ハンバーグ きのこあんかけ', 'main', '和', 30, { tofu: 0.33, chicken_mince: 70, egg: 0.25, potato_starch: 6, soy: 8, mirin: 8, oil: 4, shimeji: 25 }, { protein: 'soy', tags: ['healthy'] }),
    R('m_atsuage_miso', '厚揚げと豚肉の味噌炒め', 'main', '和', 15, { atsuage: 0.75, pork_koma: 50, green_pepper: 1, eggplant: 0.5, miso: 8, sugar: 3, oil: 5 }, { protein: 'soy' }),
    R('m_carbonara', 'カルボナーラ', 'main', '洋', 15, { pasta: 100, bacon: 30, egg: 1, cheese: 15, milk: 30, oil: 3 }, { protein: 'egg', noRice: true, tags: ['麺'] }),
    R('m_tuna_pasta', 'ツナとトマトのパスタ', 'main', '洋', 15, { pasta: 100, tuna_can: 0.6, tomato: 1, onion: 0.2, oil: 6, garlic: 3 }, { protein: 'fish', noRice: true, tags: ['麺'] }),
    R('m_yakiudon', '焼うどん', 'main', '和', 15, { udon: 1, pork_koma: 70, cabbage: 80, carrot: 0.15, soy: 10, oil: 5 }, { protein: 'pork', noRice: true, tags: ['麺'] }),
    R('m_yakisoba', 'ソース焼きそば', 'main', '和', 15, { yakisoba: 1, pork_koma: 70, cabbage: 80, moyashi: 50, sauce: 20, oil: 5 }, { protein: 'pork', noRice: true, tags: ['麺'] }),
    R('m_cream_stew', '鶏肉と白菜のクリーム煮', 'main', '洋', 25, { chicken_thigh: 100, hakusai: 120, milk: 120, butter: 5, flour: 7, shimeji: 30, stock: 2 }, { protein: 'chicken', tags: ['煮物'] }),
    R('m_millefeuille', '豚肉と白菜のミルフィーユ鍋', 'main', '和', 25, { pork_loin: 100, hakusai: 200, shimeji: 30, soy: 10, vinegar: 5, stock: 2 }, { protein: 'pork', tags: ['鍋'] }),
    R('m_nira_tama', 'にら玉と豚肉の炒め', 'main', '中', 10, { egg: 2, nira: 0.4, pork_koma: 40, oil: 6, soy: 4 }, { protein: 'egg' }),

    // ======== 副菜 ========
    R('s_ohitashi', 'ほうれん草のおひたし', 'side', '和', 5, { spinach: 60, soy: 4 }),
    R('s_gomaae', 'ほうれん草のごま和え', 'side', '和', 10, { spinach: 60, sesame: 4, soy: 4, sugar: 2 }),
    R('s_komatsuna', '小松菜と油揚げの煮びたし', 'side', '和', 10, { komatsuna: 70, aburaage: 0.3, soy: 5, mirin: 5 }),
    R('s_cabbage_goma', 'キャベツのごま油和え', 'side', '中', 5, { cabbage: 70, sesame_oil: 3, sesame: 2 }),
    R('s_coleslaw', 'コールスロー', 'side', '洋', 10, { cabbage: 60, carrot: 0.1, mayo: 10, sugar: 1, vinegar: 3 }),
    R('s_potesala', 'ポテトサラダ', 'side', '洋', 20, { potato: 0.7, cucumber: 0.25, carrot: 0.1, mayo: 12 }),
    R('s_broccoli_egg', 'ブロッコリーとゆで卵のサラダ', 'side', '洋', 15, { broccoli: 60, egg: 0.5, mayo: 8 }),
    R('s_namul', 'もやしのナムル', 'side', '中', 5, { moyashi: 70, sesame_oil: 4, soy: 3, sesame: 1 }),
    R('s_sunomono', 'きゅうりとわかめの酢の物', 'side', '和', 5, { cucumber: 0.5, wakame: 1, sugar: 3, vinegar: 10 }),
    R('s_tomato_salad', 'トマトと玉ねぎのサラダ', 'side', '洋', 5, { tomato: 0.5, onion: 0.05, oil: 4, vinegar: 4 }),
    R('s_nasu', 'なすの煮びたし', 'side', '和', 15, { eggplant: 1, soy: 6, mirin: 6, oil: 5 }),
    R('s_kinpira', 'きんぴらごぼう', 'side', '和', 15, { gobo: 0.3, carrot: 0.15, sesame_oil: 3, soy: 6, mirin: 5, sugar: 2 }),
    R('s_kabocha', 'かぼちゃの煮物', 'side', '和', 20, { pumpkin: 80, soy: 5, mirin: 5, sugar: 3 }),
    R('s_daikon_tuna', '大根とツナのサラダ', 'side', '和', 10, { daikon: 70, tuna_can: 0.25, mayo: 6, soy: 2 }),
    R('s_hiyayakko', '冷奴', 'side', '和', 3, { tofu: 0.33, negi: 0.05, soy: 4 }),
    R('s_natto', '納豆（ねぎ添え）', 'side', '和', 2, { natto: 1, negi: 0.05 }),
    R('s_piman', 'ピーマンのおかか炒め', 'side', '和', 10, { green_pepper: 1.5, sesame_oil: 3, soy: 3 }),
    R('s_shirishiri', 'にんじんしりしり', 'side', '和', 10, { carrot: 0.3, egg: 0.5, oil: 3, soy: 3 }),
    R('s_asazuke', '白菜の浅漬け', 'side', '和', 5, { hakusai: 80 }),
    R('s_tamagoyaki', '卵焼き', 'side', '和', 10, { egg: 1.5, sugar: 3, oil: 2, soy: 1 }),
    R('s_kinoko', 'きのこのバターソテー', 'side', '洋', 10, { shimeji: 50, enoki: 40, butter: 4, soy: 3 }),
    R('s_spinach_saute', 'ほうれん草とベーコンのソテー', 'side', '洋', 10, { spinach: 70, bacon: 10, butter: 4 }),
    R('s_tataki_kyuri', 'たたききゅうり', 'side', '中', 5, { cucumber: 0.7, sesame_oil: 3, soy: 4, vinegar: 3 }),
    R('s_daikon_nimono', '大根と厚揚げの煮物', 'side', '和', 25, { daikon: 80, atsuage: 0.25, soy: 6, mirin: 6, sugar: 2 }),

    // ======== 汁物 ========
    R('p_tofu_wakame', '豆腐とわかめの味噌汁', 'soup', '和', 10, { tofu: 0.15, wakame: 1, negi: 0.05, miso: 12, stock: 1 }),
    R('p_daikon_age', '大根と油揚げの味噌汁', 'soup', '和', 10, { daikon: 50, aburaage: 0.25, miso: 12, stock: 1 }),
    R('p_cabbage_onion', 'キャベツと玉ねぎの味噌汁', 'soup', '和', 10, { cabbage: 40, onion: 0.1, miso: 12, stock: 1 }),
    R('p_enoki_negi', 'えのきと長ねぎの味噌汁', 'soup', '和', 10, { enoki: 30, negi: 0.1, miso: 12, stock: 1 }),
    R('p_potato_onion', 'じゃがいもと玉ねぎの味噌汁', 'soup', '和', 15, { potato: 0.3, onion: 0.1, miso: 12, stock: 1 }),
    R('p_tonjiru', '豚汁', 'soup', '和', 25, { pork_koma: 30, daikon: 40, carrot: 0.1, gobo: 0.1, negi: 0.1, miso: 14, stock: 1 }),
    R('p_komatsuna_age', '小松菜と油揚げの味噌汁', 'soup', '和', 10, { komatsuna: 30, aburaage: 0.25, miso: 12, stock: 1 }),
    R('p_egg_soup', '中華風卵スープ', 'soup', '中', 10, { egg: 0.5, negi: 0.05, potato_starch: 2, sesame_oil: 1, stock: 2 }),
    R('p_hakusai_soup', '白菜ときのこの中華スープ', 'soup', '中', 10, { hakusai: 50, enoki: 20, sesame_oil: 1, soy: 2, stock: 2 }),
    R('p_moyashi_nira', 'もやしとにらのスープ', 'soup', '中', 10, { moyashi: 40, nira: 0.15, sesame_oil: 1, stock: 2 }),
    R('p_consomme', 'キャベツとベーコンのコンソメスープ', 'soup', '洋', 10, { cabbage: 40, bacon: 8, onion: 0.1, stock: 2 }),
    R('p_minestrone', 'ミネストローネ', 'soup', '洋', 20, { tomato: 0.3, onion: 0.15, carrot: 0.1, potato: 0.2, bacon: 8, oil: 2, stock: 2 }),
  ];

  // 冷凍保存しやすい食材（鮮度ペナルティを軽くする）
  const FREEZABLE = new Set(['udon', 'yakisoba', 'aburaage', 'natto', 'cheese', 'bacon']);
  // 朝食など夕食以外でも普段使いする食材（余っても困りにくいので余りの評価を軽くする）
  const DAILY = new Set(['egg', 'milk', 'natto', 'tomato', 'cucumber']);
  INGREDIENTS.forEach((ing, idx) => {
    ing.idx = idx;
    ing.freeze = ing.cat === '肉' || ing.cat === '魚介' || FREEZABLE.has(ing.id);
    ing.daily = DAILY.has(ing.id);
  });

  const ING_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
  const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

  /** 1 人分のレシピ栄養値 */
  function recipeNutrition(recipe) {
    const n = { p: 0, f: 0, c: 0 };
    for (const [id, amt] of Object.entries(recipe.ing)) {
      const ing = ING_BY_ID[id];
      if (!ing) throw new Error('unknown ingredient ' + id + ' in ' + recipe.id);
      const grams = amt * ing.g;
      n.p += (ing.p * grams) / 100;
      n.f += (ing.f * grams) / 100;
      n.c += (ing.c * grams) / 100;
    }
    return n;
  }
  for (const r of RECIPES) {
    r.nut = recipeNutrition(r);
    r.ingList = Object.entries(r.ing).map(([id, amt]) => [ING_BY_ID[id].idx, amt]);
  }

  /** カタカナ→ひらがな、空白除去などの正規化 */
  function normalize(s) {
    return String(s || '')
      .trim()
      .replace(/[\s　]/g, '')
      .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .toLowerCase();
  }

  /** 入力された名前から食材を探す（完全一致 → 別名 → 部分一致） */
  function findIngredient(name) {
    const q = normalize(name);
    if (!q) return null;
    for (const ing of INGREDIENTS) if (normalize(ing.name) === q) return ing;
    for (const ing of INGREDIENTS) if (ing.aliases.some((a) => normalize(a) === q)) return ing;
    for (const ing of INGREDIENTS) {
      const names = [ing.name, ...ing.aliases].map(normalize);
      if (names.some((n) => n.length >= 2 && (n.includes(q) || q.includes(n)))) return ing;
    }
    return null;
  }

  const api = { CATEGORY_ORDER, INGREDIENTS, RECIPES, RICE, ING_BY_ID, RECIPE_BY_ID, recipeNutrition, normalize, findIngredient };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MealData = api;
})(typeof self !== 'undefined' ? self : this);
