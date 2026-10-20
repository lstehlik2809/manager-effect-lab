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
const find = id => PZ.PUZZLES.find(p => p.id === id);
// The chat mechanics are checked on copies without the puzzles' twists (a quiet or an overconfident teammate);
// the twists have their own checks at the end.
const plain = p => Object.assign({}, p, { dynamics: {} });
const T1 = find('t1'), T2 = find('t2'), T4 = find('t4'), t1 = plain(T1), t3 = plain(find('t3')), s1 = find('s1');
const num = (p, re) => p.clues.find(c => re.test(c.text)).num;
// t1: Mira holds the Linden & Sons rule-out and a report on Dario Ricci; Theo the Bruno Keller rule-out;
// Jonas the Elin Berg rule-out (against the pigment case fact). In t3 the leader's own report rules out Clean Rivers Trust.
const LINDEN = num(t1, /made only gilded frames/), DARIO = num(t1, /Dario Ricci painted on canvas/), PANELS = num(t1, /only on wooden panels/);
const PIGMENT = num(t1, /died in 1948/), CLEAN = num(t3, /donation last year/);
const caseFile = p => 'Here is what the case file says. ' + p.questions.map(q => q.facts.map(f => f.text).join(' ')).join(' ');

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
/** The best answer possible with the leader's own and shared reports plus those the teammates cited. */
function bestAnswer(p, msgs) {
  const avail = new Set(p.clues.filter(c => c.holder === 'leader' || c.holder === 'public').map(c => c.num));
  msgs.filter(m => m.from !== 'leader').forEach(m => C.reportNums(m.text).forEach(n => avail.add(n)));
  return p.questions.map((q, qi) => { const out = C.ruledOut(p, qi, avail); const left = [0, 1, 2, 3, 4].filter(k => !out.has(k)); const a = [0, 0, 0, 0, 0]; left.forEach((k, i) => { a[k] = Math.floor(100 / left.length) + (i < 100 % left.length ? 1 : 0); }); return a; });
}

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

