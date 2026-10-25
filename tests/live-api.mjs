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
const P = id => PZ.PUZZLES.find(p => p.id === id), F = id => PZ.FOLLOWERS.find(f => f.id === id);
const puzzle = P('t1'), mira = F('f1');
const num = (p, re) => p.clues.find(c => re.test(c.text)).num;
const linden = num(puzzle, /made only gilded frames/), pellow = num(puzzle, /Pellow Workshop made frames/);
const cites = t => (t.match(/#(\d+)/g) || []).map(x => +x.slice(1));
const caseFile = p => 'Here is the case file: ' + p.questions.map(q => q.facts.map(f => f.text).join(' ')).join(' ') + ' Which of your reports rule out an option?';
// the twists, as a test might draw them: Jonas holds back in t1, Theo misreads a report in t2; Mira is worried,
// Theo misquotes a shared report or disputes a rule-out in t1
const quietT1 = PZ.withTwist(puzzle, { kind: 'quiet', fid: 'f3' }), t2 = PZ.withTwist(P('t2'), { kind: 'sure', fid: 'f2', i: 0 });
const sure = t2.dynamics.sure, jonas = F('f3'), theo = F('f2');
const jonasOut = PZ.criticalFollowerClues(puzzle).filter(c => c.holder === jonas.id).map(c => c.num);
const anxT1 = PZ.withTwist(puzzle, { kind: 'anxious', fid: 'f1' }), mqT1 = PZ.withTwist(puzzle, { kind: 'misquote', fid: 'f2', i: 0 }), dpT1 = PZ.withTwist(puzzle, { kind: 'dispute', fid: 'f2', i: 0 });
const mq = mqT1.dynamics.misquote, dp = dpT1.dynamics.dispute;

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
  { name: 'names the clash once told a case fact', messages: [{ role: 'user', content: '[Leader, to everyone] The case file says the frame is plain dark wood, with no gilding. Do any of your reports rule out a workshop?' }], expect: t => cites(t).includes(linden) && /Linden/.test(t) },
  { name: 'quiet Jonas holds back when the leader writes to everyone', p: quietT1, f: jonas, messages: [{ role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) }], expect: t => !cites(t).length },
  { name: 'quiet Jonas opens up when addressed by name', p: quietT1, f: jonas, messages: [
      { role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) },
      { role: 'assistant', content: 'I\'ll let the others go first.' },
      { role: 'user', content: '[Leader, to everyone] Jonas, what about yours? Do any clash with the case file?' }], expect: t => cites(t).some(n => jonasOut.includes(n)) },
  { name: 'overconfident Theo claims the clash once told the case fact', p: t2, f: theo, messages: [{ role: 'user', content: '[Leader, to everyone] ' + caseFile(t2) }], expect: t => cites(t).includes(sure.num) && /strawberr/i.test(t) },
  { name: 'overconfident Theo drops the claim when questioned', p: t2, f: theo, messages: [
      { role: 'user', content: '[Leader, to everyone] ' + caseFile(t2) },
      { role: 'assistant', content: `Report #${sure.num} rules out Strawberries: ${sure.says}.` },
      { role: 'user', content: '[Leader, to you] Are you sure? The beds are 40 cm deep, so 15 cm roots fit easily.' }], expect: t => /right|doesn'?t|does not|not rule|stay|mistake|fair|misread|good point/i.test(t) },
  // the newer twists
  { name: 'worried Mira holds back even when asked by name', p: anxT1, f: mira, messages: [
      { role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) },
      { role: 'assistant', content: 'I have a few, but I\'m worried I\'ll get them wrong and send us the wrong way.' },
      { role: 'user', content: '[Leader, to you] Mira, what about yours?' }], expect: t => !cites(t).length },
  { name: 'worried Mira opens up once reassured', p: anxT1, f: mira, messages: [
      { role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) },
      { role: 'assistant', content: 'I have a few, but I\'m worried I\'ll get them wrong and send us the wrong way.' },
      { role: 'user', content: '[Leader, to you] No worries, Mira, any info helps, and we\'ll check it together. Do any of yours clash with the case file?' }], expect: t => cites(t).includes(linden) },
  { name: 'Theo quotes his misremembered copy as a clash', p: mqT1, f: theo, messages: [{ role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) }], expect: t => cites(t).includes(mq.num) && /clara/i.test(t) },
  { name: 'Theo accepts the real wording of the shared report', p: mqT1, f: theo, messages: [
      { role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) },
      { role: 'assistant', content: `Report #${mq.num} rules out Clara Moss: ${mq.misquote}` },
      { role: 'user', content: `[Leader, to you] Theo, my copy of #${mq.num} reads "Clara Moss painted in oils from 1955 onwards". Can you check yours?` }], expect: t => /misread|right|sorry|my (bad|mistake)|stays|doesn'?t|does not|1955/i.test(t) && !/still rules out/i.test(t) },
  { name: 'Theo argues Linden & Sons stays in once told the case facts', p: dpT1, f: theo, messages: [{ role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) }], expect: t => cites(t).includes(dp.num) && /linden/i.test(t) },
  { name: 'Theo gives way when shown the evidence', p: dpT1, f: theo, messages: [
      { role: 'user', content: '[Leader, to everyone] ' + caseFile(puzzle) },
      { role: 'assistant', content: `Linden & Sons should stay in: report #${dp.num} says they left some frames without a label, so an unlabelled frame could still be theirs.` },
      { role: 'user', content: '[Leader, to you] Theo, Mira\'s report says Linden & Sons made only gilded frames, and ours has no gilding. Doesn\'t that rule them out?' }], expect: t => /right|fair|agree|out|good point|makes sense/i.test(t) && !/stay in|keep (them|it|linden)/i.test(t) }
];

