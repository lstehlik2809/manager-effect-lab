// Checks the chat analysis behind the feedback (src/coach.js) and the scripted teammates (src/scripted.js).
const assert = require('assert');
const PZ = require('../src/puzzles.js');
const C = require('../src/coach.js');
const SCR = require('../src/scripted.js');
const S = require('../src/stats.js');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
const t1 = PZ.PUZZLES.find(p => p.id === 't1'), t3 = PZ.PUZZLES.find(p => p.id === 't3'), s1 = PZ.PUZZLES.find(p => p.id === 's1');
const num = (p, re) => p.clues.find(c => re.test(c.text)).num;
// t1: Mira holds the Linden & Sons rule-out and the only report on Dario Ricci; Theo the Bruno Keller rule-out;
// Jonas the Elin Berg (pigment) rule-out. In t3 the leader's own report rules out Clean Rivers Trust.
const LINDEN = num(t1, /made only gilded frames/), DARIO = num(t1, /Dario Ricci taught/), PANELS = num(t1, /only on wooden panels/);
const PIGMENT = num(t1, /blue pigment/), CLEAN = num(t3, /donation last year/);

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
  // requests for reports worded as instructions
  ['Everyone, post your reports.', 'Dump everything you have here.', 'I need all your reports.', 'Your reports, please.', 'Reports please!',
    'Show me what you have.', 'Team, all reports in the chat now.', "Let's hear your reports.", 'Walk me through your reports.',
    'Report in, team.', 'More please.', 'Keep going.', 'Next ones please', 'And the rest.']
    .forEach(s => assert(C.isQuestion(s), s));
  ['The reports point to B.', 'The info is clear now.', 'All reports agree on the valve.', 'More importantly, B is out.', 'I need to think about this.',
    "Don't post anything yet.", 'I read the reports and I think B.', 'Keep it short.', 'Report #12 rules out C.']
    .forEach(s => assert(!C.isQuestion(s), s));
});

check('requests worded as instructions count, so drawing everything out that way is efficient, not "no questions"', () => {
  [['Everyone, post your reports.', 'Keep going.'], ['Dump everything you have here.', 'More please.'], ['Reports please!', 'Next ones please']].forEach(lines => {
    const a = C.analyse(t1, play(t1, lines.map(text => ['all', text])), even);
    assert.strictEqual(a.metrics.surfaced, a.metrics.critical, lines[0] + ': surfaced ' + a.metrics.surfaced);
    assert.strictEqual(a.metrics.questions, 2, lines[0]);
    assert.strictEqual(a.metrics.asksToAll, 2, lines[0]);
    const keys = a.observations.map(o => o.key);
    assert(!keys.includes('no-questions') && keys.includes('all-surfaced'), keys.join(','));
  });
  // a message that is not a request but still drew out decisive reports counts toward the requests it took
  const msgs = [{ from: 'leader', to: 'all', text: 'Hi team.' }].concat(PZ.criticalFollowerClues(t1).map(c => ({ from: c.holder, to: 'leader', text: `#${c.num}: ${c.text}` })));
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.asksToAll, 1);
  assert(!a.observations.some(o => o.key === 'no-questions'), a.observations.map(o => o.key).join(','));
});

check('repeated general requests earn no extra credit and are named in the feedback while reports stay hidden', () => {
  const msgs = play(t1, [['f1', 'Please share all your reports.'], ['f1', 'Please share all your reports.'], ['f1', 'Share all your reports please'], ['f1', 'Please share all your reports.']]);
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.questions, 4);
  assert.strictEqual(a.metrics.repeats, 3, 'repeats ' + a.metrics.repeats);
  assert.strictEqual(a.metrics.targeted, 0);
  assert.strictEqual(a.metrics.generic, 1);
  assert(a.metrics.missedNums.length > 0, 'Theo and Jonas were never asked');
  const keys = a.observations.map(o => o.key);
  assert(keys.includes('repeats') && keys.includes('generic'), keys.join(','));
});