check('requests worded as instructions count, so collecting everything that way is not "no questions"', () => {
  [['Everyone, post your reports.', 'Keep going.'], ['Dump everything you have here.', 'More please.'], ['Reports please!', 'Next ones please']].forEach(lines => {
    // each teammate holds 8 reports and passes on two at a time: four requests to collect everything
    const a = C.analyse(t1, play(t1, lines.concat([lines[1], lines[1]]).map(text => ['all', text])), even);
    assert.strictEqual(a.metrics.surfaced, a.metrics.critical, lines[0] + ': surfaced ' + a.metrics.surfaced);
    assert.strictEqual(a.metrics.questions, 4, lines[0]);
    assert(a.metrics.asksToAll >= 3 && a.metrics.asksToAll <= 4, lines[0] + ' asksToAll ' + a.metrics.asksToAll);
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

check('one broad request for "every report that rules out an option" no longer draws out the puzzle', () => {
  [t1, t3].forEach(p => {
    const msgs = play(p, [['all', 'Please share every report you hold that rules out an option.']]);
    const a = C.analyse(p, msgs, even);
    assert.strictEqual(a.metrics.surfaced, 0, p.id + ': teammates without the case file cannot tell which reports matter');
    assert(msgs.filter(m => m.from !== 'leader').every(m => /case/i.test(m.text)), 'teammates say they need the case details');
    assert(a.observations.some(o => o.key === 'no-context'), a.observations.map(o => o.key).join(','));
  });
});

check('sharing the case facts draws out every decisive report in one request and is praised as efficient, not second-guessed', () => {
  const results = [t1, t3].map(p => {
    const msgs = play(p, [['all', caseFile(p) + ' Which of your reports rule out an option?']]);
    const a = C.analyse(p, msgs, even);
    assert.strictEqual(a.metrics.surfaced, a.metrics.critical, p.id + ': the case facts let every teammate pick out its decisive reports');
    assert.strictEqual(a.metrics.asksToAll, 1, p.id + ' asksToAll ' + a.metrics.asksToAll);
    assert.strictEqual(a.metrics.factsShared, a.metrics.factsNeeded);
    const all = a.observations.find(o => o.key === 'all-surfaced');
    assert(all && /after just one request/.test(all.text) && /Efficient/.test(all.text), all && all.text);
    assert(a.observations.some(o => o.key === 'context'));
    assert(!a.observations.some(o => ['generic', 'repeats', 'missed', 'offer', 'early', 'no-context', 'slow'].includes(o.key)), a.observations.map(o => o.key).join(','));
    return { title: p.title, solo: false, analysis: a };
  });
  const S = C.summarise(results), hb = C.habits(S.totals), style = C.leaderStyle(hb, S.totals);
  assert(/both team puzzles, each time after at most one request/.test(S.strengths.find(o => o.key === 'all-surfaced').text), S.strengths.map(o => o.text).join(' | '));
  assert(S.strengths.some(o => o.key === 'context' && /both team puzzles/.test(o.text)), S.strengths.map(o => o.text).join(' | '));
  assert(!S.tips.some(o => ['generic', 'repeats', 'no-context', 'slow'].includes(o.key)), S.tips.map(o => o.key).join(','));
  assert.deepStrictEqual(hb.map(x => x.rating), ['efficient', 'efficient', 'strong']);
  const said = [style.text].concat(S.tips.map(o => o.text), hb.map(x => x.note)).join(' ');
  assert(!/faster|sooner|quicker|would have|options still standing/i.test(said), said);
  assert.strictEqual(style.name, 'The Briefer');
  assert(/efficient/i.test(style.text), style.text);
  // with something still hidden, the advice to ask about the options still standing returns
  const part = C.habits(Object.assign({}, S.totals, { surfaced: S.totals.critical - 1 }));
  assert(part.slice(0, 2).every(x => x.rating !== 'efficient'), part.map(x => x.rating).join(','));
});

check('collecting everything without the case facts works but takes longer, and the feedback says so', () => {
  const results = [t1, t3].map(p => {
    const a = C.analyse(p, play(p, [['all', 'Please share all your reports.'], ['all', 'Keep going.'], ['all', 'Keep going.'], ['all', 'Keep going.']]), even);
    assert.strictEqual(a.metrics.surfaced, a.metrics.critical, p.id);
    const slow = a.observations.find(o => o.key === 'slow');
    assert(slow && /case facts/.test(slow.text), a.observations.map(o => o.key).join(','));
    return { title: p.title, solo: false, analysis: a };
  });
  const S = C.summarise(results), style = C.leaderStyle(C.habits(S.totals), S.totals);
  assert.strictEqual(style.name, 'The Collector');
  assert(!/nothing left to ask/.test(style.text) && /case file/.test(style.text), style.text);
});

check('the leadership style claims only what the chat shows', () => {
  const T = { critical: 9, surfaced: 9, targetedShare: 1, followUps: 0, contextPuzzles: 0, quickPuzzles: 2, puzzles: 2, repeats: 0, questions: 5 };
  const hb = r => r.map(rating => ({ rating }));
  // asked specific questions but never followed up: no claim about building on answers
  const noFollow = C.leaderStyle(hb(['strong', 'efficient', 'strong']), T);
  assert.strictEqual(noFollow.name, 'The Facilitator');
  assert(!/built on/.test(noFollow.text), noFollow.text);
  const withFollow = C.leaderStyle(hb(['strong', 'strong', 'strong']), Object.assign({}, T, { followUps: 2 }));
  assert(/built on your teammates' answers/.test(withFollow.text), withFollow.text);
  // asked, but little came back: not "you leaned on your own clues"
  const asked = C.leaderStyle(hb(['little', 'little', 'little']), Object.assign({}, T, { surfaced: 0, questions: 1 }));
  assert.strictEqual(asked.name, 'The Delegator');
  const silent = C.leaderStyle(hb(['little', 'little', 'little']), Object.assign({}, T, { surfaced: 0, questions: 0 }));
  assert.strictEqual(silent.name, 'The Lone Solver');
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
    ['f3', 'Jonas, Theo says Bruno Keller painted only on wooden panels. Anything on the blue pigment?'],
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
  // a view or a rule-out needs the case facts
  assert(/case/i.test(SCR.reply(t1, 'f1', [{ from: 'leader', to: 'f1', text: 'Mira, what do you think about question 2?' }], sh())));
  assert(/case/i.test(SCR.reply(t1, 'f1', m('Which of your reports rule out an artist?'), sh())));
  const told = [{ from: 'leader', to: 'f1', text: 'The frame is plain dark wood, with no gilding.' }], st = sh();
  const clash = SCR.reply(t1, 'f1', told, st);
  assert(clash.includes('#' + LINDEN) && /rules out Linden & Sons/.test(clash), clash);
  told.push({ from: 'f1', to: 'leader', text: clash }, { from: 'leader', to: 'f1', text: 'Mira, what do you think about question 2?' });
  assert(/rule out|ruled out|drop/i.test(SCR.reply(t1, 'f1', told, st)));
  assert(/none|don't think/i.test(SCR.reply(t1, 'f2', [{ from: 'leader', to: 'f2', text: 'The portrait is 60 cm tall and 50 cm wide.' }], sh())), 'Theo has nothing that clashes with the size');
});

check('summary: specific strengths and tips across puzzles; repeating a request rates lower than asking well', () => {
  const good = [
    { p: t1, script: [['all', 'Hi team, what do you have on question 1?'], ['f2', 'Theo, anything on Bruno Keller?'], ['f2', 'Theo, was that wooden panels only?'], ['f3', 'Jonas, anything on Elin Berg or the pigment?'], ['all', 'Anything on Linden & Sons, Oakley Brothers or Marlow Frames?']] },
    { p: t3, script: [['all', 'Who has anything on Ashford Park or Brookside Park?'], ['f1', 'Mira, what about Elmwood Common?'], ['f1', 'Mira, does that apply to groups of runners too?'], ['all', 'Anything on Youth Sports Fund, Animal Rescue League or Elder Care Network?']] }
  ].map(x => ({ title: x.p.title, solo: false, analysis: C.analyse(x.p, play(x.p, x.script), even) }));
  const spam = [t1, t3].map(p => { const msgs = play(p, [['f1', 'Share everything.'], ['f1', 'Share everything.'], ['f1', 'Share everything.']]); return { title: p.title, solo: false, analysis: C.analyse(p, msgs, bestAnswer(p, msgs)) }; });
  const G = C.summarise(good), X = C.summarise(spam);
  assert(G.strengths.length >= 1 && X.tips.length >= 1);
  assert(X.tips.some(o => o.key === 'repeats') && /Across the test, 4 of your questions repeated/.test(X.tips.find(o => o.key === 'repeats').text), X.tips.map(o => o.text).join(' | '));
  const eff = T => T.targeted + 0.5 * T.generic;
  assert(eff(G.totals) >= 3 && eff(X.totals) <= 0.5, eff(G.totals) + ' vs ' + eff(X.totals));
  assert(G.totals.followUps > X.totals.followUps && G.totals.targetedShare > 0.7, JSON.stringify(G.totals));
});

/* ---------- the puzzles' twists ---------- */
const brief = p => ['all', caseFile(p) + ' Which of your reports rule out an option?'];
const quietOf = p => p.dynamics.quiet;

check('a quiet teammate holds back in replies to everyone and opens up when addressed by name', () => {
  const msgs = play(T1, [brief(T1), ['all', 'Anything else?'], ['all', 'Anything else?']]);
  const jonas = msgs.filter(m => m.from === quietOf(T1));
  assert.strictEqual(jonas.length, 2, 'two hesitant lines, then silence: ' + jonas.map(m => m.text).join(' | '));
  assert(jonas.every(m => !C.reportNums(m.text).length), 'shares no reports');
  const a = C.analyse(T1, msgs, bestAnswer(T1, msgs));
  const held = PZ.criticalFollowerClues(T1).filter(c => c.holder === 'f3');
  assert(held.length >= 1 && held.every(c => a.metrics.missedNums.includes(c.num)), 'Jonas\'s decisive reports stay hidden');
  assert.deepStrictEqual(a.metrics.challenge, { kind: 'quiet', fid: 'f3', met: false });
  const tip = a.observations.find(o => o.key === 'quiet');
  assert(tip && tip.tone === 'tip' && /Jonas held back/.test(tip.text) && /by name/.test(tip.text), tip && tip.text);
  assert(a.info.actual < 99, 'the briefing routine alone no longer gets 100 here: ' + a.info.actual);
  // turning to Jonas by name in a message to everyone, or directly, draws out his clashes with the case facts heard earlier
  [['all', 'Jonas, what about yours?'], ['f3', 'What about you?']].forEach(ask => {
    const m2 = play(T1, [brief(T1), ask]);
    const b = C.analyse(T1, m2, bestAnswer(T1, m2));
    assert.strictEqual(b.metrics.surfaced, b.metrics.critical, ask[1] + ': surfaced ' + b.metrics.surfaced);
    assert.deepStrictEqual(b.metrics.challenge, { kind: 'quiet', fid: 'f3', met: true });
    const good = b.observations.find(o => o.key === 'quiet');
    assert(good && good.tone === 'good' && /turned to Jonas directly/.test(good.text), good && good.text);
    assert(b.metrics.asksToAll <= 2, 'still efficient: ' + b.metrics.asksToAll);
  });
  // asking everyone by name from the start: Jonas never had to hold back, so the twist doesn't apply
  const direct = C.analyse(T1, play(T1, [['f1', caseFile(T1)], ['f2', caseFile(T1)], ['f3', caseFile(T1)]]), even);
  assert(!direct.metrics.challenge, JSON.stringify(direct.metrics.challenge));
});

check('an overconfident teammate claims a clash that is not there once told the case fact, and drops it when questioned', () => {
  const s = T2.dynamics.sure, opt = T2.questions[s.q].options[s.option];
  assert(T2.questions[s.q].answer.includes(s.option), 'the claimed option is a right answer');
  // no claim before the case fact comes up
  const early = play(T2, [['all', 'Please share all your reports.']]);
  assert(!early.some(m => m.from === s.fid && /rules out/.test(m.text)), early.map(m => m.text).join(' | '));
  const msgs = play(T2, [brief(T2)]);
  const claim = msgs.find(m => m.from === s.fid && m.text.includes('#' + s.num));
  assert(claim && new RegExp('rules out ' + opt).test(claim.text), msgs.map(m => m.text).join(' | '));
  // trusting every claimed clash costs points; checking it keeps them
  const trusting = bestAnswer(T2, msgs).map(a => a.slice());
  trusting[s.q] = [0, 1, 2, 3, 4].map(k => (trusting[s.q][k] > 0 && k !== s.option ? 1 : 0)).map((x, k, xs) => (x ? Math.round(100 / xs.filter(Boolean).length) : 0));
  trusting[s.q][trusting[s.q].findIndex(x => x > 0)] += 100 - trusting[s.q].reduce((a, b) => a + b, 0);
  const a = C.analyse(T2, msgs, trusting);
  assert.deepStrictEqual(a.metrics.challenge, { kind: 'sure', fid: s.fid, met: false, kept: false });
  const tip = a.observations.find(o => o.key === 'swayed');
  assert(tip && /Theo said report #\d+ rules out Strawberries/.test(tip.text) && /up to 25 points/.test(tip.text) && /case file yourself/.test(tip.text), tip && tip.text);
  assert(!a.observations.some(o => o.key === 'dropped'), 'no second tip about the same option');
  // keeping the option without questioning the claim is not "checking" it: the answer alone is no evidence
  const b = C.analyse(T2, msgs, bestAnswer(T2, msgs));
  assert.deepStrictEqual(b.metrics.challenge, { kind: 'sure', fid: s.fid, met: false, kept: true });
  assert(!b.observations.some(o => o.key === 'checked'), b.observations.map(o => o.key).join(','));
  const kc = b.observations.find(o => o.key === 'kept-claim');
  assert(kc && kc.tone === 'good' && /kept Strawberries among the possibilities/.test(kc.text) && /doesn't show you questioning/.test(kc.text), kc && kc.text);
  // leaving every answer at its default 20% earns no credit for checking either
  const idle = C.analyse(T2, msgs, even);
  assert(idle.metrics.challenge && !idle.metrics.challenge.met && !idle.observations.some(o => o.key === 'checked'), JSON.stringify(idle.metrics.challenge));
  // questioning the claim, by name or by its report, and keeping the option is checking it
  [['f2', 'Theo, are you sure? Roots of 15 cm fit in 40 cm beds.'], ['all', 'Why would #' + s.num + ' rule out Strawberries?'], ['f2', 'Really?']].forEach(q => {
    const m2 = play(T2, [brief(T2), q]), c = C.analyse(T2, m2, bestAnswer(T2, m2));
    assert.deepStrictEqual(c.metrics.challenge, { kind: 'sure', fid: s.fid, met: true, kept: true }, q[1]);
    assert(c.observations.some(o => o.key === 'checked' && o.tone === 'good' && /questioned the claim/.test(o.text)), q[1]);
  });
  // a message to everyone about something else is no challenge
  const other = play(T2, [brief(T2), ['all', 'Thanks. Anything else about the roof?']]);
  assert(!C.analyse(T2, other, bestAnswer(T2, other)).metrics.challenge.met, other.map(m => m.text).join(' | '));
  // questioned, the teammate admits the mistake
  [['f2', 'Theo, are you sure? Roots of 15 cm fit in 40 cm beds.'], ['all', 'Why would #' + s.num + ' rule out Strawberries?']].forEach(q => {
    const m2 = play(T2, [brief(T2), q]), last = m2.filter(m => m.from === s.fid).pop();
    assert(/stays in|after all|doesn't clash/.test(last.text), last.text);
  });
  // an LLM teammate's wording (from a live Gemini run) counts as the claim; its concession does not
  const live = [{ from: 'leader', to: 'all', text: caseFile(T2) }, { from: s.fid, to: 'leader', text: `Also, Report #${s.num} says strawberries have roots only 15 cm deep, so they're ruled out because the beds are 40 cm deep.` }];
  assert(C.analyse(T2, live, even).metrics.claim.made, 'live wording');
  const conceded = [{ from: 'leader', to: 'all', text: caseFile(T2) }, { from: s.fid, to: 'leader', text: `Fair point, so Report #${s.num} doesn't rule out Strawberries. Report #5 rules out Sprinklers though.` }];
  assert(!C.analyse(T2, conceded, even).metrics.claim.made, 'a concession is not a claim');
  // T4: the same twist on a different question and teammate
  const s4 = T4.dynamics.sure, m4 = play(T4, [brief(T4)]);
  assert(m4.some(m => m.from === s4.fid && m.text.includes('#' + s4.num) && /rules out Slow River/.test(m.text)), m4.map(m => m.text).join(' | '));
});

check('the briefing routine meets both Quick twists; handling them is named in the style', () => {
  const run = (p, script, answer) => { const msgs = play(p, script); return { title: p.title, solo: false, analysis: C.analyse(p, msgs, answer ? answer(msgs) : bestAnswer(p, msgs)) }; };
  // brief everyone once and trust every claimed clash
  const trust = msgs => { const s = T2.dynamics.sure, a = bestAnswer(T2, msgs); a[s.q] = [34, 33, 33, 0, 0]; return a; };
  const routine = [run(T1, [brief(T1)]), run(T2, [brief(T2)], trust)];
  const R = C.summarise(routine), style = C.leaderStyle(C.habits(R.totals), R.totals);
  assert(R.tips.some(o => o.key === 'swayed') && R.tips.some(o => o.key === 'quiet'), R.tips.map(o => o.key).join(','));
  assert(/Two things to watch/.test(style.text), style.text);
  assert.strictEqual(R.totals.challenges.filter(c => c.met).length, 0);
  // draw out the quiet teammate and check the claim
  const careful = [run(T1, [brief(T1), ['f3', 'Jonas, what about yours?']]), run(T2, [brief(T2), ['f2', 'Theo, are you sure? Roots of 15 cm fit in 40 cm beds.']])];
  const K = C.summarise(careful), ks = C.leaderStyle(C.habits(K.totals), K.totals);
  assert.strictEqual(K.totals.challenges.filter(c => c.met).length, 2);
  assert(/drew out the quiet one and questioned the overconfident one/.test(ks.text), ks.text);
  assert(!K.tips.some(o => ['swayed', 'quiet'].includes(o.key)), K.tips.map(o => o.key).join(','));
});

check('the LLM brief carries the twist only for the teammate who has it', () => {
  const quiet = PZ.followerBrief(T1, PZ.FOLLOWERS[2]), other = PZ.followerBrief(T1, PZ.FOLLOWERS[0]);
  assert(/hold back/.test(quiet) && !/YOUR MANNER/.test(other));
  const s = T2.dynamics.sure, sure = PZ.followerBrief(T2, PZ.FOLLOWERS.find(f => f.id === s.fid));
  assert(sure.includes('report #' + s.num + ' rules out Strawberries') && sure.includes(T2.questions[s.q].facts[s.fact].text), sure.slice(-600));
  assert(!/YOUR MANNER/.test(PZ.followerBrief(find('t5'), PZ.FOLLOWERS[0])), 't5 has no twist');
});

console.log(failures ? failures + ' check(s) failed' : 'all coach checks passed');
process.exit(failures ? 1 : 0);
