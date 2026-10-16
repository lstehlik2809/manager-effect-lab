// Hosted AI teammates for the Manager Effect Lab leadership test (Cloudflare Worker).
// Visitors need no API key: the worker holds one Gemini key as a secret and plays only the test's
// teammates. It builds each teammate's brief itself from the puzzle and teammate ids (the same
// followerBrief and request settings as the browser), so it cannot be used as a general-purpose
// model proxy. It caps requests per visitor per minute and for everyone per day.
import PZ from '../src/puzzles.js';
import LLM from '../src/llm.js';

const MAX_BODY = 64 * 1024, MAX_TURNS = 80, MAX_USER = 4000, MAX_REPLY = 2000, MAX_TOTAL = 40000;

const error = (status, reason, message, cors) => new Response(JSON.stringify({ error: { code: status, status: reason, message } }),
  { status, headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, cors) });

function validate(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  const p = PZ.PUZZLES.find(x => x.id === body.puzzle && !x.solo), f = PZ.FOLLOWERS.find(x => x.id === body.follower);
  if (!p || !f) return 'Unknown puzzle or teammate.';
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
  return { p, f, msgs: msgs.map(m => ({ role: m.role, content: m.content })) };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' }
      : { vary: 'Origin' };
    if (new URL(request.url).pathname !== '/reply') return error(404, 'NOT_FOUND', 'Not found.', cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors['access-control-allow-origin'] ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return error(405, 'METHOD', 'Use POST.', cors);
    if (!cors['access-control-allow-origin']) return error(403, 'ORIGIN', 'This page may not use the hosted teammates.', cors);
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
