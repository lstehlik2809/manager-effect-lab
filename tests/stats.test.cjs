// Checks the estimation engine against simulated data with known manager effects.
const assert = require('assert');
const S = require('../src/stats.js');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

// p-values and quantiles
check('t distribution p-values', () => {
  assert(Math.abs(S.pT2(2.228, 10) - 0.05) < 0.001);
  assert(Math.abs(S.pT2(1.96, 1e6) - 0.05) < 0.001);
  assert(Math.abs(S.normQuantile(0.95) - 1.6449) < 1e-3);
});

// OLS recovers known coefficients
check('OLS recovers coefficients', () => {
  const rand = S.rng(1); const X = [], y = [];
  for (let i = 0; i < 2000; i++) { const a = S.randn(rand), b = S.randn(rand); X.push([1, a, b]); y.push(0.5 + 0.3 * a - 0.2 * b + 0.5 * S.randn(rand)); }
  const m = S.ols(X, y);
  assert(Math.abs(m.beta[1] - 0.3) < 0.04 && Math.abs(m.beta[2] + 0.2) < 0.04, m.beta.join(','));
});

// REML: recover sigma_A across replications (balanced, 4 obs per group like Study 1)
check('REML recovers sigma_alpha (mean over 200 sims)', () => {
  const rand = S.rng(2); const est = [];
  for (let s = 0; s < 200; s++) {
    const G = 90, vals = [], grp = [];
    for (let g = 0; g < G; g++) { const a = 0.25 * S.randn(rand); for (let k = 0; k < 4; k++) { vals.push(a + 0.9 * S.randn(rand)); grp.push(g); } }
    est.push(S.remlFit(S.groupSummaries(vals, grp, G), false).sigmaA);
  }
  const m = S.mean(est);
  console.log('     mean sigmaA estimate = ' + m.toFixed(3) + ' (true 0.25)');
  assert(Math.abs(m - 0.25) < 0.04);
});

check('REML matches ANOVA estimator on balanced data', () => {
  const rand = S.rng(3); const G = 60, n = 6, vals = [], grp = [];
  for (let g = 0; g < G; g++) { const a = 0.5 * S.randn(rand); for (let k = 0; k < n; k++) { vals.push(a + S.randn(rand)); grp.push(g); } }
  const fit = S.remlFit(S.groupSummaries(vals, grp, G), true);
  // ANOVA: MSB, MSW
  const means = []; let msw = 0;
  for (let g = 0; g < G; g++) { const v = vals.slice(g * n, g * n + n); const m = S.mean(v); means.push(m); msw += v.reduce((s, x) => s + (x - m) ** 2, 0); }
  msw /= G * (n - 1);
  const msb = n * means.reduce((s, m) => s + (m - S.mean(means)) ** 2, 0) / (G - 1);
  const sA = Math.sqrt(Math.max(0, (msb - msw) / n));
  console.log('     REML ' + fit.sigmaA.toFixed(4) + ' vs ANOVA ' + sA.toFixed(4) + ', CI ' + fit.ci.map(v => v.toFixed(3)).join('-'));
  assert(Math.abs(fit.sigmaA - sA) < 1e-3);
  assert(fit.ci[0] < fit.sigmaA && fit.ci[1] > fit.sigmaA);
});