check('broad requests that draw out every decisive report are praised as efficient, not second-guessed', () => {
  const results = [t1, t3].map(p => {
    const msgs = play(p, [['all', 'Please share all your reports.'], ['all', 'Please share all your reports.']]);
    const a = C.analyse(p, msgs, even);
    assert.strictEqual(a.metrics.surfaced, a.metrics.critical, p.id + ': two broad requests draw out everything from the scripted teammates');
    assert.strictEqual(a.metrics.asksToAll, 2, p.id + ' asksToAll ' + a.metrics.asksToAll);
    const all = a.observations.find(o => o.key === 'all-surfaced');
    assert(all && /after just two requests/.test(all.text) && /Efficient/.test(all.text), all && all.text);
    assert(!a.observations.some(o => ['generic', 'repeats', 'missed', 'offer', 'early'].includes(o.key)), a.observations.map(o => o.key).join(','));
    return { title: p.title, solo: false, analysis: a };
  });
  const S = C.summarise(results), hb = C.habits(S.totals), style = C.leaderStyle(hb, S.totals);
  assert(/both team puzzles, each time after at most two requests/.test(S.strengths.find(o => o.key === 'all-surfaced').text), S.strengths.map(o => o.text).join(' | '));
  assert(!S.tips.some(o => ['generic', 'repeats'].includes(o.key)), S.tips.map(o => o.key).join(','));
  assert.deepStrictEqual(hb.map(x => x.rating), ['efficient', 'efficient', 'strong']);
  const said = [style.text].concat(S.tips.map(o => o.text), hb.map(x => x.note)).join(' ');
  assert(!/faster|sooner|quicker|would have|options still standing/i.test(said), said);
  assert(/efficient/i.test(style.text), style.text);
  // with something still hidden, the advice to ask about the options still standing returns
  const part = C.habits(Object.assign({}, S.totals, { surfaced: S.totals.critical - 1 }));
  assert(part.slice(0, 2).every(x => x.rating !== 'efficient'), part.map(x => x.rating).join(','));
});

check('a message to everyone that mentions a teammate is not a question to that teammate', () => {
  const aud = text => C.audienceOf({ from: 'leader', to: 'all', text }).join(',');
  const ALL = 'f1,f2,f3';
  // mentioned, not addressed
  assert.strictEqual(aud('Theo mentioned that Bruno Keller painted on panels. Was the portrait on canvas?'), ALL);
  assert.strictEqual(aud('Theo said it is on canvas - does anyone know about the pigment?'), ALL);
  assert.strictEqual(aud('What did Theo say about Bruno Keller?'), ALL);
  assert.strictEqual(aud('Do you agree with Theo?'), ALL);
  assert.strictEqual(aud('Is Theo\'s report about the update?'), ALL);
  assert.strictEqual(aud('Can someone ask Theo about it?'), ALL);
  assert.strictEqual(aud('Thanks Theo. Was it on canvas?'), ALL);
  assert.strictEqual(aud('Mira, what do you have? Anyone else?'), ALL);
  // addressed
  assert.strictEqual(aud('Theo, what do you have on Bruno Keller?'), 'f2');
  assert.strictEqual(aud('What do you have on Bruno Keller, Theo?'), 'f2');
  assert.strictEqual(aud('Hi Theo! Anything on Oakley Brothers?'), 'f2');
  assert.strictEqual(aud('Theo what do you have?'), 'f2');
  assert.strictEqual(aud('Jonas were the frames gilded?'), 'f3');
  assert.strictEqual(aud('What about you Theo?'), 'f2');
  assert.strictEqual(aud('@Jonas can you check the pigment report'), 'f3');
  assert.strictEqual(aud('Theo, thanks. Anything else?'), 'f2');
  assert.strictEqual(aud('Thanks Theo! Mira, what about Linden & Sons?'), 'f1');
  assert.strictEqual(aud('Mira and Jonas, anything on Elin Berg?'), 'f1,f3');
  assert.strictEqual(aud('Hi team, Theo what do you have?'), 'f2');
  assert.strictEqual(C.audienceOf({ from: 'leader', to: 'f1', text: 'Theo said so. Agree?' }).join(','), 'f1');

  // the feedback: a broadcast that mentions Theo reaches everyone and is not a direct question to Theo
  const msgs = play(t1, [['f2', 'Theo, anything on Bruno Keller?'], ['all', 'Theo said the portrait is on canvas. Does anyone have anything on the pigment in the paint?']]);
  const a = C.analyse(t1, msgs, even);
  assert.deepStrictEqual(a.metrics.askedDirect, ['f2']);
  assert.deepStrictEqual(a.metrics.askedAny, ['f1', 'f2', 'f3']);
  assert.strictEqual(a.metrics.broadcast, 1);
  assert(a.metrics.surfacedNums.includes(PIGMENT), 'Jonas answered the broadcast: ' + a.metrics.surfacedNums.join(','));
  // and the scripted teammates answer it rather than leaving it to Theo
  assert(SCR.reply(t1, 'f3', [{ from: 'leader', to: 'all', text: 'Theo said the portrait is on canvas. Does anyone have anything on the pigment?' }], new Set()).includes('#' + PIGMENT));
});

