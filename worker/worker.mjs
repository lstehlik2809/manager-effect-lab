// Hosted AI teammates for the Manager Effect Lab leadership test (Cloudflare Worker).
// Visitors need no API key: the worker holds one Gemini key as a secret and plays only the test's
// teammates. It builds each teammate's brief itself from the puzzle and teammate ids and the twist drawn
// for the test (the same followerBrief and request settings as the browser), so it cannot be used as a
// general-purpose model proxy. It caps requests per visitor per minute and for everyone per day.
// It also collects pilot data: anonymous counts of tests started, team puzzles finished and tests
// finished (no chat, no personal data, no IP), and results that a player chooses to send at the end
// (scores, style, ratings and comment, never a name or the chat). The owner reads them with
// GET /pilot and the PILOT_TOKEN secret (tools/pilot-export.mjs). Set PILOT to "off" to stop collecting.
import PZ from '../src/puzzles.js';
import LLM from '../src/llm.js';

const MAX_BODY = 64 * 1024, MAX_TURNS = 80, MAX_USER = 4000, MAX_REPLY = 2000, MAX_TOTAL = 40000;
const LENGTH_IDS = ['quick', 'standard', 'extended'], ENGINES = ['hosted', 'scripted', 'gemini', 'api', 'claude'];
const MAX_FIELDS = 80, MAX_VALUE = 80, MAX_COMMENT = 600, MAX_RESULTS = 20000;

const error = (status, reason, message, cors) => new Response(JSON.stringify({ error: { code: status, status: reason, message } }),
  { status, headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, cors) });

function validate(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  const p = PZ.PUZZLES.find(x => x.id === body.puzzle && !x.solo), f = PZ.FOLLOWERS.find(x => x.id === body.follower);
  if (!p || !f) return 'Unknown puzzle or teammate.';
  // the twist drawn for this test, if any: only one of the puzzle's own
  if (body.twist != null && !PZ.twistValid(p, body.twist)) return 'Unknown twist.';
  const msgs = body.messages;
  if (!Array.isArray(msgs) || !msgs.length || msgs.length > MAX_TURNS || msgs.length % 2 === 0) return 'The chat must start and end with the leader.';
  let total = 0;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i], role = i % 2 ? 'assistant' : 'user';
    if (!m || m.role !== role || typeof m.content !== 'string' || !m.content.trim()) return 'Turns must alternate between the leader and the teammate.';
    if (m.content.length > (role === 'user' ? MAX_USER : MAX_REPLY)) return 'A message is too long.';
    total += m.content.length;
  }
  if (total > MAX_TOTAL) return 'The chat is too long.';
  return { p: PZ.withTwist(p, body.twist), f, msgs: msgs.map(m => ({ role: m.role, content: m.content })) };
}

