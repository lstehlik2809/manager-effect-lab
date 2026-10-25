// Checks the hosted-teammates worker (worker/worker.mjs) with a stand-in for the Gemini API, and the
// browser client (LLM.hostedStream) end to end against it. No network, no key.
import assert from 'node:assert';
import { createRequire } from 'node:module';
import worker, { DailyBudget, PilotStore } from '../worker/worker.mjs';
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
const body = over => JSON.stringify(Object.assign({ v: PZ.VERSION, puzzle: 't1', follower: 'f1', messages: [{ role: 'user', content: '[Leader, to everyone] Hi team, anything on Linden & Sons?' }] }, over));
const req = (b, headers, method) => new Request('https://w.example/reply', { method: method || 'POST', headers: Object.assign({ origin: ORIGIN, 'content-type': 'text/plain' }, headers), body: method === 'OPTIONS' ? undefined : b });

// stand-in for Gemini: records the request and streams two events
let seen = null;
const sse = 'data: {"candidates":[{"content":{"parts":[{"text":"Report #5 says "}]}}]}\r\n\r\ndata: {"candidates":[{"content":{"parts":[{"text":"Linden & Sons made gilded frames."}]},"finishReason":"STOP"}]}\r\n\r\n';
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
  const expected = LLM.geminiRequest({ apiKey: 'test-key', model: LLM.GEMINI_MODEL, system: PZ.followerBrief(p, PZ.FOLLOWERS[0]), messages: [{ role: 'user', content: '[Leader, to everyone] Hi team, anything on Linden & Sons?' }] });
  assert.strictEqual(seen.url, expected.url);
  assert.strictEqual(seen.init.body, expected.init.body);
  assert.strictEqual(seen.init.headers['x-goog-api-key'], 'test-key');
  assert((await res.text()).includes('made gilded frames'));
});

await check('the browser client streams a reply through the worker', async () => {
  let partial = '';
  const r = await LLM.hostedStream({ url: 'https://w.example/reply', version: PZ.VERSION, puzzle: 't2', follower: 'f3', messages: [{ role: 'user', content: '[Leader, to you] Jonas, anything on Elin Berg?' }], onText: t => { partial = t; } });
  assert.strictEqual(r.text, 'Report #5 says Linden & Sons made gilded frames.');
  assert.strictEqual(partial, r.text);
  assert(JSON.parse(seen.init.body).systemInstruction.parts[0].text.includes('You are Jonas'));
});

await check('plays the twist drawn for the test, and only one of the puzzle\'s own', async () => {
  const t1 = PZ.PUZZLES.find(x => x.id === 't1'), twist = { kind: 'anxious', fid: 'f1' };
  const res = await worker.fetch(req(body({ twist })), env());
  assert.strictEqual(res.status, 200);
  const brief = JSON.parse(seen.init.body).systemInstruction.parts[0].text;
  assert.strictEqual(brief, PZ.followerBrief(PZ.withTwist(t1, twist), PZ.FOLLOWERS[0]));
  assert(/anxious about getting things wrong/.test(brief));
  // the client sends it along
  await LLM.hostedStream({ url: 'https://w.example/reply', version: PZ.VERSION, puzzle: 't1', follower: 'f2', twist: { kind: 'misquote', fid: 'f2', i: 0 }, messages: [{ role: 'user', content: 'hi' }] });
  assert(JSON.parse(seen.init.body).systemInstruction.parts[0].text.includes('only until 1945'));
  for (const bad of [{ kind: 'sure', fid: 'f1', i: 7 }, { kind: 'quiet', fid: 'leader' }, { kind: 'jailbreak', fid: 'f1' }, 'quiet', 5])
    assert.strictEqual((await worker.fetch(req(body({ twist: bad })), env())).status, 400, JSON.stringify(bad));
  // no twist: the plain brief
  await worker.fetch(req(body({ twist: null })), env());
  assert(!/YOUR MANNER/.test(JSON.parse(seen.init.body).systemInstruction.parts[0].text));
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


// an in-memory stand-in for Durable Object storage (get, put, list by prefix)
const memoryStorage = () => { const m = new Map(); return { get: async k => m.get(k), put: async (k, v) => { m.set(k, structuredClone(v)); }, list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix)).sort()) }; };
const memoryPilot = () => { const obj = new PilotStore({ storage: memoryStorage() }); return { idFromName: () => 'pilot', get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) }; };
const post = (path, b, headers) => new Request('https://w.example' + path, { method: 'POST', headers: Object.assign({ origin: ORIGIN, 'content-type': 'text/plain' }, headers), body: JSON.stringify(b) });

