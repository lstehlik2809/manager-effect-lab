// Live check of the AI-teammate requests the app sends (same client code, prompt and parameters).
// Usage: node --env-file=path/to/.env tests/live-api.mjs [gemini] [anthropic]
//   gemini    (default) uses GEMINI_API_KEY and src/llm.js, exactly as the browser does
//   anthropic uses ANTHROPIC_API_KEY and @anthropic-ai/sdk with the app's request settings
// Spends a little API usage. Keys are read from the environment and never printed.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PZ = require('../src/puzzles.js');
const LLM = require('../src/llm.js');

const providers = process.argv.slice(2).length ? process.argv.slice(2) : ['gemini'];
const puzzle = PZ.PUZZLES.find(p => p.id === 't1');
const mira = PZ.FOLLOWERS[0];
const own = new Set(PZ.cluesFor(puzzle, mira.id).map(c => c.num));
const num = re => PZ.cluesFor(puzzle, mira.id).find(c => re.test(c.text)).num;
const linden = num(/made only gilded frames/), pellow = num(/Pellow Workshop made frames/);
const system = PZ.followerBrief(puzzle, mira);
const cites = t => (t.match(/#(\d+)/g) || []).map(x => +x.slice(1));

const scenarios = [
  { name: 'answers a team question', messages: [{ role: 'user', content: '[Leader, to everyone] Hi team! What do your reports say about Linden & Sons?' }], expect: t => t.includes('#' + linden) },
  { name: 'follows up in a thread', messages: [
      { role: 'user', content: '[Leader, to everyone] Hi team! What do your reports say about Linden & Sons?' },
      { role: 'assistant', content: `Report #${linden} says Linden & Sons made only gilded frames.` },
      { role: 'user', content: '[Leader, to you] Thanks Mira. Anything about Pellow Workshop?' }], expect: t => t.includes('#' + pellow) },
  { name: 'passes when another teammate is addressed', messages: [{ role: 'user', content: '[Leader, to everyone] Theo, what do you have on Clara Moss?' }], expect: t => /^PASS\b/i.test(t.trim()) },
  { name: 'shares at most two reports at a time', messages: [{ role: 'user', content: '[Leader, to everyone] Please share all your reports.' }], expect: t => (t.match(/#\d+/g) || []).length <= 2 },
  // without the case file a teammate can't tell which of its reports matter; with it, it names the clash
  { name: 'can\'t pick out rule-outs without the case facts', messages: [{ role: 'user', content: '[Leader, to everyone] Please share every report you hold that rules out an option.' }], expect: t => !cites(t).includes(linden) },
  { name: 'names the clash once told a case fact', messages: [{ role: 'user', content: '[Leader, to everyone] The case file says the frame is plain dark wood, with no gilding. Do any of your reports rule out a workshop?' }], expect: t => cites(t).includes(linden) && /Linden/.test(t) }
];

async function askGemini(messages) {
  const t0 = Date.now(); let first = null;
  const r = await LLM.geminiStream({ apiKey: process.env.GEMINI_API_KEY, model: LLM.GEMINI_MODEL, system, messages, onText: () => { if (first === null) first = Date.now() - t0; } });
  return { text: r.text.trim(), first, total: Date.now() - t0, stop: r.finish, inTok: r.usage ? r.usage.promptTokenCount : 0, outTok: r.usage ? (r.usage.candidatesTokenCount || 0) + (r.usage.thoughtsTokenCount || 0) : 0 };
}

let anthropic = null;
async function askAnthropic(messages, model) {
  if (!anthropic) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); anthropic = new Anthropic(); }
  const params = { model, max_tokens: 4000, system, messages, output_config: { effort: 'low' } };
  const t0 = Date.now(); let first = null;
  const stream = model === 'claude-haiku-5-5'
    ? anthropic.messages.stream(params)
    : anthropic.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  stream.on('text', () => { if (first === null) first = Date.now() - t0; });
  const msg = await stream.finalMessage();
  let text = '';
  for (const b of msg.content) { if (b.type === 'fallback') text = ''; else if (b.type === 'text') text += b.text; }
  return { text: text.trim(), first, total: Date.now() - t0, stop: msg.stop_reason, inTok: msg.usage.input_tokens, outTok: msg.usage.output_tokens };
}

const runs = [];
for (const p of providers) {
  if (p === 'gemini') runs.push({ label: LLM.GEMINI_MODEL, env: 'GEMINI_API_KEY', ask: askGemini });
  else if (p === 'anthropic') ['claude-haiku-5-5', 'claude-opus-5-5'].forEach(m => runs.push({ label: m, env: 'ANTHROPIC_API_KEY', ask: msgs => askAnthropic(msgs, m) }));
  else { console.error('Unknown provider ' + p); process.exit(1); }
}

let failures = 0, inTok = 0, outTok = 0;
for (const run of runs) {
  console.log('\n== ' + run.label);
  if (!process.env[run.env]) { console.log('skipped: ' + run.env + ' is not set'); failures++; continue; }
  for (const sc of scenarios) {
    try {
      const r = await run.ask(sc.messages);
      inTok += r.inTok; outTok += r.outTok;
      const cited = (r.text.match(/#(\d+)/g) || []).map(x => +x.slice(1));
      const invented = cited.filter(n => !own.has(n));
      const ok = sc.expect(r.text) && !invented.length;
      if (!ok) failures++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${sc.name} · first text ${r.first ?? '-'} ms, total ${r.total} ms, ${r.inTok} in / ${r.outTok} out, finish ${r.stop}`);
      console.log('     "' + r.text.replace(/\s+/g, ' ') + '"' + (invented.length ? '  <- cites reports Mira does not hold: ' + invented.join(', ') : ''));
    } catch (e) {
      failures++;
      console.log(`FAIL ${sc.name} · ${e.code || (e.constructor && e.constructor.name)} ${e.status || ''} ${e.reason || ''} ${e.message || ''}`);
    }
  }
}
console.log(`\n${failures ? failures + ' check(s) failed' : 'all live checks passed'} · ${inTok} input and ${outTok} output tokens in total`);
process.exit(failures ? 1 : 0);