check('profile-likelihood CI profiles sigma_alpha directly', () => {
  // Independent brute force: for each candidate sigma_A, maximise the REML likelihood over a
  // fine grid of sigma_E; the interval ends where that profile drops 1.92 below its maximum.
  const rand = S.rng(3); const G = 60, n = 6, vals = [], grp = [];
  for (let g = 0; g < G; g++) { const a = 0.5 * S.randn(rand); for (let k = 0; k < n; k++) { vals.push(a + S.randn(rand)); grp.push(g); } }
  const gs = S.groupSummaries(vals, grp, G), fit = S.remlFit(gs, true);
  const yb = [], ns = []; let W = 0, N = 0;
  for (let i = 0; i < G; i++) { const m = gs.sum[i] / gs.n[i]; yb.push(m); ns.push(gs.n[i]); W += gs.ss[i] - gs.n[i] * m * m; N += gs.n[i]; }
  const ll = (sA2, s2e) => {
    const g = sA2 / s2e; let sw = 0, swy = 0, sl = 0;
    for (let i = 0; i < G; i++) { const w = ns[i] / (1 + ns[i] * g); sw += w; swy += w * yb[i]; sl += Math.log(1 + ns[i] * g); }
    const mu = swy / sw; let Q = W;
    for (let i = 0; i < G; i++) Q += ns[i] / (1 + ns[i] * g) * (yb[i] - mu) ** 2;
    return -0.5 * ((N - 1) * Math.log(s2e) + sl + Math.log(sw) + Q / s2e);
  };
  const prof = sA => { let best = -Infinity; for (let k = 0; k <= 4000; k++) best = Math.max(best, ll(sA * sA, 0.4 + k * 0.0004)); return best; };
  const drop = prof(fit.sigmaA) - 1.920729;
  console.log('     CI ' + fit.ci.map(v => v.toFixed(4)).join('-') + ', profile at ends ' + fit.ci.map(v => (prof(v) - drop).toFixed(4)).join(', '));
  fit.ci.forEach(v => assert(Math.abs(prof(v) - drop) < 0.01, 'profile drop at ' + v));
  assert(Math.abs(fit.ci[0] - 0.2782) < 0.001 && Math.abs(fit.ci[1] - 0.5794) < 0.001);
});

check('t critical values', () => {
  assert(Math.abs(S.tCrit(3) - 3.182) < 0.002);
  assert(Math.abs(S.tCrit(1e6) - 1.960) < 0.002);
});

check('REML returns zero when there is no group effect (most sims)', () => {
  const rand = S.rng(4); let zeros = 0, sum = 0;
  for (let s = 0; s < 100; s++) {
    const vals = [], grp = [];
    for (let g = 0; g < 50; g++) for (let k = 0; k < 4; k++) { vals.push(S.randn(rand)); grp.push(g); }
    const f = S.remlFit(S.groupSummaries(vals, grp, 50), false); if (f.sigmaA === 0) zeros++; sum += f.sigmaA;
  }
  console.log('     share exactly zero = ' + zeros + '%, mean = ' + (sum / 100).toFixed(3));
  assert(zeros > 25);
});

// Full pipeline on the example data
const ex = S.simulateExample();
const people = Object.fromEntries(ex.people.map(p => [p.person_id, p]));
const teams = ex.teams.map(t => ({ round: t.round, team: t.team_id, manager: t.manager_id, members: t.member_ids.split(';'), score: t.team_score, controls: { arm: t.arm } }));
const peopleCols = Object.keys(ex.people[0]).filter(c => c !== 'person_id');
let res;
check('pipeline runs on example data', () => {
  res = S.analyze({ teams, people, peopleCols }, { skillCols: ['task_numerical', 'task_spatial', 'task_analytical'], teamControls: ['arm'] });
  console.log('     teams ' + res.nTeams + ', managers ' + res.nManagers + ', members ' + res.nMembers);
  console.log('     sigmaA ' + res.fit.sigmaA.toFixed(3) + ' CI ' + res.fit.ci.map(v => v.toFixed(3)).join('-') + ', sigmaE ' + res.fit.sigmaE.toFixed(3) + ', reliability ' + res.reliability.toFixed(2));
  console.log('     model: ' + res.model.names.map((n, i) => n + '=' + res.model.beta[i].toFixed(3)).join(', '));
  console.log('     workers sigma ' + (res.workers ? res.workers.sigmaA.toFixed(3) : 'n/a'));
  console.log('     LOO slope ' + res.loo.slope.toFixed(3) + ' (se ' + res.loo.se.toFixed(3) + '), r ' + res.loo.r.toFixed(3));
  res.predictors.forEach(p => console.log('     ' + p.label.padEnd(24) + ' r=' + p.r.toFixed(2) + ' p=' + p.p.toFixed(3) + ' top3=' + p.topMean.toFixed(3)));
  console.log('     random third ' + JSON.stringify(res.randomThird));
  const counts = { above: 0, below: 0, unclear: 0 }; res.managers.forEach(m => counts[m.cls]++); console.log('     classes ' + JSON.stringify(counts));
  assert(res.fit.sigmaA > 0.15 && res.fit.sigmaA < 0.4);
});

check('EB estimates correlate with true effects', () => {
  const x = res.managers.map(m => m.eb), y = res.managers.map(m => ex.truth[m.id]);
  const c = S.cor(x, y); console.log('     r(EB, truth) = ' + c.r.toFixed(2));
  assert(c.r > 0.3);
});

