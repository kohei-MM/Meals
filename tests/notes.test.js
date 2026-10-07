const test = require('node:test');
const assert = require('node:assert');
const { parseNotes } = require('../js/notes.js');

test('優先と除外を読み取る', () => {
  const r = parseNotes('魚多め、辛いものは苦手');
  assert.ok(r.prefer.some((t) => t.kind === 'itag' && t.tag === 'fish'));
  assert.ok(r.exclude.some((t) => t.kind === 'rtag' && t.tag === 'spicy'));
});

test('アレルギーと調理時間', () => {
  const r = parseNotes('卵アレルギーです。平日は３０分以内');
  assert.ok(r.exclude.some((t) => t.tag === 'egg'));
  assert.strictEqual(r.maxTime, 30);
});

test('汁物なし・料理名・週◯回', () => {
  const r = parseNotes('汁物なし。カレーが食べたい。魚は週3回、揚げ物は控えめに');
  assert.strictEqual(r.noSoup, true);
  assert.ok(r.prefer.some((t) => t.kind === 'recipe' && t.id === 'm_curry'));
  assert.deepStrictEqual(r.freq.map((f) => [f.target.tag, f.perWeek]), [['fish', 3]]);
  assert.ok(r.avoid.some((t) => t.tag === 'fried'));
});

test('「けど」で区切って別々に解釈する', () => {
  const r = parseNotes('鶏肉が好きだけど牛肉はダメ');
  assert.ok(r.prefer.some((t) => t.tag === 'chicken'));
  assert.ok(r.exclude.some((t) => t.tag === 'beef'));
});

test('読み取れない文は unparsed に残す', () => {
  const r = parseNotes('よろしくお願いします');
  assert.deepStrictEqual(r.unparsed, ['よろしくお願いします']);
});
