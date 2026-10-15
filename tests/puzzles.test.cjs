// Structural checks on the hidden-profile puzzles.
const assert = require('assert');
const PZ = require('../src/puzzles.js');
let failures = 0;
for (const p of PZ.PUZZLES) {
  try {
    const nums = p.clues.map(c => c.num);
    assert.strictEqual(new Set(nums).size, nums.length, 'report numbers unique');
    p.questions.forEach((q, qi) => {
      assert.strictEqual(q.options.length, 5, 'five options');
      const ruled = new Set();
      p.clues.filter(c => c.q === qi && c.kind !== 'noise').forEach(c => { assert(Array.isArray(c.rules), 'rules on ' + c.text); c.rules.forEach(r => ruled.add(r)); });
      const expected = [0, 1, 2, 3, 4].filter(i => !q.answer.includes(i));
      assert.deepStrictEqual([...ruled].sort(), expected, p.id + ' Q' + (qi + 1) + ' ruled-out set matches answer');
      // two-part rules come in pairs held by different people
      const halves = p.clues.filter(c => c.q === qi && c.kind === 'half');
      assert(halves.length % 2 === 0, 'halves in pairs');
      if (!p.solo) {
        for (const who of ['public', 'leader', 'f1', 'f2', 'f3']) {
          assert.strictEqual(p.clues.filter(c => c.q === qi && c.holder === who).length, 2, p.id + ' ' + who + ' has 2 reports for Q' + (qi + 1));
        }
        // nobody can solve it alone: the leader's reports never cover every ruled-out option
        const leaderRuled = new Set(p.clues.filter(c => c.q === qi && (c.holder === 'leader' || c.holder === 'public') && c.kind === 'out').flatMap(c => c.rules));
        assert(leaderRuled.size < expected.length, p.id + ' Q' + (qi + 1) + ' needs the followers');
      }
    });
    if (!p.solo) {
      ['leader', 'f1', 'f2', 'f3'].forEach(w => assert.strictEqual(PZ.cluesFor(p, w).length, 8, w + ' sees 8 reports'));
      assert(PZ.criticalFollowerClues(p).length >= 4, 'followers hold decisive information');
    }
    console.log('ok   ' + p.id + ' ' + p.title + ' (follower-held decisive reports: ' + (p.solo ? '-' : PZ.criticalFollowerClues(p).length) + ')');
  } catch (e) { failures++; console.log('FAIL ' + p.id + ': ' + e.message); }
}
console.log(failures ? failures + ' puzzle(s) failed' : 'all puzzles consistent');
process.exit(failures ? 1 : 0);