check('randomization inference gives small p on example data', () => {
  const run = S.riRunner(res.ri, 11);
  const t0 = Date.now(); const draws = run(1000); const ms = Date.now() - t0;
  const p = (draws.filter(d => d >= res.fit.sigmaA).length + 1) / (draws.length + 1);
  console.log('     RI p = ' + p.toFixed(4) + ', null mean ' + S.mean(draws).toFixed(3) + ', 1000 draws in ' + ms + ' ms');
  assert(p < 0.05);
});

check('randomization inference is calibrated under the null', () => {
  // shuffle team scores so there is no manager effect; p should be roughly uniform.
  // 200 runs keep the Monte Carlo error near 2 points, so a miscalibrated test would fail.
  const rand = S.rng(5); let rej = 0; const R = 200;
  for (let s = 0; s < R; s++) {
    const t2 = teams.map(t => Object.assign({}, t, { score: 10 + 3 * S.randn(rand) }));
    const r2 = S.analyze({ teams: t2, people, peopleCols: [] }, { skillCols: ['task_numerical'], teamControls: [] });
    const d = S.riRunner(r2.ri, s + 100)(100);
    const p = (d.filter(v => v >= r2.fit.sigmaA).length + 1) / 101;
    if (p < 0.1) rej++;
  }
  const rate = rej / R, bound = 3 * Math.sqrt(0.1 * 0.9 / R);
  console.log('     rejection rate at 10% = ' + rate.toFixed(3) + ' over ' + R + ' null datasets (allowed 0.10 ± ' + bound.toFixed(3) + ')');
  assert(Math.abs(rate - 0.1) < bound);
});

check('rotation planner avoids repeat manager-member pairs', () => {
  const M = Array.from({ length: 10 }, (_, i) => 'M' + i), W = Array.from({ length: 24 }, (_, i) => 'W' + i);
  const r = S.planRotation(M, W, 2, 4, 1);
  console.log('     max repeat ' + r.maxRepeatManagerMember + ', member pair repeats ' + r.repeatMemberPairs + ', sitting out ' + r.sittingOutPerRound);
  assert(r.plan.length === 40 && r.maxRepeatManagerMember === 1);
});

check('AI group analysis removes solo skill and tracks true leadership', () => {
  const ex = S.simulateAIGroup(51, 40);
  const rows = ex.rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
  const L = S.aiGroupRows(rows);
  assert.strictEqual(L.length, 40);
  assert.deepStrictEqual(Object.keys(L[0].puzzles).sort(), ['t1', 't2', 't3', 't4']);
  const res = S.aiGroup(L);
  const eb = res.people.map(p => p.eb);
  const rTruth = S.cor(eb, res.people.map(p => ex.truth[p.id])).r, rSolo = S.cor(eb, res.people.map(p => p.solo)).r;
  const raw = S.aiGroup(L, { adjust: false }), rSoloRaw = S.cor(raw.people.map(p => p.eb), raw.people.map(p => p.solo)).r;
  console.log('     sigma ' + res.fit.sigmaA.toFixed(3) + ' CI ' + res.fit.ci.map(v => v.toFixed(3)).join('-') + ', solo slope ' + res.soloBeta.b.toFixed(2) + ', r(estimate, truth) ' + rTruth.toFixed(2) + ', r(estimate, solo) ' + rSolo.toFixed(3) + ' (unadjusted ' + rSoloRaw.toFixed(2) + ')');
  assert(res.useSolo && res.soloBeta.b > 0.2 && res.soloBeta.p < 0.01);
  assert(Math.abs(rSolo) < 0.05 && rSoloRaw > 0.3);
  assert(rTruth > 0.5);
  assert(res.fit.ci[0] > 0 && res.fit.ci[0] < res.fit.sigmaA && res.fit.sigmaA < res.fit.ci[1]);
});