/** A pilot count: which of a fixed set of things happened, never who did it. Returns its counter key or an error text. */
function eventKey(b) {
  if (!b || typeof b !== 'object' || !ENGINES.includes(b.engine)) return 'Unknown event.';
  const day = new Date().toISOString().slice(0, 10);
  if ((b.kind === 'start' || b.kind === 'finish') && LENGTH_IDS.includes(b.length)) {
    if (b.kind === 'start') return [day, 'start', b.length, b.engine].join('|');
    if (Number.isInteger(b.done) && b.done >= 0 && b.done <= 6) return [day, 'finish', b.length, b.engine, b.done].join('|');
  }
  if (b.kind === 'puzzle' && PZ.PUZZLES.some(p => p.id === b.puzzle && !p.solo)) return [day, 'puzzle', b.puzzle, b.engine].join('|');
  return 'Unknown event.';
}
/** A result a player chose to send: flat fields with short values, no name. Returns the cleaned row or an error text. */
function cleanResult(b) {
  const row = b && b.row;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 'No result.';
  const keys = Object.keys(row);
  if (!keys.length || keys.length > MAX_FIELDS) return 'Too many fields.';
  const out = {};
  for (const k of keys) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) return 'Bad field name.';
    if (k === 'name') continue;
    const v = row[k];
    if (typeof v === 'number') { if (!isFinite(v)) return 'Bad value.'; out[k] = v; continue; }
    if (typeof v !== 'string' || v.length > (k === 'comment' ? MAX_COMMENT : MAX_VALUE)) return 'Bad value.';
    out[k] = v;
  }
  return out;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' }
      : { vary: 'Origin' };
    const path = new URL(request.url).pathname;
    if (path === '/pilot' && request.method === 'GET') return readPilot(request, env);
    if (!['/reply', '/event', '/result'].includes(path)) return error(404, 'NOT_FOUND', 'Not found.', cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors['access-control-allow-origin'] ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return error(405, 'METHOD', 'Use POST.', cors);
    if (!cors['access-control-allow-origin']) return error(403, 'ORIGIN', 'This page may not use the hosted teammates.', cors);
    if (path !== '/reply') return pilot(path, request, env, cors);
    if (!env.GEMINI_API_KEY) return error(503, 'NOT_CONFIGURED', 'The hosted teammates are not set up.', cors);

    // check the request before spending any budget on it
    const raw = await request.text();
    if (raw.length > MAX_BODY) return error(413, 'TOO_LARGE', 'The chat is too long.', cors);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return error(400, 'BAD_REQUEST', 'Body must be JSON.', cors); }
    if (body && body.v !== PZ.VERSION) return error(409, 'VERSION', 'The test was updated. Reload the page.', cors);
    const ok = validate(body);
    if (typeof ok === 'string') return error(400, 'BAD_REQUEST', ok, cors);

    if (env.PER_VISITOR) {
      const { success } = await env.PER_VISITOR.limit({ key: request.headers.get('cf-connecting-ip') || 'unknown' });
      if (!success) return error(429, 'RATE_LIMITED', 'Too many messages at once. Wait a few seconds.', cors);
    }
    if (env.BUDGET) {
      const r = await env.BUDGET.get(env.BUDGET.idFromName('daily')).fetch('https://budget/take', { method: 'POST' });
      if (r.status === 429) return error(429, 'DAILY_LIMIT', 'The free AI teammates are used up for today.', cors);
    }

    const rq = LLM.geminiRequest({ apiKey: env.GEMINI_API_KEY, model: LLM.GEMINI_MODEL, system: PZ.followerBrief(ok.p, ok.f), messages: ok.msgs });
    let upstream;
    try { upstream = await fetch(rq.url, rq.init); }
    catch (e) { return error(502, 'UPSTREAM', 'Could not reach the AI service.', cors); }
    if (!upstream.ok) {
      // Google's error text stays in the worker log; visitors get a generic message
      let detail = '';
      try { detail = (await upstream.text()).slice(0, 300); } catch (e) { /* no body */ }
      console.error('gemini error', upstream.status, detail);
      return error(upstream.status === 429 || upstream.status >= 500 ? 503 : 502, 'UPSTREAM', 'The AI service is busy. Ask again in a moment.', cors);
    }
    return new Response(upstream.body, { status: 200, headers: Object.assign({ 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' }, cors) });
  }
};

/** POST /event (an anonymous count) and POST /result (a result the player chose to send). */
async function pilot(path, request, env, cors) {
  if (env.PILOT === 'off' || !env.PILOT_STORE) return new Response(null, { status: 204, headers: cors });
  const raw = await request.text();
  if (raw.length > 8 * 1024) return error(413, 'TOO_LARGE', 'Too large.', cors);
  let body;
  try { body = JSON.parse(raw); } catch (e) { return error(400, 'BAD_REQUEST', 'Body must be JSON.', cors); }
  if (!body || body.v !== PZ.VERSION) return error(409, 'VERSION', 'The test was updated. Reload the page.', cors);
  const item = path === '/event' ? eventKey(body) : cleanResult(body);
  if (typeof item === 'string' && path === '/result') return error(400, 'BAD_REQUEST', item, cors);
  if (path === '/event' && /^Unknown/.test(item)) return error(400, 'BAD_REQUEST', item, cors);
  if (env.PER_VISITOR) {
    const { success } = await env.PER_VISITOR.limit({ key: request.headers.get('cf-connecting-ip') || 'unknown' });
    if (!success) return error(429, 'RATE_LIMITED', 'Too many requests. Wait a few seconds.', cors);
  }
  const r = await env.PILOT_STORE.get(env.PILOT_STORE.idFromName('pilot')).fetch('https://pilot' + path, { method: 'POST', body: JSON.stringify(path === '/event' ? { key: item } : { row: item, v: PZ.VERSION }) });
  return new Response(null, { status: r.status === 429 ? 429 : 204, headers: cors });
}

/** GET /pilot: the counts and sent results, for the owner only (Authorization: Bearer PILOT_TOKEN). */
async function readPilot(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!env.PILOT_TOKEN || !env.PILOT_STORE || auth !== 'Bearer ' + env.PILOT_TOKEN) return error(404, 'NOT_FOUND', 'Not found.', {});
  const r = await env.PILOT_STORE.get(env.PILOT_STORE.idFromName('pilot')).fetch('https://pilot/read');
  return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

/** One counter for everyone: requests per UTC day, capped at DAILY_LIMIT (0 switches the teammates off). */
export class DailyBudget {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch() {
    const set = this.env.DAILY_LIMIT, limit = set == null || set === '' || isNaN(set) ? 4000 : Number(set), day = new Date().toISOString().slice(0, 10);
    let use = await this.state.storage.get('use');
    if (!use || use.day !== day) use = { day, n: 0 };
    if (use.n >= limit) return new Response('limit', { status: 429 });
    use.n++;
    await this.state.storage.put('use', use);
    return new Response(String(use.n));
  }
}

/** Pilot data: counters by day and kind ('c:' keys) and sent results ('r:' keys, with the UTC day they arrived). */
export class PilotStore {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const S = this.state.storage, path = new URL(request.url).pathname;
    if (path === '/event') {
      const { key } = await request.json(), k = 'c:' + key;
      await S.put(k, ((await S.get(k)) || 0) + 1);
      return new Response(null, { status: 204 });
    }
    if (path === '/result') {
      const n = (await S.get('results')) || 0;
      if (n >= MAX_RESULTS) return new Response('full', { status: 429 });
      const { row, v } = await request.json();
      await S.put('r:' + String(Date.now()).padStart(15, '0') + ':' + Math.random().toString(36).slice(2, 8), { day: new Date().toISOString().slice(0, 10), v, row });
      await S.put('results', n + 1);
      return new Response(null, { status: 204 });
    }
    if (path === '/read') {
      const counts = [...(await S.list({ prefix: 'c:' })).entries()].map(([k, n]) => { const [day, kind, what, engine, done] = k.slice(2).split('|'); return { day, kind, what, engine, done: done == null ? null : +done, n }; });
      const results = [...(await S.list({ prefix: 'r:' })).values()];
      return new Response(JSON.stringify({ counts, results }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('not found', { status: 404 });
  }
}