check('the same general question to different people is not a repeat', () => {
  const msgs = play(t1, [['f1', 'What do you have?'], ['f2', 'What do you have?'], ['f3', 'What do you have?']]);
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.repeats, 0);
  assert.deepStrictEqual(a.metrics.askedDirect, ['f1', 'f2', 'f3']);
});

check('specific questions, follow-ups and connecting teammates are recognised', () => {
  const msgs = play(t1, [
    ['f2', 'Theo, what do you have on Bruno Keller?'],
    ['f3', 'Jonas, Theo says the portrait is on canvas. Does that fit anything on the pigment?'],
    ['all', 'Who has anything on Linden & Sons?']
  ]);
  const a = C.analyse(t1, msgs, even);
  assert.strictEqual(a.metrics.targeted, 3, 'targeted ' + a.metrics.targeted);
  assert(a.metrics.followUps >= 1 && a.metrics.connects >= 1, JSON.stringify(a.metrics));
  assert(a.metrics.surfacedNums.includes(PANELS) && a.metrics.surfacedNums.includes(PIGMENT) && a.metrics.surfacedNums.includes(LINDEN), a.metrics.surfacedNums.join(','));
  assert(a.observations.some(o => o.key === 'best-ask'), 'credits the question that drew out a decisive report');
  assert(a.observations.some(o => o.key === 'connect'));
});