check('AI group analysis puts one and three warm-ups on the same scale', () => {
  // half the group did only the easiest warm-up; estimates should still track true leadership
  // and should not differ systematically by warm-up length
  const ex = S.simulateAIGroup(53, 60, { mixWarmups: true });
  const rows = ex.rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
  const L = S.aiGroupRows(rows);
  assert.deepStrictEqual(Object.keys(L[1].soloPuzzles), ['s1']);
  const res = S.aiGroup(L);
  const eb = res.people.map(p => p.eb), rTruth = S.cor(eb, res.people.map(p => ex.truth[p.id])).r;
  const short = new Set(L.filter(l => Object.keys(l.soloPuzzles).length === 1).map(l => l.id));
  const gap = S.mean(res.people.filter(p => short.has(p.id)).map(p => p.eb)) - S.mean(res.people.filter(p => !short.has(p.id)).map(p => p.eb));
  console.log('     r(estimate, truth) ' + rTruth.toFixed(2) + ', mean estimate one-warm-up minus three-warm-up ' + gap.toFixed(3));
  assert(res.useSolo && rTruth > 0.5 && Math.abs(gap) < 0.25);
  assert(res.warnings.some(w => /different numbers of warm-up/.test(w)));
});

check('AI group analysis handles missing solo scores and small groups', () => {
  const ex = S.simulateAIGroup(52, 8);
  const L = S.aiGroupRows(ex.rows);
  delete L[0].solo; L[0].solo = NaN;
  const res = S.aiGroup(L);
  assert.strictEqual(res.nPeople, 7);
  assert(res.warnings.some(w => /skipped the solo/.test(w)) && res.warnings.some(w => /imprecise/.test(w)));
  assert.throws(() => S.aiGroup(L.slice(0, 4)), /at least 5 people/);
});

check('credence score', () => {
  const c = S.correctDist([0, 4], 5);
  assert(Math.abs(S.credenceScore([20, 20, 20, 20, 20], c) - 40) < 1e-9);
  assert(Math.abs(S.credenceScore([50, 0, 0, 0, 50], c) - 100) < 1e-9);
});

check('scaling answers to 100 keeps proportions', () => {
  assert.deepStrictEqual(S.scaleTo100([50, 25, 25, 25, 0]), [40, 20, 20, 20, 0]);
  assert.deepStrictEqual(S.scaleTo100([10, 10, 10, 0, 0]), [34, 33, 33, 0, 0]);
  assert.deepStrictEqual(S.scaleTo100([1, 1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b, 0), 100);
  assert.deepStrictEqual(S.scaleTo100([30, 70, 0, 0, 0]), [30, 70, 0, 0, 0]);
  assert.strictEqual(S.scaleTo100([0, 0, 0, 0, 0]), null);
});

check('pilot summary: completion, ratings, score spread and styles from results files', () => {
  const row = (score, style, fun, fair, done, met) => ({ name: 'P' + score + style, test_version: '5', engine: 'hosted', model: 'gemini-3.8-flash', team_score: score, t1_q1: score, t1_q2: score, t2_q1: score, t2_q2: score,
    style, fun, fair, team_puzzles_planned: 2, team_puzzles_done: done, twists_met: met, twists_total: 2, comment: fun === 1 ? 'too long' : '' });
  const rows = [row(100, 'The Briefer', 5, 5, 2, 2), row(100, 'The Briefer', 4, 4, 2, 1), row(98, 'The Briefer', 4, 2, 2, 1), row(96, 'The Briefer', 3, 1, 2, 0), row(70, 'The Collector', 1, 2, 1, 0), row(40, 'The Delegator', '', '', 1, 0)];
  const P = S.pilotSummary(S.aiGroupRows(rows));
  assert.strictEqual(P.n, 6); assert.strictEqual(P.top, 4);
  assert.deepStrictEqual(P.finished, { n: 6, all: 4 });
  assert.strictEqual(P.fun.n, 5); assert(Math.abs(P.fun.mean - 3.4) < 1e-9);
  assert.strictEqual(P.fair.low, 3);
  assert.deepStrictEqual(P.twists, { people: 6, met: 4, total: 12 });
  assert.strictEqual(P.styles[0].name, 'The Briefer'); assert.strictEqual(P.styles[0].n, 4);
  assert.strictEqual(P.bins[9].n, 4); assert.strictEqual(P.bins[4].n, 1);
  assert.strictEqual(P.median, 97);
  assert.deepStrictEqual(P.comments, ['too long']);
  ['ceiling', 'one-style', 'unfair'].forEach(f => assert(P.flags.includes(f), f + ' in ' + P.flags));
  // older results files without the pilot columns still load; their scores come from the puzzle columns
  const old = S.pilotSummary(S.aiGroupRows([{ name: 'A', t1_q1: 50, t1_q2: 70 }]));
  assert.strictEqual(old.median, 60); assert.strictEqual(old.fun.n, 0); assert.strictEqual(old.finished.n, 0);
});

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
