// How fixed leading routines score against the scripted teammates over every twist the Quick puzzles can draw.
// Answer rule: the best answer with the reports that came out, ruling out whatever a teammate claimed unless the
// claim was taken back (a misquote counts once quoted, as the leader would read it against the case file), and keeping an option a teammate argued for unless they gave way.
// Usage: node tools/routines.cjs
const PZ = require('../src/puzzles.js'), C = require('../src/coach.js'), SCR = require('../src/scripted.js');
const find = id => PZ.PUZZLES.find(p => p.id === id);
const caseFile = p => 'Here is what the case file says. ' + p.questions.map(q => q.facts.map(f => f.text).join(' ')).join(' ');
function play(p, script) {
  const messages = [], shared = { f1: new Set(), f2: new Set(), f3: new Set() };
  script.forEach(step => {
    const [to, text] = typeof step === 'function' ? step(messages) : step;
    if (!text) return;
    messages.push({ from: 'leader', to, text });
    (to === 'all' ? ['f1', 'f2', 'f3'] : [to]).forEach(fid => { const r = SCR.reply(p, fid, messages, shared[fid]); if (r) messages.push({ from: fid, to: 'leader', text: r }); });
  });
  return messages;
}
function answer(p, msgs) {
  const avail = new Set(p.clues.filter(c => c.holder === 'leader' || c.holder === 'public').map(c => c.num));
  msgs.filter(m => m.from !== 'leader').forEach(m => C.reportNums(m.text).forEach(n => { const c = p.clues.find(x => x.num === n); if (c && (c.holder === m.from || c.holder === 'public')) avail.add(n); }));
  const d = p.dynamics, cl = d.sure || d.misquote, dp = d.dispute;
  return p.questions.map((q, qi) => {
    const out = C.ruledOut(p, qi, avail);
    let left = [0, 1, 2, 3, 4].filter(k => !out.has(k));
    if (cl && cl.q === qi) {
      const fm = msgs.filter(m => m.from === cl.fid);
      const claimed = fm.some(m => C.reportNums(m.text).includes(cl.num) && (/rules? out/.test(m.text) || (cl.misquote && m.text.includes(cl.misquote))) && !/stays in|after all|misread|doesn'?t/.test(m.text));
      const back = fm.some(m => C.reportNums(m.text).includes(cl.num) && /stays in|after all|misread|doesn'?t (clash|rule)/.test(m.text));
      if (claimed && !back) left = left.filter(k => k !== cl.option);
    }
    if (dp && dp.q === qi && msgs.some(m => m.from === dp.fid && C.disputeObjects(p, dp, m.text)) && !msgs.some(m => m.from === dp.fid && C.disputeYields(p, dp, m.text)) && !left.includes(dp.option)) left = left.concat([dp.option]);
    const a = [0, 0, 0, 0, 0]; left.forEach((k, i) => { a[k] = Math.floor(100 / left.length) + (i < 100 % left.length ? 1 : 0); });
    return a;
  });
}
const names = { f1: 'Mira', f2: 'Theo', f3: 'Jonas' };
const ROUTINES = {
  'One broad request for every report that rules out an option': p => [['all', 'Please share every report you hold that rules out an option.']],
  'Case facts once, trusting every claim (the v4 routine)': p => [['all', caseFile(p) + ' Which of your reports rule out an option?']],
  'Case facts, then each teammate by name': p => [['all', caseFile(p) + ' Which of your reports rule out an option?'], ...['f1', 'f2', 'f3'].map(f => ['all', names[f] + ', what about yours?'])],
  'Each teammate by name about every option, no case facts': p => ['f1', 'f2', 'f3'].flatMap(f => p.questions.map(q => [f, names[f] + ', what do you have on ' + q.options.join(', ') + '?'])),
  'Case facts, each by name, reassurance, and "are you sure?" to every claim': p => [
    ['all', 'Hi team, no pressure, any info helps. ' + caseFile(p) + ' Which of your reports rule out an option?'],
    ...['f1', 'f2', 'f3'].map(f => ['all', names[f] + ', what about yours?']),
    ...['f1', 'f2', 'f3'].map(f => msgs => (msgs.some(m => m.from === f && /rules? out/.test(m.text)) ? [f, 'Are you sure? Check each report you said rules something out against the case file again.'] : ['all', ''])),
    msgs => { const d = p.dynamics.dispute; const o = d && msgs.find(m => m.from === d.fid && C.disputeObjects(p, d, m.text)); return o ? [d.fid, 'Are you sure? ' + p.clues.find(c => c.num === d.dnum).text] : ['all', '']; }]
};
for (const [label, script] of Object.entries(ROUTINES)) {
  const rows = [];
  ['t1', 't2'].forEach(id => {
    const base = find(id), opts = [null].concat(PZ.twistOptions(base));
    opts.forEach(t => {
      const p = PZ.withTwist(base, t), msgs = play(p, script(p)), a = C.analyse(p, msgs, answer(p, msgs));
      rows.push({ id, kind: t ? t.kind : 'none', score: a.info.actual, lead: a.info.lead, n: msgs.filter(m => m.from === 'leader').length });
    });
  });
  // expected over the draw: none with 25%, else each kind equally likely, each option within a kind equally likely
  const exp = key => ['t1', 't2'].map(id => {
    const r = rows.filter(x => x.id === id), kinds = [...new Set(r.filter(x => x.kind !== 'none').map(x => x.kind))];
    const m = xs => xs.reduce((s, x) => s + x[key], 0) / xs.length;
    return 0.25 * m(r.filter(x => x.kind === 'none')) + 0.75 * kinds.reduce((s, k) => s + m(r.filter(x => x.kind === k)), 0) / kinds.length;
  });
  const byKind = {};
  rows.forEach(x => { (byKind[x.kind] = byKind[x.kind] || []).push(x.lead); });
  const kindText = Object.entries(byKind).map(([k, v]) => `${k} ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}`).join(', ');
  const e = exp('score'), l = exp('lead');
  console.log(`${label}\n   expected team score ${Math.round((e[0] + e[1]) / 2)} (t1 ${Math.round(e[0])}, t2 ${Math.round(e[1])}); expected leading score ${Math.round((l[0] + l[1]) / 2)}; share of draws at 100: ${Math.round(100 * rows.filter(x => x.score > 99.5).length / rows.length)}%\n   leading score by twist: ${kindText}`);
}
