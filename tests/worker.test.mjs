// Checks the hosted-teammates worker (worker/worker.mjs) with a stand-in for the Gemini API, and the
// browser client (LLM.hostedStream) end to end against it. No network, no key.
import assert from 'node:assert';
import { createRequire } from 'node:module';
import worker, { DailyBudget } from '../worker/worker.mjs';
const require = createRequire(import.meta.url);
const PZ = require('../src/puzzles.js');
const LLM = require('../src/llm.js');

const ORIGIN = 'https://lstehlik2809.github.io';
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}
const memoryBudget = limit => {
  const store = new Map(), obj = new DailyBudget({ storage: { get: async k => store.get(k), put: async (k, v) => { store.set(k, v); } } }, { DAILY_LIMIT: String(limit) });
  return { idFromName: () => 'daily', get: () => ({ fetch: () => obj.fetch() }) };
};
const env = over => Object.assign({ GEMINI_API_KEY: 'test-key', ALLOWED_ORIGINS: ORIGIN + ',http://127.0.0.1:8765', BUDGET: memoryBudget(1000), PER_VISITOR: { limit: async () => ({ success: true }) } }, over);
const body = over => JSON.stringify(Object.assign({ v: PZ.VERSION, puzzle: 't1', follower: 'f1', messages: [{ role: 'user', content: '[Leader, to everyone] Hi team, anything on the capping head?' }] }, over));
const req = (b, headers, method) => new Request('https://w.example/reply', { method: method || 'POST', headers: Object.assign({ origin: ORIGIN, 'content-type': 'text/plain' }, headers), body: method === 'OPTIONS' ? undefined : b });

// stand-in for Gemini: records the request and streams two events
let seen = null;
const sse = 'data: {"candidates":[{"content":{"parts":[{"text":"Report #5 says "}]}}]}\r\n\r\ndata: {"candidates":[{"content":{"parts":[{"text":"the capping head is new."}]},"finishReason":"STOP"}]}\r\n\r\n';
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://w.example/')) return worker.fetch(new Request(url, Object.assign({}, init, { headers: Object.assign({ origin: ORIGIN }, init.headers) })), env());
  seen = { url: String(url), init };
  return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

await check('builds the same Gemini request as the browser, with the brief made on the server', async () => {
  const res = await worker.fetch(req(body()), env());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), ORIGIN);
  const p = PZ.PUZZLES.find(x => x.id === 't1');
  const expected = LLM.geminiRequest({ apiKey: 'test-key', model: LLM.GEMINI_MODEL, system: PZ.followerBrief(p, PZ.FOLLOWERS[0]), messages: [{ role: 'user', content: '[Leader, to everyone] Hi team, anything on the capping head?' }] });
  assert.strictEqual(seen.url, expected.url);
  assert.strictEqual(seen.init.body, expected.init.body);
  assert.strictEqual(seen.init.headers['x-goog-api-key'], 'test-key');
  assert((await res.text()).includes('capping head is new'));
});

await check('the browser client streams a reply through the worker', async () => {
  let partial = '';
  const r = await LLM.hostedStream({ url: 'https://w.example/reply', version: PZ.VERSION, puzzle: 't2', follower: 'f3', messages: [{ role: 'user', content: '[Leader, to you] Jonas, any rail bookings?' }], onText: t => { partial = t; } });
  assert.strictEqual(r.text, 'Report #5 says the capping head is new.');
  assert.strictEqual(partial, r.text);
  assert(JSON.parse(seen.init.body).systemInstruction.parts[0].text.includes('You are Jonas'));
});

await check('refuses other origins, unknown puzzles, solo puzzles, bad turns and old pages', async () => {
  assert.strictEqual((await worker.fetch(req(body(), { origin: 'https://evil.example' }), env())).status, 403);
  assert.strictEqual((await worker.fetch(req(null, {}, 'OPTIONS'), env())).status, 204);
  assert.strictEqual((await worker.fetch(req(body({ puzzle: 'x9' })), env())).status, 400);
  assert.strictEqual((await worker.fetch(req(body({ puzzle: 's1' })), env())).status, 400);
  assert.strictEqual((await worker.fetch(req(body({ follower: 'leader' })), env())).status, 400);
  assert.strictEqual((await worker.fetch(req(body({ messages: [{ role: 'assistant', content: 'hi' }] })), env())).status, 400);
  assert.strictEqual((await worker.fetch(req(body({ messages: [{ role: 'user', content: 'x'.repeat(5000) }] })), env())).status, 400);
  assert.strictEqual((await worker.fetch(req(body({ v: PZ.VERSION - 1 })), env())).status, 409);
  assert.strictEqual((await worker.fetch(req('not json'), env())).status, 400);
  assert.strictEqual((await worker.fetch(req(body()), env({ GEMINI_API_KEY: '' }))).status, 503);
});

await check('caps requests per visitor and per day', async () => {
  const limited = await worker.fetch(req(body()), env({ PER_VISITOR: { limit: async () => ({ success: false }) } }));
  assert.strictEqual(limited.status, 429);
  const e = env({ BUDGET: memoryBudget(2) });
  assert.strictEqual((await worker.fetch(req(body()), e)).status, 200);
  assert.strictEqual((await worker.fetch(req(body()), e)).status, 200);
  const third = await worker.fetch(req(body()), e);
  assert.strictEqual(third.status, 429);
  assert.strictEqual((await third.json()).error.status, 'DAILY_LIMIT');
});

await check('the client sees the daily limit as a reason it can show', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => worker.fetch(new Request(url, Object.assign({}, init, { headers: Object.assign({ origin: ORIGIN }, init.headers) })), env({ BUDGET: memoryBudget(0) }));
  try {
    await LLM.hostedStream({ url: 'https://w.example/reply', version: PZ.VERSION, puzzle: 't1', follower: 'f1', messages: [{ role: 'user', content: 'hi' }] });
    assert.fail('should have thrown');
  } catch (e) { assert.strictEqual(e.status, 429); assert.strictEqual(e.reason, 'DAILY_LIMIT'); }
  finally { globalThis.fetch = saved; }
});

await check('hides Gemini error details from visitors', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'API key not valid for project 1234' } }), { status: 400 });
  const err = console.error; console.error = () => {};
  try {
    const res = await worker.fetch(req(body()), env());
    assert.strictEqual(res.status, 502);
    assert(!(await res.text()).includes('1234'));
  } finally { globalThis.fetch = saved; console.error = err; }
});

console.log(failures ? failures + ' check(s) failed' : 'all worker checks passed');
process.exit(failures ? 1 : 0);
