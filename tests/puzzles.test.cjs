// Structural checks on the hidden-profile puzzles.
const assert = require('assert');
const PZ = require('../src/puzzles.js');
const C = require('../src/coach.js');

// Study 2's six AI-team items (GroupHP_clues_stories.xlsx on OSF): layout, and per question the report
// slots (1–10) that rule an option out. Every other slot is a fact that rules nothing out.
const ORIGINAL = {
  A2: { title: 'Natural History Museum', layout: 'X', out: [[9, 10], [8, 9, 10]] },
  B2: { title: 'Great Farm', layout: 'Y', out: [[9, 10], [10]] },
  C2: { title: 'Company Hiring', layout: 'Y', out: [[8, 9, 10], [7, 8, 9, 10]] },
  D2: { title: 'Build New Libraries', layout: 'Y', out: [[8, 9, 10], [10]] },
  E2: { title: 'What is the fish?', layout: 'X', out: [[7, 8, 9, 10], [10]] },
  F2: { title: 'Heritage Museum', layout: 'Y', out: [[10], [8, 9, 10]] }
};

let failures = 0;
for (const p of PZ.PUZZLES) {
  try {
    const nums = p.clues.map(c => c.num);
    assert.strictEqual(new Set(nums).size, nums.length, 'report numbers unique');
    p.questions.forEach((q, qi) => {
      assert.strictEqual(q.options.length, 5, 'five options');
      const qc = p.clues.filter(c => c.q === qi);
      qc.forEach(c => {
        assert(c.kind === 'out' || c.kind === 'noise', 'a report rules out on its own or is irrelevant: ' + c.text);
        if (c.kind === 'out') assert(Array.isArray(c.rules) && c.rules.length === 1, 'one option per rule-out report: ' + c.text);
        // every report is about one option of its own question, and a rule-out report names the option it rules out
        const named = C.optionMentions(p, c.text);
        assert.strictEqual(named.filter(o => o.q === qi).length, 1, 'names one option of its question: ' + c.text);
        assert(!named.some(o => o.q !== qi), 'names no option of the other question: ' + c.text);
        if (c.kind === 'out') assert(named.some(o => o.k === c.rules[0]), 'names the option it rules out: ' + c.text);
      });
      const ruled = qc.filter(c => c.kind === 'out').map(c => c.rules[0]);
      assert.strictEqual(new Set(ruled).size, ruled.length, 'each option ruled out once');
      const expected = [0, 1, 2, 3, 4].filter(i => !q.answer.includes(i));
      assert.deepStrictEqual(ruled.slice().sort(), expected, p.id + ' Q' + (qi + 1) + ' ruled-out set matches answer');
      if (!p.solo) {
        assert.strictEqual(qc.length, 10, '10 reports per question');
        for (const who of ['public', 'leader', 'f1', 'f2', 'f3']) {
          assert.strictEqual(qc.filter(c => c.holder === who).length, 2, p.id + ' ' + who + ' has 2 reports for Q' + (qi + 1));
        }
        ['f1', 'f2', 'f3'].forEach(f => assert(qc.filter(c => c.holder === f && c.kind === 'out').length <= 1, f + ' holds at most one decisive report per question'));
        // the same structure as the original item, slot by slot
        const o = ORIGINAL[p.mirrors];
        assert(o, p.id + ' mirrors a Study 2 item');
        assert.strictEqual(p.layout, o.layout, 'layout');
        const slots = PZ.LAYOUTS[p.layout];
        assert.deepStrictEqual(qc.map((c, i) => (c.kind === 'out' ? i + 1 : 0)).filter(Boolean), o.out[qi], p.id + ' Q' + (qi + 1) + ' rule-out slots match ' + p.mirrors);
        qc.forEach((c, i) => assert(slots[i] === c.holder || (/^F\d$/.test(slots[i]) && /^f\d$/.test(c.holder)), 'slot ' + (i + 1) + ' holder'));
        // the case file: a decisive report rules its option out only against a case fact, and says nothing about it
        // itself, so a teammate without the case file can't tell which of its reports matter
        assert(q.facts && q.facts.length >= 1, p.id + ' Q' + (qi + 1) + ' has a case file');
        q.facts.forEach((f, i) => assert(C.factMentions(p, f.text).some(m => m.q === qi && m.i === i), 'case fact is recognised by its key words: ' + f.text));
        qc.forEach(c => {
          assert(!/\bruled?\s+(?:\w+\s+)?out\b|\bso (?:it|they|he|she)\b|\bcannot\b|\bcan't\b|\b(?:is|are) out\b/i.test(c.text), 'a report states no conclusion: ' + c.text);
          if (c.kind === 'out') assert(Number.isInteger(c.fact) && q.facts[c.fact], 'a decisive report names the case fact it clashes with: ' + c.text);
        });
        // nobody can solve it alone: the leader's reports never cover every ruled-out option
        const leaderRuled = new Set(qc.filter(c => (c.holder === 'leader' || c.holder === 'public') && c.kind === 'out').flatMap(c => c.rules));
        assert(leaderRuled.size < expected.length, p.id + ' Q' + (qi + 1) + ' needs the followers');
      }
    });
    if (!p.solo) {
      ['leader', 'f1', 'f2', 'f3'].forEach(w => assert.strictEqual(PZ.cluesFor(p, w).length, 8, w + ' sees 8 reports'));
      // each follower role is played by one teammate throughout the puzzle
      p.questions.forEach((q, qi) => PZ.LAYOUTS[p.layout].forEach((s, i) => {
        if (!/^F\d$/.test(s)) return;
        const other = p.clues.filter(c => c.q === 1 - qi)[i];
        assert.strictEqual(p.clues.filter(c => c.q === qi)[i].holder, other.holder, 'role ' + s + ' is the same teammate in both questions');
      }));
    }
    console.log('ok   ' + p.id + ' ' + p.title + (p.solo ? '' : ' (mirrors ' + p.mirrors + ' ' + ORIGINAL[p.mirrors].title + '; follower-held decisive reports: ' + PZ.criticalFollowerClues(p).length + ')'));
  } catch (e) { failures++; console.log('FAIL ' + p.id + ': ' + e.message); }
}
try {
  const team = PZ.PUZZLES.filter(p => !p.solo), solo = PZ.PUZZLES.filter(p => p.solo);
  assert.deepStrictEqual(team.map(p => p.mirrors).sort(), Object.keys(ORIGINAL), 'each original item is mirrored once');
  assert.strictEqual(solo.length, 3, 'three solo puzzles, as in Study 2');
  // the role that always holds a decisive report (slot 10) rotates: each teammate has it in two puzzles
  const last = team.map(p => p.clues.filter(c => c.q === 0)[9].holder);
  ['f1', 'f2', 'f3'].forEach(f => assert.strictEqual(last.filter(x => x === f).length, 2, f + ' holds slot 10 in two puzzles'));
  console.log('ok   the six team puzzles mirror Study 2\'s six AI-team items');
} catch (e) { failures++; console.log('FAIL set: ' + e.message); }
try {
  // the reports the twists use: an overconfident claim or a misquote is about a right answer, against a case fact
  // of the same question; a misquoted report is shared, so the leader can check it; a dispute defends an option
  // that a decisive report rules out
  const team = PZ.PUZZLES.filter(p => !p.solo);
  team.forEach(p => {
    assert(!Object.keys(p.dynamics).length, p.id + ': no twist built in');
    const named = (t, qi) => C.optionMentions(p, t).filter(o => o.q === qi).map(o => o.k);
    ['sure', 'misquote', 'dispute'].forEach(kind => p.twists[kind].forEach(s => {
      const q = p.questions[s.q], c = p.clues.find(x => x.num === s.num), where = `${p.id} ${kind} ${c ? c.text : '?'}`;
      assert(c && c.q === s.q && c.kind === 'noise', where + ': the report rules nothing out');
      assert.deepStrictEqual(named(c.text, s.q), [s.option], where + ': the report names the option');
      assert(/^[a-z]/.test(s.why) && /\.$/.test(s.why), where + ': why reads as the end of a sentence');
      if (kind === 'dispute') {
        assert(!q.answer.includes(s.option), where + ': the disputed option is ruled out');
        const d = p.clues.find(x => x.num === s.dnum);
        assert(d && d.kind === 'out' && d.rules[0] === s.option && d.fact === s.fact, where + ': the decisive report it argues against');
        assert(/^[a-z]/.test(s.says) && !/\.$/.test(s.says), where + ': says reads as a clause');
        return;
      }
      assert(q.answer.includes(s.option), where + ': the claim is about a right answer');
      assert(q.facts[s.fact], where + ': the claim rests on a case fact of the same question');
      if (kind === 'sure') assert(/^[a-z]/.test(s.says) && !/\.$/.test(s.says), where + ': says reads as a clause');
      if (kind === 'misquote') {
        assert.strictEqual(c.holder, 'public', where + ': a misquoted report is shared');
        assert(s.misquote !== c.text && /\.$/.test(s.misquote), where + ': the misquote reads as a report');
        assert.deepStrictEqual(named(s.misquote, s.q), [s.option], where + ': the misquote names the same option');
        assert(!/\bruled?\s+(?:\w+\s+)?out\b|\bcannot\b|\bcan't\b/i.test(s.misquote), where + ': the misquote states no conclusion');
      }
    }));
    const kinds = new Set(PZ.twistOptions(p).map(o => o.kind));
    assert(kinds.size >= 4 && kinds.has('quiet') && kinds.has('anxious') && kinds.has('sure') && kinds.has('dispute'), p.id + ' offers most kinds: ' + [...kinds]);
    PZ.twistOptions(p).forEach(o => {
      if (o.kind === 'quiet' || o.kind === 'anxious') assert(PZ.criticalFollowerClues(p).some(c => c.holder === o.fid), p.id + ': a quiet or worried teammate holds a decisive report');
      if (o.kind === 'dispute') assert.notStrictEqual(p.twists.dispute[o.i].dholder, o.fid, p.id + ': nobody disputes their own report');
      assert(PZ.twistValid(p, o) && PZ.withTwist(p, o).twist, p.id + ' ' + JSON.stringify(o));
    });
    assert.strictEqual(PZ.withTwist(p, null).twist, null);
    assert.strictEqual(PZ.withTwist(p, { kind: 'sure', fid: 'f1', i: 9 }).twist, null, 'an unknown twist is dropped');
    assert(!Object.keys(PZ.withTwist(p, { kind: 'quiet', fid: 'leader' }).dynamics).length, 'only teammates get twists');
  });
  // the draw: about one puzzle in four has no twist, every kind and every teammate turns up, and a test
  // repeats a kind only once it has used the others
  let seed = 7;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ids = PZ.PUZZLES.map(p => p.id), seen = {}, who = new Set();
  let none = 0, n = 0;
  for (let k = 0; k < 2000; k++) {
    const plan = PZ.drawTwists(ids, rand);
    assert.deepStrictEqual(Object.keys(plan), team.map(p => p.id), 'one entry per team puzzle');
    const kinds = [];
    team.forEach(p => {
      const t = plan[p.id]; n++;
      if (!t) { none++; return; }
      assert(PZ.twistValid(p, t), JSON.stringify(t));
      seen[t.kind] = (seen[t.kind] || 0) + 1; who.add(t.fid); kinds.push(t.kind);
    });
    assert(new Set(kinds.slice(0, 5)).size === Math.min(5, kinds.length), 'no repeated kind before all five are used: ' + kinds);
  }
  assert(none / n > 0.2 && none / n < 0.3, 'share without a twist ' + (none / n).toFixed(3));
  assert.deepStrictEqual(Object.keys(seen).sort(), PZ.TWIST_KINDS.slice().sort(), 'every kind is drawn');
  assert(Object.values(seen).every(x => x > 0.15 * (n - none)), JSON.stringify(seen));
  assert.strictEqual(who.size, 3, 'every teammate gets twists');
  console.log('ok   teammate twists: valid candidates; random draws ' + JSON.stringify(seen) + ', none ' + none + ' of ' + n);
} catch (e) { failures++; console.log('FAIL twists: ' + e.message); }
console.log(failures ? failures + ' puzzle check(s) failed' : 'all puzzles consistent');
process.exit(failures ? 1 : 0);