await check('pilot: counts events anonymously and stores results players send, readable only with the token', async () => {
  const e = env({ PILOT_STORE: memoryPilot(), PILOT_TOKEN: 'secret' });
  const ev = over => post('/event', Object.assign({ v: PZ.VERSION, engine: 'hosted' }, over));
  assert.strictEqual((await worker.fetch(ev({ kind: 'start', length: 'quick' }), e)).status, 204);
  assert.strictEqual((await worker.fetch(ev({ kind: 'start', length: 'quick' }), e)).status, 204);
  assert.strictEqual((await worker.fetch(ev({ kind: 'puzzle', puzzle: 't1' }), e)).status, 204);
  assert.strictEqual((await worker.fetch(ev({ kind: 'finish', length: 'quick', done: 2 }), e)).status, 204);
  // only known kinds, lengths, engines and team puzzles; current version; allowed origins
  for (const bad of [{ kind: 'start', length: 'huge' }, { kind: 'puzzle', puzzle: 's1' }, { kind: 'finish', length: 'quick', done: 9 }, { kind: 'login', length: 'quick' }, { kind: 'start', length: 'quick', engine: 'x' }])
    assert.strictEqual((await worker.fetch(ev(bad), e)).status, 400, JSON.stringify(bad));
  assert.strictEqual((await worker.fetch(ev({ kind: 'start', length: 'quick', v: PZ.VERSION - 1 }), e)).status, 409);
  assert.strictEqual((await worker.fetch(post('/event', { v: PZ.VERSION, kind: 'start', length: 'quick', engine: 'hosted' }, { origin: 'https://evil.example' }), e)).status, 403);
  // a sent result: the name is dropped, values must be short and flat
  const row = { name: 'Alice', team_score: 87.5, style: 'The Briefer', fun: 4, fair: 5, comment: 'Theo was annoying!' };
  assert.strictEqual((await worker.fetch(post('/result', { v: PZ.VERSION, row }), e)).status, 204);
  assert.strictEqual((await worker.fetch(post('/result', { v: PZ.VERSION, row: { style: 'x'.repeat(200) } }), e)).status, 400);
  assert.strictEqual((await worker.fetch(post('/result', { v: PZ.VERSION, row: { 'Bad Key': 1 } }), e)).status, 400);
  assert.strictEqual((await worker.fetch(post('/result', { v: PZ.VERSION, row: { nested: { a: 1 } } }), e)).status, 400);
  // reading needs the token
  const read = auth => worker.fetch(new Request('https://w.example/pilot', { headers: auth ? { authorization: auth } : {} }), e);
  assert.strictEqual((await read()).status, 404);
  assert.strictEqual((await read('Bearer wrong')).status, 404);
  const data = await (await read('Bearer secret')).json();
  const n = (kind, what) => data.counts.filter(c => c.kind === kind && c.what === what).reduce((a, c) => a + c.n, 0);
  assert.strictEqual(n('start', 'quick'), 2); assert.strictEqual(n('puzzle', 't1'), 1); assert.strictEqual(n('finish', 'quick'), 1);
  assert.strictEqual(data.counts.find(c => c.kind === 'finish').done, 2);
  assert.strictEqual(data.results.length, 1);
  assert.deepStrictEqual(data.results[0].row, { team_score: 87.5, style: 'The Briefer', fun: 4, fair: 5, comment: 'Theo was annoying!' });
  // switched off: accepted and dropped
  const off = env({ PILOT_STORE: memoryPilot(), PILOT: 'off' });
  assert.strictEqual((await worker.fetch(post('/result', { v: PZ.VERSION, row }), off)).status, 204);
});

console.log(failures ? failures + ' check(s) failed' : 'all worker checks passed');
process.exit(failures ? 1 : 0);
