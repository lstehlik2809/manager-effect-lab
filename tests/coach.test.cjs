// Checks the chat analysis behind the feedback (src/coach.js) and the scripted teammates (src/scripted.js).
const assert = require('assert');
const PZ = require('../src/puzzles.js');
const C = require('../src/coach.js');
const SCR = require('../src/scripted.js');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
const t1 = PZ.PUZZLES.find(p => p.id === 't1'), s1 = PZ.PUZZLES.find(p => p.id === 's1');
const num = (p, re) => p.clues.find(c => re.test(c.text)).num;
const CAPPING = num(t1, /capping head was replaced/), LABEL_WET = num(t1, /only jams when bottles reach it wet/), DRY = num(t1, /completely dry/);
const AUTO = num(t1, /fully automatic mode all night/), MOTOR = num(t1, /conveyor motor's current log/);

/** Play a chat with the scripted teammates: each leader message gets replies from everyone it reaches. */
function play(p, script) {
  const messages = [], shared = { f1: new Set(), f2: new Set(), f3: new Set() };
  script.forEach(([to, text]) => {
    messages.push({ from: 'leader', to, text });
    (to === 'all' ? ['f1', 'f2', 'f3'] : [to]).forEach(fid => {
      const r = SCR.reply(p, fid, messages, shared[fid]);
      if (r) messages.push({ from: fid, to: 'leader', text: r });
    });
  });
  return messages;
}
const even = [[20, 20, 20, 20, 20], [20, 20, 20, 20, 20]];

check('questions are found with or without a question mark', () => {
  assert(C.isQuestion('Mira, anything on operator error'));
  assert(C.isQuestion('Tell me what you have on the fill valve.'));
  assert(C.isQuestion('Ok team, what do you know'));
  assert(C.isQuestion('Is it the fill valve?'));
  assert(!C.isQuestion('Let\'s decide now.'));
  assert(!C.isQuestion('Thanks Theo.'));
  assert(!C.isQuestion('Please submit when ready'));
});

check('repeated general requests earn no extra credit and are named in the feedback', () => {
  const msgs = play(t1, [['all', 'Please share all your reports.'], ['all', 'Please share all your reports.'], ['all', 'Share all your reports please'], ['all', 'Please share all your reports.']]);
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.questions, 4);
  assert.strictEqual(a.metrics.repeats, 3, 'repeats ' + a.metrics.repeats);
  assert.strictEqual(a.metrics.targeted, 0);
  assert.strictEqual(a.metrics.generic, 1);
  const keys = a.observations.map(o => o.key);
  assert(keys.includes('repeats') && keys.includes('generic'), keys.join(','));
});

check('the same general question to different people is not a repeat', () => {
  const msgs = play(t1, [['f1', 'What do you have?'], ['f2', 'What do you have?'], ['f3', 'What do you have?']]);
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.repeats, 0);
  assert.deepStrictEqual(a.metrics.askedDirect, ['f1', 'f2', 'f3']);
});

check('specific questions, follow-ups and connecting teammates are recognised', () => {
  const msgs = play(t1, [
    ['f2', 'Theo, what do you have on the label applicator?'],
    ['f3', 'Jonas, were the bottles dry when they reached it?'],
    ['all', 'Did the capping head fail?']
  ]);
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.targeted, 3, 'targeted ' + a.metrics.targeted);
  assert(a.metrics.followUps >= 1 && a.metrics.connects >= 1, JSON.stringify(a.metrics));
  assert(a.metrics.surfacedNums.includes(LABEL_WET) && a.metrics.surfacedNums.includes(DRY) && a.metrics.surfacedNums.includes(CAPPING), a.metrics.surfacedNums.join(','));
  assert(a.observations.some(o => o.key === 'best-ask'), 'credits the question that drew out a decisive report');
  assert(a.observations.some(o => o.key === 'connect'));
});

