/* Manager Effect Lab — estimation engine.
 * Implements the repeated-random-assignment method of
 *   Weidmann, Vecci, Said, Deming & Bhalotra (2024), NBER w32699, and
 *   Weidmann, Xu & Deming (2025), NBER w33662.
 * Pure functions only; runs in the browser and in Node (for tests). */
(function (root) {
  'use strict';
  const S = {};

  /* ---------- random numbers ---------- */
  S.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  S.randn = function (rand) {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  S.shuffle = function (arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /* ---------- descriptive ---------- */
  S.mean = a => { let s = 0; for (const x of a) s += x; return s / a.length; };
  S.sd = a => {
    if (a.length < 2) return 0;
    const m = S.mean(a); let s = 0;
    for (const x of a) s += (x - m) * (x - m);
    return Math.sqrt(s / (a.length - 1));
  };
  S.zscore = a => {
    const m = S.mean(a), s = S.sd(a);
    return a.map(x => (s > 0 ? (x - m) / s : 0));
  };

  /* ---------- special functions ---------- */
  function gammaln(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  /** Two-sided p-value of a t statistic. */
  S.pT2 = function (t, df) {
    if (!isFinite(t)) return 0;
    if (df <= 0) return NaN;
    return ibeta(df / 2, 0.5, df / (df + t * t));
  };
  S.normCdf = function (z) {
    // Abramowitz-Stegun 7.1.26 via erf
    const s = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + s * y);
  };
  S.normQuantile = function (p) {
    // Acklam's algorithm
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };

  /* ---------- linear algebra / OLS ---------- */
  function invert(M) {
    const n = M.length;
    const A = M.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    let scale = 0;
    for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(M[i][i]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      if (Math.abs(A[piv][col]) < 1e-10 * Math.max(1, scale)) return null;
      [A[col], A[piv]] = [A[piv], A[col]];
      const pv = A[col][col];
      for (let j = 0; j < 2 * n; j++) A[col][j] /= pv;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = A[r][col];
        if (f === 0) continue;
        for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
      }
    }
    return A.map(row => row.slice(n));
  }
  S.invert = invert;

  /** OLS with classical standard errors. X: rows incl. intercept column. */
  S.ols = function (X, y) {
    const n = X.length, p = X[0].length;
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
    const Xty = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      for (let a = 0; a < p; a++) {
        Xty[a] += xi[a] * y[i];
        for (let b = a; b < p; b++) XtX[a][b] += xi[a] * xi[b];
      }
    }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const inv = invert(XtX);
    if (!inv) throw new Error('The control variables are perfectly collinear (or a control has no variation). Remove one and run again.');
    const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const fitted = X.map(xi => xi.reduce((s, v, j) => s + v * beta[j], 0));
    const resid = y.map((v, i) => v - fitted[i]);
    const rss = resid.reduce((s, r) => s + r * r, 0);
    const ym = S.mean(y);
    const tss = y.reduce((s, v) => s + (v - ym) * (v - ym), 0);
    const df = n - p;
    const s2 = df > 0 ? rss / df : NaN;
    const se = inv.map((row, j) => Math.sqrt(Math.max(0, s2 * row[j])));
    const t = beta.map((b, j) => b / se[j]);
    const pval = t.map(tv => S.pT2(tv, df));
    return { beta, se, t, p: pval, fitted, resid, rss, df, n, r2: tss > 0 ? 1 - rss / tss : 0, adjR2: tss > 0 && df > 0 ? 1 - (rss / df) / (tss / (n - 1)) : 0 };
  };

  /* ---------- correlation ---------- */
  S.cor = function (x, y) {
    const n = x.length;
    if (n < 3) return { r: NaN, n, p: NaN, lo: NaN, hi: NaN };
    const mx = S.mean(x), my = S.mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    if (sxx === 0 || syy === 0) return { r: NaN, n, p: NaN, lo: NaN, hi: NaN };
    const r = sxy / Math.sqrt(sxx * syy);
    const rc = Math.max(-0.999999, Math.min(0.999999, r));
    const t = rc * Math.sqrt((n - 2) / (1 - rc * rc));
    const z = Math.atanh(rc), se = 1 / Math.sqrt(Math.max(1, n - 3));
    return { r, n, p: S.pT2(t, n - 2), lo: Math.tanh(z - 1.959964 * se), hi: Math.tanh(z + 1.959964 * se) };
  };

  /* ---------- one-way random-effects model (REML) ----------
   *   y_gi = mu + alpha_i + e_gi,  alpha_i ~ N(0, sA^2),  e ~ N(0, sE^2)
   * Paper model (3). gamma = sA^2 / sE^2; sE^2 profiled out in closed form. */
  S.groupSummaries = function (values, groupIdx, G) {
    const n = new Float64Array(G), sum = new Float64Array(G), ss = new Float64Array(G);
    for (let k = 0; k < values.length; k++) {
      const g = groupIdx[k];
      if (g < 0) continue;
      const v = values[k];
      n[g] += 1; sum[g] += v; ss[g] += v * v;
    }
    return { n, sum, ss };
  };

  function prep(gs) {
    const G = gs.n.length;
    const n = [], ybar = [];
    let Wtot = 0, N = 0;
    for (let i = 0; i < G; i++) {
      const ni = gs.n[i];
      if (ni <= 0) continue;
      const yb = gs.sum[i] / ni;
      n.push(ni); ybar.push(yb);
      Wtot += Math.max(0, gs.ss[i] - ni * yb * yb);
      N += ni;
    }
    return { n, ybar, Wtot, N };
  }

  function profile(P, gamma) {
    let sw = 0, swy = 0, sl = 0;
    const { n, ybar } = P;
    for (let i = 0; i < n.length; i++) {
      const w = n[i] / (1 + n[i] * gamma);
      sw += w; swy += w * ybar[i];
      sl += Math.log(1 + n[i] * gamma);
    }
    const mu = swy / sw;
    let Q = P.Wtot;
    for (let i = 0; i < n.length; i++) {
      const d = ybar[i] - mu;
      Q += (n[i] / (1 + n[i] * gamma)) * d * d;
    }
    const s2e = Q / (P.N - 1);
    const ll = -0.5 * ((P.N - 1) * Math.log(s2e) + sl + Math.log(sw));
    return { ll, s2e, mu };
  }

  S.remlFit = function (gs, withCI) {
    const P = prep(gs);
    if (P.n.length < 2 || P.N < 3) return null;
    const f = g => profile(P, g).ll;
    // coarse grid on log(gamma), then golden-section refinement
    const lo = -12, hi = 6, steps = 48;
    let bestU = lo, bestLL = -Infinity;
    for (let s = 0; s <= steps; s++) {
      const u = lo + (hi - lo) * s / steps;
      const v = f(Math.exp(u));
      if (v > bestLL) { bestLL = v; bestU = u; }
    }
    let a = Math.max(lo, bestU - (hi - lo) / steps), b = Math.min(hi, bestU + (hi - lo) / steps);
    const gr = (Math.sqrt(5) - 1) / 2;
    let c = b - gr * (b - a), d = a + gr * (b - a);
    let fc = f(Math.exp(c)), fd = f(Math.exp(d));
    for (let it = 0; it < 40; it++) {
      if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(Math.exp(c)); }
      else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(Math.exp(d)); }
    }
    let gamma = Math.exp((a + b) / 2);
    let ll = f(gamma);
    const ll0 = f(0);
    if (ll0 >= ll) { gamma = 0; ll = ll0; }
    const pr = profile(P, gamma);
    const out = { gamma, ll, mu: pr.mu, sigmaE: Math.sqrt(pr.s2e), sigmaA: Math.sqrt(gamma * pr.s2e), N: P.N, groups: P.n.length };
    if (withCI) out.ci = plCI(P, out);
    return out;
  };

  // Full REML log-likelihood (up to a constant) at sA^2 and sE^2, with mu profiled out.
  function remlLL(P, sA2, s2e) {
    const g = sA2 / s2e, { n, ybar } = P;
    let sw = 0, swy = 0, sl = 0;
    for (let i = 0; i < n.length; i++) {
      const w = n[i] / (1 + n[i] * g);
      sw += w; swy += w * ybar[i];
      sl += Math.log(1 + n[i] * g);
    }
    const mu = swy / sw;
    let Q = P.Wtot;
    for (let i = 0; i < n.length; i++) { const d = ybar[i] - mu; Q += (n[i] / (1 + n[i] * g)) * d * d; }
    return -0.5 * ((P.N - 1) * Math.log(s2e) + sl + Math.log(sw) + Q / s2e);
  }

  // Profile log-likelihood of sigma_A: sE^2 maximised out (grid on log sE^2, then golden section).
  function profileSA(P, sA, s2eLo, s2eHi) {
    const f = u => remlLL(P, sA * sA, Math.exp(u));
    const lo = Math.log(s2eLo) - 7, hi = Math.log(s2eHi) + 3, steps = 40;
    let bestU = lo, bestV = -Infinity;
    for (let s = 0; s <= steps; s++) {
      const u = lo + (hi - lo) * s / steps, v = f(u);
      if (v > bestV) { bestV = v; bestU = u; }
    }
    let a = bestU - (hi - lo) / steps, b = bestU + (hi - lo) / steps;
    const gr = (Math.sqrt(5) - 1) / 2;
    let c = b - gr * (b - a), d = a + gr * (b - a), fc = f(c), fd = f(d);
    for (let it = 0; it < 60; it++) {
      if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
      else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
    }
    return Math.max(bestV, f((a + b) / 2));
  }

  // Profile-likelihood 95% CI for sigma_A itself (chi-square 1 df: drop of 1.92 in log-lik).
  // Profiling sigma_A directly, not the variance ratio, so the interval is the one its label claims.
  function plCI(P, fit) {
    const sHat = fit.sigmaA, s2eHat = fit.sigmaE * fit.sigmaE, s2Tot = s2eHat + sHat * sHat;
    const llHat = Math.max(remlLL(P, sHat * sHat, s2eHat), profileSA(P, sHat, s2eHat, s2Tot));
    const target = llHat - 1.920729;
    const f = sA => profileSA(P, sA, s2eHat, s2Tot) - target;
    let lower = 0;
    if (sHat > 0 && f(0) < 0) {
      let a = 0, b = sHat;
      for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (f(m) < 0) a = m; else b = m; }
      lower = (a + b) / 2;
    }
    let b = Math.max(sHat * 2, 0.1 * fit.sigmaE), guard = 0;
    while (f(b) > 0 && guard++ < 60) b *= 2;
    let a = sHat;
    for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
    return [lower, (a + b) / 2];
  }

  /** Empirical-Bayes (BLUP) manager effects with posterior SDs. */
  S.empiricalBayes = function (gs, fit) {
    const G = gs.n.length, out = [];
    const g = fit.gamma, s2e = fit.sigmaE * fit.sigmaE;
    for (let i = 0; i < G; i++) {
      const ni = gs.n[i];
      if (ni <= 0) { out.push(null); continue; }
      const raw = gs.sum[i] / ni;
      const lam = (ni * g) / (1 + ni * g);
      out.push({ n: ni, raw, eb: lam * (raw - fit.mu), lambda: lam, postSd: Math.sqrt(s2e * lam / ni) });
    }
    return out;
  };

  /** Reliability of an individual manager estimate after n random assignments. */
  S.reliability = (n, sA, sE) => (n * sA * sA) / (n * sA * sA + sE * sE);

  /* ---------- the full pipeline (paper models 1–3) ---------- */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  S.analyze = function (input, opts) {
    opts = Object.assign({ normalize: true, conditioning: 'skills', skillCols: [], skillMode: 'composite', teamControls: [], minTeams: 2, level: 0.9, seed: 7 }, opts || {});
    const people = input.people || {};
    const warnings = [];

    // 1. Usable teams
    let teams = input.teams.filter(t => t.manager && isNum(t.score));
    const droppedScore = input.teams.length - teams.length;
    if (droppedScore) warnings.push(droppedScore + ' team rows had no manager or no numeric score and were skipped.');

    // 2. Person-level skill scores (standardised across everyone who has them)
    const useSkills = opts.conditioning === 'skills' && opts.skillCols.length > 0;
    const zBy = {};
    if (useSkills) {
      for (const col of opts.skillCols) {
        const ids = Object.keys(people).filter(id => isNum(people[id][col]));
        const z = S.zscore(ids.map(id => people[id][col]));
        zBy[col] = {};
        ids.forEach((id, k) => { zBy[col][id] = z[k]; });
      }
      if (opts.skillMode === 'composite') {
        const ids = Object.keys(people);
        const comp = {}, vals = [], have = [];
        for (const id of ids) {
          const zs = opts.skillCols.map(c => zBy[c][id]).filter(isNum);
          if (zs.length) { have.push(id); vals.push(S.mean(zs)); }
        }
        const z = S.zscore(vals);
        have.forEach((id, k) => { comp[id] = z[k]; });
        zBy.__composite = comp;
      }
    }
    const skillKeys = !useSkills ? [] : (opts.skillMode === 'composite' ? ['__composite'] : opts.skillCols.slice());
    const labelFor = k => (k === '__composite' ? 'task skill' : k);

    // 3. Team-level covariates: manager skill, mean worker skill, design controls
    const rows = [];
    let droppedSkill = 0;
    for (const t of teams) {
      const feat = [];
      let ok = true;
      for (const k of skillKeys) {
        const m = zBy[k][t.manager];
        const ws = t.members.map(w => zBy[k][w]).filter(isNum);
        if (!isNum(m) || ws.length === 0) { ok = false; break; }
        feat.push(m, S.mean(ws));
      }
      if (!ok) { droppedSkill++; continue; }
      rows.push({ t, feat });
    }
    if (droppedSkill) warnings.push(droppedSkill + ' team rows were skipped because the manager or every member lacked skill scores in the people file.');
    if (rows.length < 10) throw new Error('Only ' + rows.length + ' usable team rows. The method needs many teams; check the column mapping.');

    // round normalisation of team score (paper fn. 14)
    const roundKeys = [...new Set(rows.map(r => String(r.t.round)))].sort((a, b) => (isFinite(a) && isFinite(b) ? a - b : a.localeCompare(b)));
    const roundIdx = new Map(roundKeys.map((k, i) => [k, i]));
    const G = new Array(rows.length);
    if (opts.normalize) {
      for (const rk of roundKeys) {
        const idx = rows.map((r, i) => (String(r.t.round) === rk ? i : -1)).filter(i => i >= 0);
        const z = S.zscore(idx.map(i => rows[i].t.score));
        idx.forEach((i, k) => { G[i] = z[k]; });
      }
    } else {
      const z = S.zscore(rows.map(r => r.t.score));
      z.forEach((v, i) => { G[i] = v; });
    }

    // standardise skill covariates across teams so coefficients are SD-per-SD
    const names = ['Intercept'];
    const cols = [];
    skillKeys.forEach((k, j) => {
      names.push("Manager's " + labelFor(k), "Members' mean " + labelFor(k));
      cols.push(S.zscore(rows.map(r => r.feat[2 * j])), S.zscore(rows.map(r => r.feat[2 * j + 1])));
    });
    // design controls (numeric standardised; categorical dummy-coded)
    for (const c of opts.teamControls) {
      const vals = rows.map(r => r.t.controls ? r.t.controls[c] : null);
      const numeric = vals.every(v => isNum(v));
      if (numeric) {
        if (S.sd(vals) > 0) { names.push(c); cols.push(S.zscore(vals)); }
      } else {
        const levels = [...new Set(vals.map(v => String(v)))].sort();
        for (const lv of levels.slice(1)) { names.push(c + ' = ' + lv); cols.push(vals.map(v => (String(v) === lv ? 1 : 0))); }
      }
    }
    const X = rows.map((r, i) => [1].concat(cols.map(col => col[i])));
    const model = S.ols(X, G);
    const resid = model.resid;

    // 4. Manager groups
    const mgrIds = [...new Set(rows.map(r => r.t.manager))];
    const mgrIndex = new Map(mgrIds.map((id, i) => [id, i]));
    const teamMgr = rows.map(r => mgrIndex.get(r.t.manager));
    const teamRound = rows.map(r => roundIdx.get(String(r.t.round)));
    const gsM = S.groupSummaries(resid, teamMgr, mgrIds.length);
    const fitM = S.remlFit(gsM, true);
    if (!fitM) throw new Error('Too few managers or teams to fit the multilevel model.');
    const eb = S.empiricalBayes(gsM, fitM);
    const z = S.normQuantile(0.5 + opts.level / 2);
    let managers = mgrIds.map((id, i) => {
      const e = eb[i];
      const lo = e.eb - z * e.postSd, hi = e.eb + z * e.postSd;
      return { id, n: e.n, raw: e.raw, eb: e.eb, postSd: e.postSd, lambda: e.lambda, lo, hi, cls: lo > 0 ? 'above' : hi < 0 ? 'below' : 'unclear' };
    });
    const sortedEb = managers.map(m => m.eb).sort((a, b) => a - b);
    managers.forEach(m => {
      let k = 0; while (k < sortedEb.length && sortedEb[k] < m.eb) k++;
      m.pct = Math.round(100 * (k + 0.5) / sortedEb.length);
    });
    managers.sort((a, b) => a.eb - b.eb);
    const reliability = S.mean(managers.map(m => m.lambda));

    // 5. Worker (member) effects, model (5)
    const wIds = [], wIndex = new Map(), wVals = [], wGrp = [];
    rows.forEach((r, i) => {
      for (const w of r.t.members) {
        if (!wIndex.has(w)) { wIndex.set(w, wIds.length); wIds.push(w); }
        wVals.push(resid[i]); wGrp.push(wIndex.get(w));
      }
    });
    const fitW = wIds.length > 2 ? S.remlFit(S.groupSummaries(wVals, wGrp, wIds.length), true) : null;

    // 6. Leave-one-round-out validation (paper Table 4, skill-adjusted)
    let loo = null;
    if (roundKeys.length >= 2) {
      const xs = [], ys = [], per = [];
      for (let r = 0; r < roundKeys.length; r++) {
        const tr = [], te = [];
        for (let i = 0; i < rows.length; i++) (teamRound[i] === r ? te : tr).push(i);
        if (tr.length < X[0].length + 5 || te.length < 2) continue;
        let m;
        try { m = S.ols(tr.map(i => X[i]), tr.map(i => G[i])); } catch (e) { continue; }
        const sum = new Map(), cnt = new Map();
        tr.forEach((i, k) => { const g = teamMgr[i]; sum.set(g, (sum.get(g) || 0) + m.resid[k]); cnt.set(g, (cnt.get(g) || 0) + 1); });
        const rx = [], ry = [];
        for (const i of te) {
          const g = teamMgr[i];
          if (!cnt.has(g)) continue;
          const pred = X[i].reduce((s, v, j) => s + v * m.beta[j], 0);
          rx.push(sum.get(g) / cnt.get(g)); ry.push(G[i] - pred);
        }
        if (rx.length >= 5) {
          const c = S.cor(rx, ry);
          per.push({ round: roundKeys[r], n: rx.length, r: c.r });
          rx.forEach((v, k) => { xs.push(v); ys.push(ry[k]); });
        }
      }
      if (xs.length >= 10) {
        const fitL = S.ols(xs.map(v => [1, v]), ys);
        const c = S.cor(xs, ys);
        loo = { slope: fitL.beta[1], se: fitL.se[1], p: fitL.p[1], r: c.r, rLo: c.lo, rHi: c.hi, n: xs.length, per, xs, ys, intercept: fitL.beta[0] };
      }
    }

    // 7. What predicts the manager effect (paper Table 5, Figure 6)
    const eligible = managers.filter(m => m.n >= opts.minTeams);
    const predictors = [];
    const pcols = input.peopleCols || [];
    for (const col of pcols) {
      let vals = eligible.map(m => (people[m.id] ? people[m.id][col] : null));
      let label = col, numeric = true;
      const present = vals.filter(v => v !== null && v !== undefined && v !== '');
      if (present.length < 8) continue;
      if (!present.every(isNum)) {
        const lv = [...new Set(present.map(String))].sort();
        if (lv.length !== 2) continue;
        numeric = false;
        label = col + ' = ' + lv[1];
        vals = vals.map(v => (v === null || v === undefined || v === '' ? null : (String(v) === lv[1] ? 1 : 0)));
      }
      const xs = [], ys = [];
      vals.forEach((v, k) => { if (isNum(v)) { xs.push(v); ys.push(eligible[k].raw); } });
      if (xs.length < 8 || S.sd(xs) === 0) continue;
      const c = S.cor(xs, ys);
      const controlled = opts.conditioning === 'skills' && opts.skillCols.includes(col);
      const binary = new Set(xs).size === 2;
      // selection rule: appoint the top third on this measure (binary: only those coded 1).
      // Ties are broken at random so the order of the input never leaks into the result.
      let top;
      if (binary) {
        const hiVal = Math.max(...xs);
        top = ys.filter((_, k) => xs[k] === hiVal);
      } else {
        const tie = S.rng(opts.seed + col.length * 31);
        const jitter = xs.map(() => tie());
        const order = xs.map((v, k) => k).sort((a, b) => (xs[b] - xs[a]) || (jitter[a] - jitter[b]));
        top = order.slice(0, Math.max(2, Math.round(xs.length / 3))).map(k => ys[k]);
      }
      predictors.push({ col, label, binary, r: c.r, lo: c.lo, hi: c.hi, p: c.p, n: c.n, controlled, topMean: S.mean(top), topSe: S.sd(top) / Math.sqrt(top.length), topN: top.length });
    }
    predictors.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    // reference: appointing a random third
    let randomThird = null;
    if (eligible.length >= 6) {
      const rand = S.rng(opts.seed + 99);
      const k3 = Math.max(2, Math.round(eligible.length / 3));
      const draws = [];
      const idx = eligible.map((_, i) => i);
      for (let d = 0; d < 2000; d++) {
        S.shuffle(idx, rand);
        let s = 0; for (let k = 0; k < k3; k++) s += eligible[idx[k]].raw;
        draws.push(s / k3);
      }
      draws.sort((a, b) => a - b);
      randomThird = { mean: S.mean(draws), lo: draws[Math.floor(0.025 * draws.length)], hi: draws[Math.floor(0.975 * draws.length)], k: k3 };
    }

    return {
      opts, warnings,
      nTeams: rows.length, nManagers: mgrIds.length, nMembers: wIds.length, rounds: roundKeys,
      model: { names, beta: model.beta, se: model.se, p: model.p, r2: model.r2, adjR2: model.adjR2, n: model.n, df: model.df },
      fit: fitM, reliability, managers, workers: fitW,
      loo, predictors, randomThird,
      ri: { resid, teamMgr, teamRound, nRounds: roundKeys.length, nMgr: mgrIds.length },
      teamsPerManager: { min: Math.min(...managers.map(m => m.n)), max: Math.max(...managers.map(m => m.n)), mean: S.mean(managers.map(m => m.n)) }
    };
  };

  /* ---------- randomization inference (paper section 3.4) ----------
   * Keep the skill-adjusted team scores fixed; re-draw which manager led which
   * team, blocked on round so every manager keeps the same number of teams per
   * round; refit model (3) and record sigma_alpha under the null. */
  S.riRunner = function (ri, seed) {
    const rand = S.rng(seed);
    const byRound = Array.from({ length: ri.nRounds }, () => []);
    ri.teamRound.forEach((r, i) => byRound[r].push(i));
    const perm = ri.teamMgr.slice();
    return function draw(k) {
      const out = [];
      for (let d = 0; d < k; d++) {
        for (const idx of byRound) {
          const labels = idx.map(i => ri.teamMgr[i]);
          S.shuffle(labels, rand);
          idx.forEach((i, j) => { perm[i] = labels[j]; });
        }
        const fit = S.remlFit(S.groupSummaries(ri.resid, perm, ri.nMgr), false);
        out.push(fit ? fit.sigmaA : 0);
      }
      return out;
    };
  };

  /* ---------- example data that mirrors Study 1 ---------- */
  S.simulateExample = function (seed) {
    const rand = S.rng(seed || 36);
    const N = () => S.randn(rand);
    const nM = 90, nW = 180, R = 4;
    const people = [];
    const pad = (n, w) => String(n).padStart(w, '0');
    function person(id, role) {
      const g = N();
      const p = {
        person_id: id, role,
        task_numerical: 0.55 * g + 0.83 * N(),
        task_spatial: 0.45 * g + 0.89 * N(),
        task_analytical: 0.5 * g + 0.87 * N(),
        fluid_iq: 0.6 * g + 0.8 * N(),
        econ_decision: 0.45 * g + 0.89 * N(),
        emotion_perception: 0.2 * g + 0.98 * N(),
        extraversion: N(),
        female: rand() < 0.46 ? 1 : 0,
        age: Math.round(19 + 14 * rand() * rand() + 3 * rand())
      };
      return p;
    }
    for (let i = 1; i <= nM; i++) {
      const p = person('M' + pad(i, 3), 'manager');
      p.self_promoted = i > nM / 2 ? 1 : 0;
      if (p.self_promoted) p.extraversion += 0.6;
      const zq = 0.3 * p.econ_decision + 0.25 * p.fluid_iq + 0.12 * p.emotion_perception + 0.883 * N();
      p._alpha = 0.25 * zq - (p.self_promoted ? 0.1 + 0.06 * p.extraversion : 0);
      people.push(p);
    }
    for (let i = 1; i <= nW; i++) { const p = person('W' + pad(i, 3), 'member'); p.self_promoted = null; p._theta = 0.04 * N(); people.push(p); }
    const byId = Object.fromEntries(people.map(p => [p.person_id, p]));
    const task = p => (p.task_numerical + p.task_spatial + p.task_analytical) / 3;
    const managers = people.filter(p => p.role === 'manager');
    const workers = people.filter(p => p.role === 'member');
    const teams = [];
    for (let r = 1; r <= R; r++) {
      const ws = S.shuffle(workers.slice(), rand);
      managers.forEach((m, j) => {
        const mem = [ws[2 * j], ws[2 * j + 1]];
        const wSkill = (task(mem[0]) + task(mem[1])) / 2 / 0.6;
        const g = 0.21 * task(m) / 0.75 + 0.26 * wSkill + m._alpha + mem[0]._theta + mem[1]._theta + 0.9 * N();
        const raw = 11 + (r - 2.5) * 1.2 + 3.2 * g;
        teams.push({
          round: r, team_id: 'R' + r + '-T' + pad(j + 1, 2), manager_id: m.person_id,
          member_ids: mem.map(x => x.person_id).join(';'),
          team_score: Math.round(raw * 2) / 2,
          arm: m.self_promoted ? 'self-promotion' : 'lottery'
        });
      });
    }
    const r2 = v => Math.round(v * 100) / 100;
    const peopleOut = people.map(p => ({
      person_id: p.person_id, role: p.role,
      task_numerical: r2(p.task_numerical), task_spatial: r2(p.task_spatial), task_analytical: r2(p.task_analytical),
      fluid_iq: r2(p.fluid_iq), econ_decision: r2(p.econ_decision), emotion_perception: r2(p.emotion_perception),
      extraversion: r2(p.extraversion), female: p.female, age: p.age
    }));
    const truth = Object.fromEntries(managers.map(m => [m.person_id, m._alpha]));
    return { teams, people: peopleOut, truth };
  };

  /* ---------- rotation planner (paper section 2.2) ---------- */
  S.planRotation = function (managers, members, k, rounds, seed) {
    const rand = S.rng(seed);
    const need = managers.length * k;
    if (members.length < need) throw new Error('You need at least ' + need + ' team members for ' + managers.length + ' managers with ' + k + ' members each (you have ' + members.length + '). Reduce team size or split managers into cohorts.');
    const pairMW = new Map(), pairWW = new Map(), used = new Map(members.map(m => [m, 0]));
    const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    const plan = [];
    const attempts = Math.max(8, Math.min(300, Math.floor(3e6 / (managers.length * k * need + 1))));
    for (let r = 1; r <= rounds; r++) {
      let best = null, bestCost = Infinity;
      for (let attempt = 0; attempt < attempts; attempt++) {
        // members who have sat out most often are used first; then a randomised greedy fill
        const pool = S.shuffle(members.slice(), rand).sort((a, b) => used.get(a) - used.get(b)).slice(0, need);
        S.shuffle(pool, rand);
        const remaining = new Set(pool);
        const order = S.shuffle(managers.map((m, j) => j), rand);
        const teams = new Array(managers.length);
        let cost = 0;
        for (const j of order) {
          const m = managers[j], mem = [];
          for (let s = 0; s < k; s++) {
            let pick = null, pc = Infinity;
            for (const w of remaining) {
              let c = 4 * (pairMW.get(m + '|' + w) || 0);
              for (const x of mem) c += pairWW.get(key(x, w)) || 0;
              if (c < pc) { pc = c; pick = w; if (c === 0) break; }
            }
            mem.push(pick); remaining.delete(pick); cost += pc;
          }
          teams[j] = { manager: m, members: mem };
        }
        if (cost < bestCost) { bestCost = cost; best = teams; if (cost === 0) break; }
      }
      best.forEach((t, j) => {
        for (const w of t.members) { pairMW.set(t.manager + '|' + w, (pairMW.get(t.manager + '|' + w) || 0) + 1); used.set(w, used.get(w) + 1); }
        for (let a = 0; a < t.members.length; a++) for (let b = a + 1; b < t.members.length; b++) { const kk = key(t.members[a], t.members[b]); pairWW.set(kk, (pairWW.get(kk) || 0) + 1); }
        plan.push({ round: r, team_id: 'R' + r + '-T' + String(j + 1).padStart(String(managers.length).length, '0'), manager: t.manager, members: t.members });
      });
    }
    let maxMW = 0; for (const v of pairMW.values()) maxMW = Math.max(maxMW, v);
    let repeatsWW = 0; for (const v of pairWW.values()) if (v > 1) repeatsWW += v - 1;
    return { plan, maxRepeatManagerMember: maxMW, repeatMemberPairs: repeatsWW, sittingOutPerRound: members.length - need };
  };

  /* ---------- AI leadership test scoring (Study 2) ---------- */
  S.correctDist = function (answerIdx, k) {
    const d = new Array(k).fill(0);
    answerIdx.forEach(i => { d[i] = 100 / answerIdx.length; });
    return d;
  };
  /** 100 x (1 - total variation distance) between submitted and correct credences. */
  S.credenceScore = function (given, correct) {
    let tv = 0;
    for (let i = 0; i < correct.length; i++) tv += Math.abs((given[i] || 0) - correct[i]);
    return 100 * (1 - tv / 200);
  };

  /** Two-sided critical value of the t distribution (e.g. level 0.95). */
  S.tCrit = function (df, level) {
    const alpha = 1 - (level || 0.95);
    let a = 0, b = 1000;
    for (let it = 0; it < 100; it++) { const m = (a + b) / 2; if (S.pT2(m, df) > alpha) a = m; else b = m; }
    return (a + b) / 2;
  };

  /* ---------- AI leadership test: a group of leaders (Study 2, models 1–3) ----------
   * Everyone leads the same AI teammates, so there is no teammate skill to adjust for.
   * Puzzle scores are standardised within puzzle (puzzles differ in difficulty), model (1)
   * regresses them on the leader's solo warm-up score (the hard skill), and each leader's
   * contribution is the mean residual, shrunk with the REML model (3). */
  const num = v => {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    const t = String(v).trim().replace(/^[−–]/, '-').replace(/^(-?\d+),(\d+)$/, '$1.$2');
    return t === '' ? NaN : Number(t);
  };
  /** Rows of the test's results CSV -> leaders { id, solo, soloPuzzles: { s1: score, … }, puzzles: { t1: score, … }, engine, model, version }. */
  S.aiGroupRows = function (rows) {
    return rows.map(r => {
      const team = {}, solo = {};
      for (const [col, v] of Object.entries(r)) {
        const x = num(v);
        if (!isNum(x)) continue;
        const mt = /^(t\d+)_q\d+$/i.exec(col), ms = /^(s\d+|solo)_q\d+$/i.exec(col);
        if (mt) (team[mt[1].toLowerCase()] = team[mt[1].toLowerCase()] || []).push(x);
        else if (ms) (solo[ms[1].toLowerCase()] = solo[ms[1].toLowerCase()] || []).push(x);
      }
      const puzzles = {}, soloPuzzles = {};
      for (const [id, xs] of Object.entries(team)) puzzles[id] = S.mean(xs);
      for (const [id, xs] of Object.entries(solo)) soloPuzzles[id] = S.mean(xs);
      let soloScore = num(r.solo_score);
      if (!isNum(soloScore) && Object.keys(solo).length) soloScore = S.mean(Object.values(solo).flat());
      return { id: String(r.name || '').trim(), solo: soloScore, soloPuzzles, puzzles, engine: String(r.engine || '').trim() || 'unknown', model: String(r.model || '').trim(), version: String(r.test_version || '').trim() || '1' };
    }).filter(l => Object.keys(l.puzzles).length);
  };

  S.aiGroup = function (leaders, opts) {
    opts = Object.assign({ adjust: true, level: 0.95 }, opts || {});
    const warnings = [];
    let L = leaders.filter(l => Object.values(l.puzzles).filter(isNum).length >= 2);
    if (L.length < leaders.length) warnings.push((leaders.length - L.length) + ' people finished fewer than two team puzzles and were left out.');
    let useSolo = opts.adjust && L.some(l => isNum(l.solo));
    if (useSolo) {
      const before = L.length;
      L = L.filter(l => isNum(l.solo));
      if (L.length < before) warnings.push((before - L.length) + ' people skipped the solo warm-up and were left out, because their results cannot be adjusted for reasoning skill.');
    } else if (opts.adjust) warnings.push('Nobody has a solo warm-up score, so these are total contributions, not adjusted for reasoning skill.');
    if (L.length < 5) throw new Error('Load results from at least 5 people who completed the team puzzles' + (useSolo ? ' and the solo warm-up' : '') + '.');
    if (L.length < 20) warnings.push('With ' + L.length + ' people the estimates, and especially the typical effect, are very imprecise. Aim for 20 or more.');

    const pids = [...new Set(L.flatMap(l => Object.keys(l.puzzles)))].sort();
    const obs = [], used = [];
    for (const pid of pids) {
      const idx = L.map((l, i) => (isNum(l.puzzles[pid]) ? i : -1)).filter(i => i >= 0);
      const vals = idx.map(i => L[i].puzzles[pid]);
      if (idx.length < 3 || !(S.sd(vals) > 0)) { warnings.push('Puzzle ' + pid + ' was left out: too few people or no variation in scores.'); continue; }
      const z = S.zscore(vals);
      idx.forEach((i, k) => obs.push({ li: i, y: z[k] }));
      used.push(pid);
    }
    if (obs.length < 10) throw new Error('Too few puzzle results to fit the model.');
    // Solo skill: standardise each warm-up puzzle across the group and average a person's puzzles,
    // so people who did one or three warm-ups (which differ in difficulty) are on the same scale.
    let skill = null;
    if (useSolo) {
      const sids = [...new Set(L.flatMap(l => Object.keys(l.soloPuzzles || {})))].sort(), zs = L.map(() => []);
      for (const sid of sids) {
        const idx = L.map((l, i) => (l.soloPuzzles && isNum(l.soloPuzzles[sid]) ? i : -1)).filter(i => i >= 0);
        const vals = idx.map(i => L[i].soloPuzzles[sid]);
        if (idx.length < 3 || !(S.sd(vals) > 0)) continue;
        const z = S.zscore(vals);
        idx.forEach((i, k) => zs[i].push(z[k]));
      }
      skill = zs.every(z => z.length) ? zs.map(z => S.mean(z)) : L.map(l => l.solo);
      if (new Set(L.map(l => Object.keys(l.soloPuzzles || {}).length)).size > 1) warnings.push('People did different numbers of warm-up puzzles. Each warm-up puzzle was standardised across the group before averaging, so skill scores are on one scale, but those based on one puzzle are noisier.');
      if (!(S.sd(skill) > 0)) { useSolo = false; skill = null; warnings.push('Everyone has the same solo score, so it cannot be used as a control.'); }
    }
    const soloZ = useSolo ? S.zscore(skill) : null;
    const X = obs.map(o => (useSolo ? [1, soloZ[o.li]] : [1]));
    const y = obs.map(o => o.y), grp = obs.map(o => o.li);
    const model = S.ols(X, y);
    const gsRaw = S.groupSummaries(y, grp, L.length), gs = S.groupSummaries(model.resid, grp, L.length);
    const fit = S.remlFit(gs, true);
    if (!fit) throw new Error('Too few people or puzzles to fit the multilevel model.');
    const eb = S.empiricalBayes(gs, fit), zq = S.normQuantile(0.5 + opts.level / 2);
    const people = L.map((l, i) => {
      const e = eb[i], lo = e.eb - zq * e.postSd, hi = e.eb + zq * e.postSd;
      const scores = used.map(p => l.puzzles[p]).filter(isNum);
      return { id: l.id, engine: l.engine, model: l.model, version: l.version, solo: l.solo, score: S.mean(scores), n: e.n, total: gsRaw.sum[i] / gsRaw.n[i], raw: e.raw, eb: e.eb, postSd: e.postSd, lambda: e.lambda, lo, hi, cls: lo > 0 ? 'above' : hi < 0 ? 'below' : 'unclear' };
    });
    const sorted = people.map(p => p.eb).sort((a, b) => a - b);
    people.forEach(p => { let k = 0; while (k < sorted.length && sorted[k] < p.eb) k++; p.pct = Math.round(100 * (k + 0.5) / sorted.length); });
    const soloCor = useSolo ? S.cor(skill, people.map(p => p.total)) : null;
    people.sort((a, b) => b.eb - a.eb);
    return {
      opts, warnings, useSolo, fit, people, puzzles: used, nPeople: L.length, nObs: obs.length,
      soloBeta: useSolo ? { b: model.beta[1], se: model.se[1], p: model.p[1] } : null,
      soloCor,
      reliability: S.mean(people.map(p => p.lambda)), puzzlesPerPerson: S.mean(people.map(p => p.n))
    };
  };

  /** Simulated results files for a group: leadership and solo reasoning skill both raise team scores. */
  S.simulateAIGroup = function (seed, n, opts) {
    opts = opts || {};
    const rand = S.rng(seed || 51), N = () => S.randn(rand);
    const clamp = x => Math.max(0, Math.min(100, Math.round(x)));
    const base = { t1: 66, t2: 52, t3: 70, t4: 58 }, rows = [], truth = {};
    for (let i = 0; i < (n || 40); i++) {
      const id = 'P' + String(i + 1).padStart(2, '0'), skill = N(), lead = N();
      truth[id] = lead;
      const row = { name: id, engine: 'simulated', model: '', test_version: '2' };
      const solo = [];
      // warm-ups differ in difficulty; with mixWarmups every other person does only the first one
      Object.entries({ s1: 78, s2: 66, s3: 71 }).forEach(([p, b], k) => [1, 2].forEach(q => { const v = clamp(b + 13 * skill + 12 * N()); if (k && opts.mixWarmups && i % 2) return; row[p + '_q' + q] = v; solo.push(v); }));
      row.solo_score = S.mean(solo).toFixed(2);
      Object.keys(base).forEach(p => { const puzzle = 6 * N(); [1, 2].forEach(q => { row[p + '_q' + q] = clamp(base[p] + 7 * skill + 8 * lead + puzzle + 13 * N()); }); });
      rows.push(row);
    }
    return { rows, truth };
  };

  root.MEL = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