async function askGemini(messages, system) {
  const t0 = Date.now(); let first = null;
  const r = await LLM.geminiStream({ apiKey: process.env.GEMINI_API_KEY, model: LLM.GEMINI_MODEL, system, messages, onText: () => { if (first === null) first = Date.now() - t0; } });
  return { text: r.text.trim(), first, total: Date.now() - t0, stop: r.finish, inTok: r.usage ? r.usage.promptTokenCount : 0, outTok: r.usage ? (r.usage.candidatesTokenCount || 0) + (r.usage.thoughtsTokenCount || 0) : 0 };
}

let anthropic = null;
async function askAnthropic(messages, model, system) {
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
  else if (p === 'anthropic') ['claude-haiku-5-5', 'claude-opus-5-5'].forEach(m => runs.push({ label: m, env: 'ANTHROPIC_API_KEY', ask: (msgs, system) => askAnthropic(msgs, m, system) }));
  else { console.error('Unknown provider ' + p); process.exit(1); }
}

let failures = 0, inTok = 0, outTok = 0;
for (const run of runs) {
  console.log('\n== ' + run.label);
  if (!process.env[run.env]) { console.log('skipped: ' + run.env + ' is not set'); failures++; continue; }
  for (const sc of scenarios) {
    const p = sc.p || puzzle, f = sc.f || mira;
    try {
      const r = await run.ask(sc.messages, PZ.followerBrief(p, f));
      inTok += r.inTok; outTok += r.outTok;
      const own = new Set(PZ.cluesFor(p, f.id).map(c => c.num));
      const invented = cites(r.text).filter(n => !own.has(n));
      const ok = sc.expect(r.text) && !invented.length;
      if (!ok) failures++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${sc.name} · first text ${r.first ?? '-'} ms, total ${r.total} ms, ${r.inTok} in / ${r.outTok} out, finish ${r.stop}`);
      console.log('     "' + r.text.replace(/\s+/g, ' ') + '"' + (invented.length ? `  <- cites reports ${f.name} does not hold: ` + invented.join(', ') : ''));
    } catch (e) {
      failures++;
      console.log(`FAIL ${sc.name} · ${e.code || (e.constructor && e.constructor.name)} ${e.status || ''} ${e.reason || ''} ${e.message || ''}`);
    }
  }
}
console.log(`\n${failures ? failures + ' check(s) failed' : 'all live checks passed'} · ${inTok} input and ${outTok} output tokens in total`);
process.exit(failures ? 1 : 0);