check('missed reports name who held them and what they rule out', () => {
  const msgs = play(t1, [['all', 'Hi team!'], ['f1', 'Mira, anything on the capping head?']]);
  const a = C.analyse(t1, msgs, even);
  const missed = a.observations.filter(o => o.key === 'missed' || o.key === 'missed-2');
  assert(missed.length >= 1, 'has a missed-report tip');
  assert(/(Mira|Theo|Jonas)'s report #\d+/.test(missed[0].text) && /rules? out/.test(missed[0].text) && /Worth \d+ points/.test(missed[0].text), missed[0].text);
  assert(a.observations.some(o => o.key === 'early') === false, 'no time given, so no early-submission tip');
});

check('points split: hidden + use + score = 100, and the best possible answer scores best', () => {
  const msgs = play(t1, [['f1', 'Mira, what about the capping head?']]);
  // the best answer with what the leader has: own reports rule out the conveyor motor (Q1) and a power surge (public, Q2)
  const avail = new Set(t1.clues.filter(c => c.holder === 'leader' || c.holder === 'public').map(c => c.num).concat([CAPPING]));
  const ans = t1.questions.map((q, qi) => { const out = C.ruledOut(t1, qi, avail); const left = [0, 1, 2, 3, 4].filter(k => !out.has(k)); const a = [0, 0, 0, 0, 0]; left.forEach((k, i) => { a[k] = Math.floor(100 / left.length) + (i < 100 % left.length ? 1 : 0); }); return a; });
  const a = C.analyse(t1, msgs, ans);
  a.info.perQ.forEach(x => assert(Math.abs(x.hidden + x.use + x.actual - 100) < 1e-9));
  assert(a.info.use < 1, 'using all gathered reports loses (almost) nothing: ' + a.info.use);
  assert(a.info.hidden > 10, 'hidden reports still cost points');
  assert(a.observations.some(o => o.key === 'used-well'));
});

check('keeping an option your own report rules out is pointed out', () => {
  const a = C.analyse(t1, [], [[20, 20, 20, 20, 20], [0, 100, 0, 0, 0]]);
  const kept = a.observations.find(o => o.key === 'kept');
  assert(kept && kept.text.includes('your report #' + MOTOR) && kept.text.includes('Conveyor motor'), kept && kept.text);
  assert(a.observations.some(o => o.key === 'dropped'), 'zeroing a right answer is pointed out');
  assert(a.observations.some(o => o.key === 'no-questions'));
});

check('solo puzzles get reasoning feedback only', () => {
  const a = C.analyse(s1, [], [[50, 0, 0, 50, 0], [0, 0, 0, 0, 100]]);
  assert(a.observations.some(o => o.key === 'perfect'));
  const b = C.analyse(s1, [], [[20, 20, 20, 20, 20], [0, 0, 0, 0, 100]]);
  assert(b.observations.some(o => o.key === 'kept' && /^The reports rule out/.test(o.text)), b.observations.map(o => o.text).join(' | '));
  assert(!b.observations.some(o => /missed|repeats|generic/.test(o.key)));
});

check('scripted teammates: addressing, topics, report numbers, more, views', () => {
  const sh = () => new Set();
  const m = text => [{ from: 'leader', to: 'all', text }];
  assert.strictEqual(SCR.reply(t1, 'f1', m('Theo, what do you have on the software update?'), sh()), '', 'Mira stays quiet when Theo is named');
  assert(SCR.reply(t1, 'f2', m('Theo, what do you have on the software update?'), sh()).length > 0);
  assert(SCR.reply(t1, 'f1', m('What about the capping head?'), sh()).includes('#' + CAPPING));
  assert(/nothing|don't see/i.test(SCR.reply(t1, 'f2', m('What about the capping head?'), sh())), 'Theo has nothing on the capping head');
  assert(SCR.reply(t1, 'f1', m('Mira, is report #' + AUTO + ' about manual mode?'), sh()).includes('#' + AUTO));
  assert(/^(Hi|Hey|Hello)/.test(SCR.reply(t1, 'f3', m('Hi team!'), sh())));
  // a question asked by its wording gets reports on that question only
  const q1 = SCR.reply(t1, 'f1', m('What do you have on which component failed?'), sh()), q1nums = (q1.match(/#(\d+)/g) || []).map(x => +x.slice(1));
  assert(q1nums.length && q1nums.every(n => t1.clues.find(c => c.num === n).q === 0), q1);
  // "anything else?" carries on, and a teammate with nothing left says so
  const s = sh(), msgs = [{ from: 'leader', to: 'f3', text: 'Jonas, what do you have?' }];
  msgs.push({ from: 'f3', to: 'leader', text: SCR.reply(t1, 'f3', msgs, s) });
  msgs.push({ from: 'leader', to: 'f3', text: 'Anything else?' });
  const r2 = SCR.reply(t1, 'f3', msgs, s);
  assert(/#\d+/.test(r2), r2);
  for (let k = 0; k < 4; k++) { msgs.push({ from: 'f3', to: 'leader', text: SCR.reply(t1, 'f3', msgs, s) }); msgs.push({ from: 'leader', to: 'f3', text: 'Anything else?' }); }
  assert(/everything|nothing more/i.test(SCR.reply(t1, 'f3', msgs, s)));
  assert(/rule out|ruled out|drop/i.test(SCR.reply(t1, 'f1', [{ from: 'leader', to: 'f1', text: 'Mira, what do you think about question 1?' }], sh())));
});

check('summary: specific strengths and tips across puzzles; repeating a request rates lower than asking well', () => {
  const t3 = PZ.PUZZLES.find(p => p.id === 't3');
  const good = [
    { p: t1, script: [['all', 'Hi team, what do you have on question 1?'], ['f2', 'Theo, anything on the label applicator?'], ['f3', 'Jonas, were the bottles dry?'], ['all', 'Anything on operator error or manual mode?']] },
    { p: t3, script: [['all', 'Who has anything on Bruno or the forklift certificate?'], ['f2', 'Theo, what about Daria and Emil?'], ['all', 'When is the fire inspection?']] }
  ].map(x => ({ title: x.p.title, solo: false, analysis: C.analyse(x.p, play(x.p, x.script), even) }));
  const spam = [t1, t3].map(p => ({ title: p.title, solo: false, analysis: C.analyse(p, play(p, [['all', 'Share everything.'], ['all', 'Share everything.'], ['all', 'Share everything.']]), even) }));
  const G = C.summarise(good), X = C.summarise(spam);
  assert(G.strengths.length >= 1 && X.tips.length >= 1);
  assert(X.tips.some(o => o.key === 'repeats') && /Across the test, 4 of your questions repeated/.test(X.tips.find(o => o.key === 'repeats').text), X.tips.map(o => o.text).join(' | '));
  const eff = T => T.targeted + 0.5 * T.generic;
  assert(eff(G.totals) >= 3 && eff(X.totals) <= 0.5, eff(G.totals) + ' vs ' + eff(X.totals));
  assert(G.totals.followUps > X.totals.followUps && G.totals.targetedShare > 0.7, JSON.stringify(G.totals));
});

console.log(failures ? failures + ' check(s) failed' : 'all coach checks passed');
process.exit(failures ? 1 : 0);
