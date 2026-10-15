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
  // shuffle team scores so there is no manager effect; p should be roughly uniform
  const rand = S.rng(5); let rej = 0, R = 40;
  for (let s = 0; s < R; s++) {
    const t2 = teams.map(t => Object.assign({}, t, { score: 10 + 3 * S.randn(rand) }));
    const r2 = S.analyze({ teams: t2, people, peopleCols: [] }, { skillCols: ['task_numerical'], teamControls: [] });
    const d = S.riRunner(r2.ri, s + 100)(200);
    const p = (d.filter(v => v >= r2.fit.sigmaA).length + 1) / 201;
    if (p < 0.1) rej++;
  }
  console.log('     rejection rate at 10% = ' + (rej / R).toFixed(2));
  assert(rej / R < 0.3);
});

check('rotation planner avoids repeat manager-member pairs', () => {
  const M = Array.from({ length: 10 }, (_, i) => 'M' + i), W = Array.from({ length: 24 }, (_, i) => 'W' + i);
  const r = S.planRotation(M, W, 2, 4, 1);
  console.log('     max repeat ' + r.maxRepeatManagerMember + ', member pair repeats ' + r.repeatMemberPairs + ', sitting out ' + r.sittingOutPerRound);
  assert(r.plan.length === 40 && r.maxRepeatManagerMember === 1);
});

check('credence score', () => {
  const c = S.correctDist([0, 4], 5);
  assert(Math.abs(S.credenceScore([20, 20, 20, 20, 20], c) - 40) < 1e-9);
  assert(Math.abs(S.credenceScore([50, 0, 0, 0, 50], c) - 100) < 1e-9);
});

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