check('missed reports name who held them and what they rule out', () => {
  const msgs = play(t1, [['all', 'Hi team!'], ['f1', 'Mira, anything on Pellow Workshop?']]);
  const a = C.analyse(t1, msgs, even);
  const missed = a.observations.filter(o => o.key === 'missed' || o.key === 'missed-2');
  assert(missed.length >= 1, 'has a missed-report tip');
  assert(/(Mira|Theo|Jonas)'s report #\d+/.test(missed[0].text) && /rules? out/.test(missed[0].text) && /Worth \d+ points/.test(missed[0].text), missed[0].text);
  assert(a.observations.some(o => o.key === 'early') === false, 'no time given, so no early-submission tip');
});

check('points split: hidden + use + score = 100, and the best possible answer scores best', () => {
  const msgs = play(t1, [['f1', 'Mira, what about Linden & Sons?']]);
  // the best answer with what the leader has: in t1 the leader's and the shared reports rule nothing out, Mira's rules out Linden & Sons
  const avail = new Set(t1.clues.filter(c => c.holder === 'leader' || c.holder === 'public').map(c => c.num).concat([LINDEN]));
  const ans = t1.questions.map((q, qi) => { const out = C.ruledOut(t1, qi, avail); const left = [0, 1, 2, 3, 4].filter(k => !out.has(k)); const a = [0, 0, 0, 0, 0]; left.forEach((k, i) => { a[k] = Math.floor(100 / left.length) + (i < 100 % left.length ? 1 : 0); }); return a; });
  const a = C.analyse(t1, msgs, ans);
  a.info.perQ.forEach(x => assert(Math.abs(x.hidden + x.use + x.actual - 100) < 1e-9));
  assert(a.info.use < 1, 'using all gathered reports loses (almost) nothing: ' + a.info.use);
  assert(a.info.hidden > 10, 'hidden reports still cost points');
  assert(a.observations.some(o => o.key === 'used-well'));
});

check('keeping an option your own report rules out is pointed out', () => {
  const a = C.analyse(t3, [], [[20, 20, 20, 20, 20], [100, 0, 0, 0, 0]]);
  const kept = a.observations.find(o => o.key === 'kept');
  assert(kept && kept.text.includes('your report #' + CLEAN) && kept.text.includes('Clean Rivers Trust'), kept && kept.text);
  assert(a.observations.some(o => o.key === 'dropped'), 'zeroing a right answer is pointed out');
  assert(a.observations.some(o => o.key === 'no-questions'));
});

check('solo puzzles get reasoning feedback only', () => {
  const right = s1.questions.map(q => S.correctDist(q.answer, 5));
  const a = C.analyse(s1, [], right);
  assert(a.observations.some(o => o.key === 'perfect'));
  const b = C.analyse(s1, [], [[20, 20, 20, 20, 20], right[1]]);
  assert(b.observations.some(o => o.key === 'kept' && /^The reports rule out/.test(o.text)), b.observations.map(o => o.text).join(' | '));
  assert(!b.observations.some(o => /missed|repeats|generic/.test(o.key)));
});

check('scripted teammates: addressing, topics, report numbers, more, views', () => {
  const sh = () => new Set();
  const m = text => [{ from: 'leader', to: 'all', text }];
  assert.strictEqual(SCR.reply(t1, 'f1', m('Theo, what do you have on Clara Moss?'), sh()), '', 'Mira stays quiet when Theo is named');
  assert(SCR.reply(t1, 'f2', m('Theo, what do you have on Clara Moss?'), sh()).length > 0);
  assert(SCR.reply(t1, 'f1', m('What about Linden & Sons?'), sh()).includes('#' + LINDEN));
  assert(SCR.reply(t1, 'f1', m('What about Dario Ricci?'), sh()).includes('#' + DARIO));
  assert(/nothing|don't see/i.test(SCR.reply(t1, 'f2', m('What about Dario Ricci?'), sh())), 'Theo has nothing on Dario Ricci');
  assert(SCR.reply(t1, 'f1', m('Mira, is report #' + LINDEN + ' about gilded frames?'), sh()).includes('#' + LINDEN));
  assert(/^(Hi|Hey|Hello)/.test(SCR.reply(t1, 'f3', m('Hi team!'), sh())));
  // a question asked by its wording gets reports on that question only
  const q1 = SCR.reply(t1, 'f1', m('What do you have on which artists could have painted it?'), sh()), q1nums = (q1.match(/#(\d+)/g) || []).map(x => +x.slice(1));
  assert(q1nums.length && q1nums.every(n => t1.clues.find(c => c.num === n).q === 0), q1);
  // "anything else?" carries on, and a teammate with nothing left says so
  const s = sh(), msgs = [{ from: 'leader', to: 'f3', text: 'Jonas, what do you have?' }];
  msgs.push({ from: 'f3', to: 'leader', text: SCR.reply(t1, 'f3', msgs, s) });
  msgs.push({ from: 'leader', to: 'f3', text: 'Anything else?' });
  const r2 = SCR.reply(t1, 'f3', msgs, s);
  assert(/#\d+/.test(r2), r2);
  for (let k = 0; k < 4; k++) { msgs.push({ from: 'f3', to: 'leader', text: SCR.reply(t1, 'f3', msgs, s) }); msgs.push({ from: 'leader', to: 'f3', text: 'Anything else?' }); }
  assert(/everything|nothing more/i.test(SCR.reply(t1, 'f3', msgs, s)));
  assert(/rule out|ruled out|drop/i.test(SCR.reply(t1, 'f1', [{ from: 'leader', to: 'f1', text: 'Mira, what do you think about question 2?' }], sh())));
});

check('summary: specific strengths and tips across puzzles; repeating a request rates lower than asking well', () => {
  const good = [
    { p: t1, script: [['all', 'Hi team, what do you have on question 1?'], ['f2', 'Theo, anything on Bruno Keller?'], ['f3', 'Jonas, anything on Elin Berg or the pigment?'], ['all', 'Anything on Linden & Sons, Oakley Brothers or Marlow Frames?']] },
    { p: t3, script: [['all', 'Who has anything on Ashford Park or Brookside Park?'], ['f1', 'Mira, what about Elmwood Common?'], ['all', 'Anything on Youth Sports Fund, Animal Rescue League or Elder Care Network?']] }
  ].map(x => ({ title: x.p.title, solo: false, analysis: C.analyse(x.p, play(x.p, x.script), even) }));
  const spam = [t1, t3].map(p => ({ title: p.title, solo: false, analysis: C.analyse(p, play(p, [['f1', 'Share everything.'], ['f1', 'Share everything.'], ['f1', 'Share everything.']]), even) }));
  const G = C.summarise(good), X = C.summarise(spam);
  assert(G.strengths.length >= 1 && X.tips.length >= 1);
  assert(X.tips.some(o => o.key === 'repeats') && /Across the test, 4 of your questions repeated/.test(X.tips.find(o => o.key === 'repeats').text), X.tips.map(o => o.text).join(' | '));
  const eff = T => T.targeted + 0.5 * T.generic;
  assert(eff(G.totals) >= 3 && eff(X.totals) <= 0.5, eff(G.totals) + ' vs ' + eff(X.totals));
  assert(G.totals.followUps > X.totals.followUps && G.totals.targetedShare > 0.7, JSON.stringify(G.totals));
});

console.log(failures ? failures + ' check(s) failed' : 'all coach checks passed');
process.exit(failures ? 1 : 0);
