/* Manager Effect Lab — user interface. */
(function () {
  'use strict';
  const S = window.MEL, PZ = window.MEL_PUZZLES, LLM = window.MEL_LLM;
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';

  /* ================= helpers ================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
    return el;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false && k !== ''));
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const minus = '−';
  const fmt = (x, d = 2) => (x == null || !isFinite(x)) ? '–' : (x < 0 && Math.abs(x) >= 0.5 * Math.pow(10, -d) ? minus : '') + Math.abs(x).toFixed(d);
  const fmtS = (x, d = 2) => (x == null || !isFinite(x)) ? '–' : (x > 0.5 * Math.pow(10, -d) ? '+' : x < -0.5 * Math.pow(10, -d) ? minus : '') + Math.abs(x).toFixed(d);
  const fmtP = p => (p == null || !isFinite(p)) ? '–' : p < 0.001 ? '< .001' : p.toFixed(3).replace(/^0/, '');
  const fmtInt = n => Number(n).toLocaleString('en-US');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mel.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mel.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem('mel.' + k); } catch (e) { /* storage unavailable */ } }
  };
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');

  /* ---------- files out ---------- */
  let downloadsCap = null;
  if (inClaude) window.claude.use('downloads').then(d => { downloadsCap = d; }).catch(() => {});
  async function offerFile(filename, content, mime) {
    if (downloadsCap) {
      try { await downloadsCap.save({ filename, data: content }); return; }
      catch (e) { if (e && e.code === 'declined') return; }
    }
    if (!inClaude) {
      const url = URL.createObjectURL(new Blob([content], { type: mime || 'text/plain;charset=utf-8' }));
      const a = h('a', { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return;
    }
    textModal(filename, content);
  }
  function textModal(title, content) {
    const ta = h('textarea', { readonly: true, style: { minHeight: '320px' } });
    ta.value = content;
    const status = h('span', { class: 'small muted' });
    const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-label': title },
        h('h3', { text: title }),
        h('p', { class: 'small muted', text: 'Saving files is not available here. Copy the text and save it as a file.' }),
        ta,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', type: 'button', onclick: async () => {
            try { await navigator.clipboard.writeText(content); status.textContent = 'Copied.'; }
            catch (e) { ta.select(); status.textContent = 'Press Ctrl+C (Cmd+C) to copy the selected text.'; }
          } }, 'Copy'),
          h('button', { class: 'btn', type: 'button', onclick: () => back.remove() }, 'Close'), status)));
    document.body.append(back);
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let q = false;
    for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
    const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = []; let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(v => v.trim() !== '')) rows.push(row);
    if (!rows.length) return { headers: [], rows: [], delim };
    const headers = rows[0].map((x, i) => x.trim() || 'column_' + (i + 1));
    const out = rows.slice(1).map(r => Object.fromEntries(headers.map((hd, i) => [hd, (r[i] == null ? '' : r[i]).trim()])));
    return { headers, rows: out, delim };
  }
  function toNum(v, delim) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let t = String(v).trim();
    if (t === '' || /^(na|n\/a|nan|null|none|-)$/i.test(t)) return null;
    if (delim === ';' && /^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
    const n = Number(t);
    return isFinite(n) ? n : null;
  }
  const isNumericCol = (rows, col, delim) => {
    let seen = 0;
    for (const r of rows) { const v = r[col]; if (v === '' || v == null) continue; if (toNum(v, delim) === null) return false; seen++; }
    return seen > 0;
  };
  const csvCell = v => { const t = v == null ? '' : String(v); return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const toCSV = (headers, rows) => [headers.join(',')].concat(rows.map(r => headers.map(k => csvCell(r[k])).join(','))).join('\n') + '\n';

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  function showTip(evt, html) {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = evt.clientX + 14, top = evt.clientY + 14;
    if (left + r.width > window.innerWidth - 8) left = evt.clientX - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = evt.clientY - r.height - 14;
    tip.style.left = Math.max(8, left) + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- chart primitives ---------- */
  function niceStep(range, n) {
    const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function ticks(min, max, n) {
    const st = niceStep((max - min) || 1, n || 5), out = [];
    for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  }
  const scale = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);
  function frame(W, H, m) {
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    return { svg, W, H, m, iw: W - m.l - m.r, ih: H - m.t - m.b };
  }
  function yAxis(f, y, tks, fmtF, label) {
    const g = s('g', { class: 'grid' });
    tks.forEach(t => {
      g.append(s('line', { x1: f.m.l, x2: f.W - f.m.r, y1: y(t), y2: y(t) }));
      f.svg.append(s('text', { x: f.m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, fmtF(t)));
    });
    f.svg.prepend(g);
    if (label) f.svg.append(s('text', { class: 'axis-label', x: 12, y: f.m.t + f.ih / 2, transform: `rotate(-90 12 ${f.m.t + f.ih / 2})`, 'text-anchor': 'middle' }, label));
  }
  function xAxis(f, x, tks, fmtF, label) {
    const g = s('g', { class: 'grid' });
    tks.forEach(t => {
      g.append(s('line', { x1: x(t), x2: x(t), y1: f.m.t, y2: f.H - f.m.b }));
      f.svg.append(s('text', { x: x(t), y: f.H - f.m.b + 16, 'text-anchor': 'middle' }, fmtF(t)));
    });
    f.svg.prepend(g);
    if (label) f.svg.append(s('text', { class: 'axis-label', x: f.m.l + f.iw / 2, y: f.H - 4, 'text-anchor': 'middle' }, label));
  }
  const clsColor = c => (c === 'above' ? 'var(--pos)' : c === 'below' ? 'var(--neg)' : 'var(--neutral)');

  /* ================= tabs ================= */
  const TABS = ['ai-test', 'method', 'design', 'analyze'];
  function showTab(name) {
    if (!TABS.includes(name)) name = 'ai-test';
    $$('[data-view]').forEach(v => { v.hidden = v.dataset.view !== name; });
    $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.tab === name ? 'page' : 'false'));
    if (name === 'analyze') ensureAnalysis();
    if (name === 'ai-test') AI.render();
    if (name === 'design') renderReliability();
  }
  window.addEventListener('hashchange', () => { showTab(location.hash.slice(1)); window.scrollTo(0, 0); });
  // a reload opens at the top, where an unfinished test can be resumed, not halfway down the start screen
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* not allowed here */ }

  /* ================= light / dark ================= */
  // follows the system until the reader picks a theme; the choice is remembered in this browser
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : !!(darkQuery && darkQuery.matches); };
  function syncThemeBtn() {
    const b = $('#theme-btn'); if (!b) return;
    const label = isDark() ? 'Switch to light mode' : 'Switch to dark mode';
    b.classList.toggle('is-dark', isDark()); b.setAttribute('aria-label', label); b.title = label;
  }
  (function initTheme() {
    const saved = store.get('theme', null);
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    syncThemeBtn();
    const b = $('#theme-btn');
    if (b) b.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; store.set('theme', t); syncThemeBtn(); });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', syncThemeBtn);
  })();

  /* ================= method illustration ================= */
  function renderIllustration() {
    const pred = [-0.45, 0.3, -0.1, 0.55], act = [-0.05, 0.55, 0.35, 0.8];
    const f = frame(560, 250, { l: 58, r: 16, t: 16, b: 34 });
    const x = i => f.m.l + (i + 0.5) * f.iw / 4;
    const y = scale(-0.8, 1.2, f.m.t + f.ih, f.m.t);
    yAxis(f, y, [-0.5, 0, 0.5, 1], v => fmt(v, 1), 'Team score (SD)');
    f.svg.append(s('line', { class: 'zero', x1: f.m.l, x2: f.W - f.m.r, y1: y(0), y2: y(0) }));
    pred.forEach((p, i) => {
      f.svg.append(s('line', { x1: x(i), x2: x(i), y1: y(p), y2: y(act[i]), stroke: 'var(--accent)', 'stroke-width': 2, opacity: 0.45 }));
      f.svg.append(s('circle', { cx: x(i), cy: y(p), r: 6, fill: 'var(--neutral)', stroke: 'var(--panel)', 'stroke-width': 2 }));
      f.svg.append(s('circle', { cx: x(i), cy: y(act[i]), r: 6, fill: 'var(--accent)', stroke: 'var(--panel)', 'stroke-width': 2 }));
      f.svg.append(s('text', { x: x(i) + 10, y: (y(p) + y(act[i])) / 2 + 4 }, fmtS(act[i] - p, 2)));
      f.svg.append(s('text', { x: x(i), y: f.H - f.m.b + 18, 'text-anchor': 'middle' }, 'Team ' + (i + 1)));
    });
    const avg = S.mean(act.map((a, i) => a - pred[i]));
    f.svg.append(s('text', { x: f.W - f.m.r, y: f.m.t + 4, 'text-anchor': 'end', style: 'font-weight:600;fill:var(--ink)' }, 'Average gap ' + fmtS(avg, 2) + ' SD = manager effect'));
    $('#illus').append(f.svg);
  }

  /* ================= design: reliability ================= */
  function renderReliability() {
    const sa = Math.max(0.01, +$('#rel-sa').value || 0.23), se = Math.max(0.05, +$('#rel-se').value || 0.9), n = +$('#rel-n').value;
    $('#rel-n-out').textContent = n;
    const rel = k => S.reliability(k, sa, se);
    const r = rel(n), half = 1.645 * Math.sqrt(sa * sa * (1 - r));
    const need = target => Math.ceil(target / (1 - target) * se * se / (sa * sa));
    const f = frame(520, 260, { l: 58, r: 20, t: 14, b: 40 });
    const N = 40, x = scale(1, N, f.m.l, f.W - f.m.r), y = scale(0, 1, f.m.t + f.ih, f.m.t);
    yAxis(f, y, [0, 0.25, 0.5, 0.75, 1], v => v.toFixed(2), 'Reliability');
    xAxis(f, x, [1, 10, 20, 30, 40], v => v, 'Teams led per manager');
    const ref = 0.7;
    f.svg.append(s('line', { x1: f.m.l, x2: f.W - f.m.r, y1: y(ref), y2: y(ref), stroke: 'var(--ink-3)', 'stroke-width': 1 }));
    f.svg.append(s('text', { x: f.W - f.m.r, y: y(ref) - 6, 'text-anchor': 'end' }, '0.70'));
    let d = '';
    for (let k = 1; k <= N; k++) d += (k === 1 ? 'M' : 'L') + x(k).toFixed(1) + ',' + y(rel(k)).toFixed(1);
    f.svg.append(s('path', { d: d + `L${x(N)},${y(0)}L${x(1)},${y(0)}Z`, fill: 'var(--accent)', opacity: 0.1 }));
    f.svg.append(s('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    f.svg.append(s('circle', { cx: x(n), cy: y(r), r: 5, fill: 'var(--accent)', stroke: 'var(--panel)', 'stroke-width': 2 }));
    f.svg.append(s('text', { x: x(n) + (n > 30 ? -10 : 10), y: y(r) + (r > 0.85 ? 18 : -10), 'text-anchor': n > 30 ? 'end' : 'start', style: 'font-weight:600;fill:var(--ink)' }, fmt(r, 2)));
    const hit = s('rect', { class: 'hit', x: f.m.l, y: f.m.t, width: f.iw, height: f.ih });
    hit.addEventListener('mousemove', e => {
      const bb = f.svg.getBoundingClientRect(), k = Math.max(1, Math.min(N, Math.round(1 + ((e.clientX - bb.left) / bb.width * f.W - f.m.l) / f.iw * (N - 1))));
      showTip(e, `<b>${k} teams</b> per manager<br>reliability ${fmt(rel(k), 2)}`);
    });
    hit.addEventListener('mouseleave', hideTip);
    f.svg.append(hit);
    put($('#rel-chart'), f.svg);
    put($('#rel-text'), 
      h('div', { class: 'stats' },
        h('div', { class: 'stat lead' }, h('span', { class: 'label' }, 'Reliability with ' + n + ' teams'), h('span', { class: 'value' }, fmt(r, 2)), h('span', { class: 'sub' }, 'share of spread in estimates that is real')),
        h('div', { class: 'stat' }, h('span', { class: 'label' }, '90% interval per manager'), h('span', { class: 'value' }, '±' + fmt(half, 2)), h('span', { class: 'sub' }, 'SD of team score, after shrinkage'))),
      h('p', { class: 'small' }, `Reaching reliability 0.70 takes about ${fmtInt(need(0.7))} teams per manager; 0.80 takes ${fmtInt(need(0.8))}.`),
      h('p', { class: 'small muted' }, 'Few rotations can still answer the population question — how much managers matter on average (σ', h('sub', {}, 'α'), ') — if you have many managers. That is what Study 1 did with 4 rotations. Ranking individuals needs more rotations or a task with larger leader effects, like the hidden-profile task in Study 2.'));
  }
  function initDesign() {
    const preset = (sa, se, on) => { $('#rel-sa').value = sa; $('#rel-se').value = se; $('#rel-p1').setAttribute('aria-pressed', on === 1); $('#rel-p2').setAttribute('aria-pressed', on === 2); if (on === 2) $('#rel-n').value = 6; else $('#rel-n').value = 4; renderReliability(); };
    $('#rel-p1').addEventListener('click', () => preset(0.23, 0.92, 1));
    $('#rel-p2').addEventListener('click', () => preset(0.55, 0.75, 2));
    ['#rel-sa', '#rel-se', '#rel-n'].forEach(id => $(id).addEventListener('input', () => { if (id !== '#rel-n') { $('#rel-p1').setAttribute('aria-pressed', 'false'); $('#rel-p2').setAttribute('aria-pressed', 'false'); } renderReliability(); }));
    const ids = (pfx, n) => Array.from({ length: n }, (_, i) => pfx + String(i + 1).padStart(String(n).length, '0'));
    $('#plan-ex').addEventListener('click', () => { $('#plan-m').value = ids('M', 12).join('\n'); $('#plan-w').value = ids('W', 26).join('\n'); });
    $('#plan-go').addEventListener('click', generatePlan);
  }
  function generatePlan() {
    const split = t => [...new Set(String(t).split(/[\n,;\t]+/).map(x => x.trim()).filter(Boolean))];
    const M = split($('#plan-m').value), W = split($('#plan-w').value);
    const k = Math.max(1, Math.round(+$('#plan-k').value || 2)), R = Math.max(1, Math.round(+$('#plan-r').value || 4));
    const out = $('#plan-out');
    const dup = M.filter(m => W.includes(m));
    if (M.length < 2 || W.length < 1) { put(out, h('p', { class: 'note warn' }, 'Enter at least two manager IDs and the team members to draw from.')); return; }
    if (dup.length) { put(out, h('p', { class: 'note warn' }, 'These IDs appear in both lists: ' + dup.slice(0, 6).join(', ') + '. Roles stay fixed in this design, so each person should be in one list only.')); return; }
    let res;
    try { res = S.planRotation(M, W, k, R, Math.round(+$('#plan-seed').value || 1)); }
    catch (e) { put(out, h('p', { class: 'note warn' }, e.message)); return; }
    const rows = res.plan.map(p => ({ round: p.round, team_id: p.team_id, manager_id: p.manager, member_ids: p.members.join(';'), team_score: '' }));
    put(out, 
      h('p', { class: 'note good' }, `${fmtInt(res.plan.length)} teams over ${R} rounds. ` +
        (res.maxRepeatManagerMember <= 1 ? 'No manager leads the same member twice. ' : `Some manager–member pairs repeat (at most ${res.maxRepeatManagerMember} times); add members or rounds can't avoid it. `) +
        (res.repeatMemberPairs ? `${res.repeatMemberPairs} member pairs work together more than once. ` : 'No two members share a team twice. ') +
        (res.sittingOutPerRound ? `${res.sittingOutPerRound} members sit out each round, rotating fairly.` : '')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => offerFile('rotation_plan.csv', toCSV(['round', 'team_id', 'manager_id', 'member_ids', 'team_score'], rows), 'text/csv') }, 'Download plan as CSV'),
        h('span', { class: 'small muted' }, 'Fill in team_score after each round, then load the file in step 2.')),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Round', 'Team', 'Manager', 'Members'].map((t, i) => h('th', { class: i ? '' : 'num' }, t)))),
        h('tbody', {}, rows.map(r => h('tr', {}, h('td', { class: 'num' }, r.round), h('td', {}, r.team_id), h('td', {}, r.manager_id), h('td', {}, r.member_ids.replace(/;/g, ', ')))))))
    );
  }

  /* ================= analyze ================= */
  const A = { teams: null, people: null, map: null, isExample: false, truth: null, result: null, riToken: 0, riDraws: null, sort: { key: 'eb', dir: -1 }, filter: '' };

  function ensureAnalysis() { if (!A.teams && !A.loading) loadExample(); }

  function loadExample() {
    A.loading = true;
    const ex = S.simulateExample();
    const tHead = Object.keys(ex.teams[0]), pHead = Object.keys(ex.people[0]);
    setData('teams', parseCSV(toCSV(tHead, ex.teams)), 'example_teams.csv');
    setData('people', parseCSV(toCSV(pHead, ex.people)), 'example_people.csv');
    A.isExample = true; A.truth = ex.truth;
    buildMapping();
    A.loading = false;
    run();
  }
  function setData(which, parsed, name) {
    A[which] = parsed; A[which].name = name;
    const st = $('#status-' + which);
    if (!parsed.headers.length) { st.textContent = 'No rows found in ' + name + '.'; return; }
    st.innerHTML = '';
    st.append(h('span', { class: 'mono' }, name), ' · ' + fmtInt(parsed.rows.length) + ' rows · ' + parsed.headers.length + ' columns');
  }
  function onUserData(which, parsed, name) {
    if (A.isExample) { const other = which === 'teams' ? 'people' : 'teams'; A[other] = null; $('#status-' + other).textContent = 'Not loaded yet.'; put($('#results')); }
    setData(which, parsed, name);
    A.isExample = false; A.truth = null;
    put($('#data-note'), );
    buildMapping();
    if (A.teams && A.teams.rows.length) { $('#map').open = true; run(); }
  }
  function initAnalyze() {
    $('#ex-load').addEventListener('click', loadExample);
    $('#tpl-dl').addEventListener('click', () => {
      offerFile('team_results_template.csv', 'round,team_id,manager_id,member_ids,team_score,arm\n1,R1-T01,M001,W014;W052,12.5,lottery\n1,R1-T02,M002,W003;W077,9,lottery\n', 'text/csv');
      setTimeout(() => offerFile('people_template.csv', 'person_id,task_numerical,task_spatial,task_analytical,fluid_iq,econ_decision\nM001,0.4,-0.2,1.1,0.3,0.8\nW014,-0.6,0.1,0.2,-0.4,0.0\n', 'text/csv'), 400);
    });
    for (const which of ['teams', 'people']) {
      const input = $('#file-' + which), zone = $('#drop-' + which), ta = $('#paste-' + which);
      const read = file => { const fr = new FileReader(); fr.onload = () => onUserData(which, parseCSV(fr.result), file.name); fr.readAsText(file); };
      input.addEventListener('change', () => { if (input.files[0]) read(input.files[0]); input.value = ''; });
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); });
      $(`[data-paste="${which}"]`).addEventListener('click', () => { ta.hidden = !ta.hidden; if (!ta.hidden) ta.focus(); });
      ta.addEventListener('change', () => { if (ta.value.trim()) onUserData(which, parseCSV(ta.value), 'pasted text'); });
    }
    $('#run').addEventListener('click', run);
  }

  function guess(headers, pats, exclude) {
    for (const re of pats) { const hit = headers.find(x => re.test(x) && !(exclude || []).includes(x)); if (hit) return hit; }
    return '';
  }
  function buildMapping() {
    const T = A.teams, P = A.people, prev = A.map || {};
    const m = { opts: prev.opts || { normalize: true, conditioning: 'skills', skillMode: 'composite', minTeams: 2, level: 0.9, draws: 1000 } };
    if (T) {
      const H = T.headers;
      m.round = guess(H, [/^round$/i, /round|wave|period|rotation/i]);
      m.manager = guess(H, [/^manager_?id$/i, /^leader_?id$/i, /manager|leader|boss|supervisor/i]);
      m.score = guess(H, [/^team_?score$/i, /score|performance|output|result|kpi|outcome/i]);
      m.team = guess(H, [/^team_?id$/i, /^team$/i, /^group/i], [m.manager, m.score]);
      m.members = H.filter(x => /member|worker|follower|employee|mates?$/i.test(x) && ![m.manager, m.score, m.team, m.round].includes(x));
      const used = [m.round, m.manager, m.score, m.team, ...m.members];
      m.controls = H.filter(x => !used.includes(x));
      m.controlsOn = m.controls.filter(x => /arm|condition|treatment|session|site|location|cohort/i.test(x));
    }
    if (P) {
      const H = P.headers;
      m.pid = guess(H, [/^person_?id$/i, /^id$/i, /^(employee|participant|person)/i, /id$/i]);
      m.pcols = H.filter(x => x !== m.pid);
      m.numericP = m.pcols.filter(c => isNumericCol(P.rows, c, P.delim));
      m.skills = m.numericP.filter(c => /^task|skill|numer|spatial|analy|typing|hidden|solo/i.test(c));
      m.predictors = m.pcols.filter(c => !/^role$/i.test(c));
    }
    A.map = m;
    renderMapping();
  }
  function renderMapping() {
    const m = A.map, body = $('#map-body'), T = A.teams, P = A.people;
    if (!T) { put(body, h('p', { class: 'muted small' }, 'Load a team results file to map its columns.')); return; }
    const sel = (id, label, cols, val, optional) => h('div', { class: 'field' }, h('label', { for: id }, label),
      h('select', { id, onchange: e => { m[id.replace('map-', '')] = e.target.value; } },
        optional ? h('option', { value: '' }, '(none)') : null,
        cols.map(c => h('option', { value: c, selected: c === val }, c))));
    const checks = (name, cols, on, onChange) => h('div', { class: 'checks' }, cols.length ? cols.map(c => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: on.includes(c), onchange: e => onChange(c, e.target.checked) }), c)) : h('span', { class: 'muted small' }, 'none available'));
    const toggleIn = (arr, c, on) => { const i = arr.indexOf(c); if (on && i < 0) arr.push(c); if (!on && i >= 0) arr.splice(i, 1); };
    const o = m.opts;
    const radio = (name, val, label, cur, onPick) => h('label', { class: 'check' }, h('input', { type: 'radio', name, value: val, checked: cur === val, onchange: () => onPick(val) }), label);
    put(body, 
      h('h4', {}, 'Team results'),
      h('div', { class: 'row' },
        sel('map-round', 'Round', T.headers, m.round, true),
        sel('map-team', 'Team ID', T.headers, m.team, true),
        sel('map-manager', 'Manager ID', T.headers, m.manager),
        sel('map-score', 'Team score', T.headers, m.score)),
      h('div', { class: 'field' }, h('label', {}, 'Member column(s) ', h('span', { class: 'hint' }, 'one column with IDs separated by ; or | — or one column per member')),
        checks('members', T.headers.filter(c => ![m.manager, m.score].includes(c)), m.members, (c, on) => toggleIn(m.members, c, on))),
      h('div', { class: 'field' }, h('label', {}, 'Design controls ', h('span', { class: 'hint' }, 'e.g. how managers were selected; entered as fixed effects, as in the paper')),
        checks('controls', m.controls || [], m.controlsOn || [], (c, on) => toggleIn(m.controlsOn, c, on))),
      P ? [
        h('h4', {}, 'People and skills'),
        h('div', { class: 'row' }, sel('map-pid', 'Person ID', P.headers, m.pid)),
        h('div', { class: 'field' }, h('label', {}, 'Task skills to control for ', h('span', { class: 'hint' }, 'the individual analogue of the team task; averaged into one composite unless you choose otherwise')),
          checks('skills', m.numericP, m.skills, (c, on) => toggleIn(m.skills, c, on))),
        h('div', { class: 'field' }, h('label', {}, 'Candidate predictors of manager effect'),
          checks('pred', m.pcols, m.predictors, (c, on) => toggleIn(m.predictors, c, on)))
      ] : h('p', { class: 'note' }, 'Without a people file the analysis estimates each manager\'s total contribution, without controlling for skills.'),
      h('h4', {}, 'Model'),
      h('div', { class: 'checks' },
        radio('cond', 'skills', 'Skill-adjusted contribution (pre-registered model)', o.conditioning, v => { o.conditioning = v; }),
        radio('cond', 'none', 'Total contribution (no skill controls)', o.conditioning, v => { o.conditioning = v; })),
      h('div', { class: 'checks' },
        radio('mode', 'composite', 'One composite skill score', o.skillMode, v => { o.skillMode = v; }),
        radio('mode', 'separate', 'Each skill separately', o.skillMode, v => { o.skillMode = v; }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.normalize, onchange: e => { o.normalize = e.target.checked; } }), 'Standardise scores within each round')),
      h('div', { class: 'row' },
        h('div', { class: 'field' }, h('label', { for: 'opt-draws' }, 'Randomization draws'), h('select', { id: 'opt-draws', onchange: e => { o.draws = +e.target.value; } }, [1000, 2000, 5000].map(v => h('option', { value: v, selected: v === o.draws }, fmtInt(v))))),
        h('div', { class: 'field' }, h('label', { for: 'opt-level' }, 'Interval for each manager'), h('select', { id: 'opt-level', onchange: e => { o.level = +e.target.value; } }, [[0.8, '80%'], [0.9, '90%'], [0.95, '95%']].map(([v, l]) => h('option', { value: v, selected: v === o.level }, l)))),
        h('div', { class: 'field' }, h('label', { for: 'opt-min' }, 'Min. teams for predictor analysis'), h('input', { id: 'opt-min', type: 'number', min: 1, max: 20, value: o.minTeams, onchange: e => { o.minTeams = Math.max(1, +e.target.value || 1); } })))
    );
  }

  function buildInput() {
    const m = A.map, T = A.teams, P = A.people;
    if (!m.manager || !m.score) throw new Error('Choose the manager and team score columns.');
    if (!m.members.length) throw new Error('Choose the column(s) that list team members.');
    const teams = T.rows.map(r => {
      let members = m.members.length === 1 ? String(r[m.members[0]] || '').split(/[;|]+|\s*,\s*/) : m.members.map(c => r[c]);
      members = members.map(x => String(x || '').trim()).filter(Boolean);
      const controls = {};
      for (const c of m.controlsOn || []) { const n = toNum(r[c], T.delim); controls[c] = isNumericCol(T.rows, c, T.delim) ? n : r[c]; }
      return { round: m.round ? r[m.round] : '1', team: m.team ? r[m.team] : '', manager: String(r[m.manager] || '').trim(), members, score: toNum(r[m.score], T.delim), controls };
    });
    let people = {}, peopleCols = [];
    if (P && m.pid) {
      for (const r of P.rows) {
        const id = String(r[m.pid] || '').trim(); if (!id) continue;
        const rec = {};
        for (const c of m.pcols) rec[c] = m.numericP.includes(c) ? toNum(r[c], P.delim) : (r[c] === '' ? null : r[c]);
        people[id] = rec;
      }
      peopleCols = m.predictors.slice();
    }
    const useSkills = m.opts.conditioning === 'skills' && P && m.skills && m.skills.length;
    return {
      input: { teams, people, peopleCols },
      opts: { normalize: m.opts.normalize, conditioning: useSkills ? 'skills' : 'none', skillCols: useSkills ? m.skills.slice() : [], skillMode: m.opts.skillMode, teamControls: (m.controlsOn || []).slice(), minTeams: m.opts.minTeams, level: m.opts.level, seed: 7 }
    };
  }

  function run() {
    const status = $('#run-status'), out = $('#results');
    let res;
    if (!A.teams) { put(out, h('div', { class: 'panel' }, h('p', { class: 'note warn' }, 'Load a team results file first.'))); return; }
    try {
      const { input, opts } = buildInput();
      res = S.analyze(input, opts);
    } catch (e) {
      put(out, h('div', { class: 'panel' }, h('p', { class: 'note warn' }, e.message)));
      status.textContent = '';
      return;
    }
    A.result = res; A.riDraws = null;
    put($('#data-note'), A.isExample ? h('p', { class: 'note example' }, h('strong', {}, 'Example data. '), 'Simulated to mirror Study 1: 90 managers, 180 members, 4 random rounds of three-person teams. The true manager effect in the simulation is σ', h('sub', {}, 'α'), ' = 0.25 SD, driven partly by decision-making skill and fluid IQ. Load your own files to replace it.') : '');
    renderResults();
    status.textContent = 'Running randomization inference…';
    runRI();
  }

  function runRI() {
    const res = A.result, token = ++A.riToken, total = A.map.opts.draws;
    const draw = S.riRunner(res.ri, 4242);
    const draws = [];
    const step = () => {
      if (token !== A.riToken) return;
      draws.push(...draw(Math.min(100, total - draws.length)));
      const bar = $('#ri-progress > div'); if (bar) bar.style.width = (100 * draws.length / total) + '%';
      if (draws.length < total) setTimeout(step, 0);
      else { A.riDraws = draws; $('#run-status').textContent = ''; renderRI(); renderHeadline(); }
    };
    setTimeout(step, 30);
  }
  const riP = () => A.riDraws ? (A.riDraws.filter(d => d >= A.result.fit.sigmaA - 1e-12).length + 1) / (A.riDraws.length + 1) : null;

  function renderResults() {
    const res = A.result, out = $('#results');
    put(out, 
      h('div', { class: 'panel', id: 'headline' }),
      res.warnings.length ? h('div', { class: 'note warn' }, res.warnings.join(' ')) : '',
      h('div', { class: 'panel', id: 'mgr-panel' }),
      h('div', { class: 'grid-2' }, h('div', { class: 'panel', id: 'ri-panel' }), h('div', { class: 'panel', id: 'loo-panel' })),
      h('div', { class: 'panel', id: 'model-panel' }),
      h('div', { class: 'panel', id: 'pred-panel' })
    );
    renderHeadline(); renderManagers(); renderRI(); renderLOO(); renderModel(); renderPredictors();
  }

  function renderHeadline() {
    const res = A.result, p = riP(), fit = res.fit;
    const adj = res.opts.conditioning === 'skills';
    const bW = adj ? res.model.beta[res.model.names.findIndex(n => /^Members' mean/.test(n))] : null;
    const tpm = res.teamsPerManager;
    const ciTxt = `95% CI ${fmt(fit.ci[0], 2)}–${fmt(fit.ci[1], 2)} · profile likelihood`;
    const tiles = [
      h('div', { class: 'stat lead' }, h('span', { class: 'label' }, adj ? 'Typical manager effect (skill-adjusted)' : 'Typical manager effect (total)'), h('span', { class: 'value' }, fmt(fit.sigmaA, 2), h('span', { class: 'small muted' }, ' SD')), h('span', { class: 'sub' }, ciTxt)),
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Randomization inference'), h('span', { class: 'value' }, p == null ? '…' : 'p ' + fmtP(p)), h('span', { class: 'sub' }, p == null ? 'reshuffling assignments…' : fmtInt(A.riDraws.length) + ' reshuffles within rounds')),
      adj && bW != null ? h('div', { class: 'stat' }, h('span', { class: 'label' }, "Members' skill, per SD"), h('span', { class: 'value' }, fmt(bW, 2), h('span', { class: 'small muted' }, ' SD')), h('span', { class: 'sub' }, 'for comparison with the manager effect')) : '',
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Reliability per manager'), h('span', { class: 'value' }, fmt(res.reliability, 2)), h('span', { class: 'sub' }, `${fmt(tpm.mean, 1)} teams per manager on average`)),
      res.workers ? h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Typical member effect'), h('span', { class: 'value' }, fmt(res.workers.sigmaA, 2), h('span', { class: 'small muted' }, ' SD')), h('span', { class: 'sub' }, `${fmtInt(res.nMembers)} members`)) : ''
    ];
    let verdict;
    if (p != null && p >= 0.1) verdict = h('p', { class: 'verdict' }, h('strong', {}, 'No clear manager effect. '), `The spread between managers (σ̂α = ${fmt(fit.sigmaA, 2)} SD) is within what random reshuffling of the same teams produces (p = ${fmtP(p)}). Either managers matter little for this task or the data cannot tell yet.`);
    else {
      const strength = p == null ? '' : p < 0.05 ? 'Managers make a measurable difference here. ' : 'There are signs that managers make a difference here (p < .10). ';
      verdict = h('p', { class: 'verdict' }, h('strong', {}, strength),
        `A manager one SD better than average raises team performance by about ${fmt(fit.sigmaA, 2)} SD` + (adj && bW != null ? `, compared with ${fmt(bW, 2)} SD for a one-SD gain in members' skill. ` : '. '),
        res.reliability < 0.5 ? `With ${fmt(tpm.mean, 1)} teams per manager, single-manager estimates are noisy (reliability ${fmt(res.reliability, 2)}), so read the ranking below as provisional.` : `Individual estimates are reasonably reliable (${fmt(res.reliability, 2)}).`);
    }
    const truth = A.isExample && A.truth ? (() => {
      const c = S.cor(res.managers.map(m => m.eb), res.managers.map(m => A.truth[m.id]));
      return h('p', { class: 'small muted' }, `Check against the simulation's truth: true σα = 0.25; correlation between each manager's estimate and true effect r = ${fmt(c.r, 2)}.`);
    })() : '';
    put($('#headline'), 
      h('div', { class: 'panel-head' }, h('h3', {}, 'Result'), h('span', { class: 'small muted' }, `${fmtInt(res.nTeams)} teams · ${fmtInt(res.nManagers)} managers · ${res.rounds.length} round${res.rounds.length === 1 ? '' : 's'}`)),
      h('div', { class: 'stats' }, tiles), verdict, truth,
      p == null ? h('div', { class: 'progress', id: 'ri-progress' }, h('div', {})) : '');
  }

  function renderManagers() {
    const res = A.result, panel = $('#mgr-panel'), lvl = Math.round(res.opts.level * 100);
    const counts = { above: 0, below: 0, unclear: 0 }; res.managers.forEach(m => counts[m.cls]++);
    const chart = h('div', { class: 'chart' });
    const ms = res.managers;
    const f = frame(1000, 330, { l: 64, r: 14, t: 14, b: 34 });
    const lo = Math.min(0, ...ms.map(m => m.lo)), hi = Math.max(0, ...ms.map(m => m.hi));
    const pad = (hi - lo) * 0.06 || 0.1;
    const y = scale(lo - pad, hi + pad, f.m.t + f.ih, f.m.t), band = f.iw / ms.length, x = i => f.m.l + (i + 0.5) * band;
    yAxis(f, y, ticks(lo - pad, hi + pad, 6), v => fmtS(v, 1), 'Effect on team score (SD)');
    f.svg.append(s('line', { class: 'zero', x1: f.m.l, x2: f.W - f.m.r, y1: y(0), y2: y(0) }));
    const r = ms.length > 150 ? 2.5 : 4, sw = ms.length > 150 ? 1.5 : 2;
    ms.forEach((m, i) => {
      const c = clsColor(m.cls);
      f.svg.append(s('line', { x1: x(i), x2: x(i), y1: y(m.lo), y2: y(m.hi), stroke: c, 'stroke-width': sw, 'stroke-linecap': 'round', opacity: m.cls === 'unclear' ? 0.55 : 0.9 }));
      f.svg.append(s('circle', { cx: x(i), cy: y(m.eb), r, fill: c, stroke: 'var(--panel)', 'stroke-width': 1.5 }));
      const hit = s('rect', { class: 'hit', x: f.m.l + i * band, y: f.m.t, width: band, height: f.ih });
      hit.addEventListener('mousemove', e => showTip(e, `<b>${esc(m.id)}</b> · ${m.n} teams<br>estimate ${fmtS(m.eb, 2)} SD<br>${lvl}% interval ${fmtS(m.lo, 2)} to ${fmtS(m.hi, 2)}<br>raw average residual ${fmtS(m.raw, 2)}<br>percentile ${m.pct}`));
      hit.addEventListener('mouseleave', hideTip);
      f.svg.append(hit);
    });
    f.svg.append(s('text', { x: f.m.l + f.iw / 2, y: f.H - 6, 'text-anchor': 'middle', class: 'axis-label' }, 'Managers, ranked by estimated effect'));
    chart.append(f.svg);

    const tableBody = h('tbody');
    const fill = () => {
      const q = A.filter.toLowerCase(), k = A.sort.key, d = A.sort.dir;
      const rows = ms.filter(m => !q || m.id.toLowerCase().includes(q)).slice().sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k]) : a[k] - b[k]) * d);
      put(tableBody, ...rows.map(m => h('tr', {},
        h('td', {}, m.id), h('td', { class: 'num' }, m.n), h('td', { class: 'num' }, fmtS(m.eb, 2)),
        h('td', { class: 'num' }, `${fmtS(m.lo, 2)} to ${fmtS(m.hi, 2)}`), h('td', { class: 'num' }, fmtS(m.raw, 2)), h('td', { class: 'num' }, m.pct),
        h('td', {}, h('span', { class: 'pill ' + (m.cls === 'above' ? 'pos' : m.cls === 'below' ? 'neg' : '') }, h('span', { class: 'dot' }), m.cls === 'above' ? 'Above average' : m.cls === 'below' ? 'Below average' : 'Can\'t tell')))));
    };
    const th = (label, key, num) => h('th', { class: num ? 'num' : '' }, h('button', { type: 'button', onclick: () => { A.sort = { key, dir: A.sort.key === key ? -A.sort.dir : -1 }; fill(); } }, label));
    fill();
    put(panel, 
      h('div', { class: 'panel-head' }, h('h3', {}, 'Manager estimates'),
        h('p', {}, `Shrunken (empirical Bayes) estimates with ${lvl}% intervals. ${counts.above} above average, ${counts.below} below, ${counts.unclear} indistinguishable from average.`)),
      chart,
      h('div', { class: 'legend' },
        h('span', {}, h('i', { style: { background: 'var(--pos)' } }), 'Interval above zero'),
        h('span', {}, h('i', { style: { background: 'var(--neg)' } }), 'Interval below zero'),
        h('span', {}, h('i', { style: { background: 'var(--neutral)' } }), 'Interval includes zero')),
      h('p', { class: 'small muted' }, 'Each estimate is the manager\'s average residual pulled toward zero in proportion to its noise (the BLUP from the multilevel model). The raw average is shown in the table for reference.'),
      h('div', { class: 'row' },
        h('div', { class: 'field', style: { maxWidth: '260px' } }, h('label', { for: 'mgr-filter' }, 'Find a manager'), h('input', { id: 'mgr-filter', type: 'text', value: A.filter, placeholder: 'ID', oninput: e => { A.filter = e.target.value; fill(); } })),
        h('button', { class: 'btn', type: 'button', onclick: exportManagers }, 'Download estimates (CSV)')),
      h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, th('Manager', 'id'), th('Teams', 'n', true), th('Estimate (SD)', 'eb', true), h('th', { class: 'num' }, lvl + '% interval'), th('Raw avg.', 'raw', true), th('Percentile', 'pct', true), h('th', {}, 'Classification'))), tableBody)));
  }
  function exportManagers() {
    const res = A.result;
    const rows = res.managers.slice().sort((a, b) => b.eb - a.eb).map(m => ({ manager_id: m.id, teams: m.n, effect_eb: m.eb.toFixed(4), interval_low: m.lo.toFixed(4), interval_high: m.hi.toFixed(4), raw_mean_residual: m.raw.toFixed(4), posterior_sd: m.postSd.toFixed(4), shrinkage_weight: m.lambda.toFixed(4), percentile: m.pct, classification: m.cls }));
    offerFile('manager_effects.csv', toCSV(Object.keys(rows[0]), rows), 'text/csv');
  }

  function renderRI() {
    const res = A.result, panel = $('#ri-panel'); if (!panel) return;
    const head = h('div', { class: 'panel-head' }, h('h3', {}, 'Is the spread more than chance?'));
    if (!A.riDraws) { put(panel, head, h('p', { class: 'muted small' }, 'Reshuffling which manager led which team, within each round, and refitting the model…')); return; }
    const d = A.riDraws, obs = res.fit.sigmaA, p = riP();
    const mx = Math.max(obs, ...d) * 1.08 || 0.1, nb = 28, bw = mx / nb, bins = new Array(nb).fill(0);
    d.forEach(v => { bins[Math.min(nb - 1, Math.floor(v / bw))]++; });
    const f = frame(520, 250, { l: 58, r: 16, t: 26, b: 40 });
    const x = scale(0, mx, f.m.l, f.W - f.m.r), ymax = Math.max(...bins), y = scale(0, ymax * 1.08, f.m.t + f.ih, f.m.t);
    yAxis(f, y, ticks(0, ymax, 4), v => fmtInt(v), 'Reshuffles');
    xAxis(f, x, ticks(0, mx, 5), v => fmt(v, 2), 'σα under random reassignment (SD)');
    bins.forEach((c, i) => {
      if (!c) return;
      const x0 = x(i * bw) + 1, w = Math.max(1, x((i + 1) * bw) - x(i * bw) - 2);
      const rect = s('rect', { x: x0, y: y(c), width: w, height: y(0) - y(c), fill: (i + 0.5) * bw >= obs ? 'var(--accent)' : 'var(--neutral)', opacity: 0.85, rx: 2 });
      rect.addEventListener('mousemove', e => showTip(e, `σα ${fmt(i * bw, 3)}–${fmt((i + 1) * bw, 3)}<br>${fmtInt(c)} reshuffles`));
      rect.addEventListener('mouseleave', hideTip);
      f.svg.append(rect);
    });
    f.svg.append(s('line', { x1: x(obs), x2: x(obs), y1: f.m.t - 8, y2: y(0), stroke: 'var(--ink)', 'stroke-width': 2 }));
    f.svg.append(s('text', { x: x(obs) + (x(obs) > f.W * 0.7 ? -6 : 6), y: f.m.t - 10, 'text-anchor': x(obs) > f.W * 0.7 ? 'end' : 'start', style: 'font-weight:600;fill:var(--ink)' }, `Observed ${fmt(obs, 2)}`));
    put(panel, head,
      h('p', { class: 'small muted' }, `The grey distribution shows σ̂α when managers are reassigned to the same teams at random (${fmtInt(d.length)} times, blocked by round). ${fmt(100 * d.filter(v => v >= obs - 1e-12).length / d.length, 1)}% of reshuffles produce a spread at least as large as observed: p = ${fmtP(p)}.`),
      h('div', { class: 'chart' }, f.svg));
  }

  function renderLOO() {
    const res = A.result, panel = $('#loo-panel'), L = res.loo;
    const head = h('div', { class: 'panel-head' }, h('h3', {}, 'Does it predict new teams?'));
    if (!L) { put(panel, head, h('p', { class: 'muted small' }, 'Out-of-sample checks need at least two rounds.')); return; }
    const f = frame(520, 250, { l: 58, r: 16, t: 14, b: 40 });
    const xs = L.xs, ys = L.ys;
    const xl = Math.min(...xs), xh = Math.max(...xs), yl = Math.min(...ys), yh = Math.max(...ys);
    const x = scale(xl, xh, f.m.l, f.W - f.m.r), y = scale(yl, yh, f.m.t + f.ih, f.m.t);
    yAxis(f, y, ticks(yl, yh, 5), v => fmt(v, 1), 'Held-out team (SD)');
    xAxis(f, x, ticks(xl, xh, 5), v => fmt(v, 1), 'Manager effect from other rounds (SD)');
    xs.forEach((v, i) => f.svg.append(s('circle', { cx: x(v), cy: y(ys[i]), r: 3, fill: 'var(--accent)', opacity: 0.35 })));
    f.svg.append(s('line', { x1: x(xl), x2: x(xh), y1: y(L.intercept + L.slope * xl), y2: y(L.intercept + L.slope * xh), stroke: 'var(--ink)', 'stroke-width': 2 }));
    put(panel, head,
      h('p', { class: 'small muted' }, `Each round is held out in turn. Managers' effects estimated from the other rounds predict how their held-out teams beat the skill-based prediction: slope ${fmt(L.slope, 2)} (SE ${fmt(L.se, 2)}, p = ${fmtP(L.p)}), correlation r = ${fmt(L.r, 2)} across ${fmtInt(L.n)} teams.`),
      h('div', { class: 'chart' }, f.svg));
  }

  function renderModel() {
    const res = A.result, M = res.model;
    const rows = M.names.map((n, i) => h('tr', {}, h('td', {}, n), h('td', { class: 'num' }, fmtS(M.beta[i], 3)), h('td', { class: 'num' }, fmt(M.se[i], 3)), h('td', { class: 'num' }, fmtP(M.p[i]))));
    put($('#model-panel'), 
      h('div', { class: 'panel-head' }, h('h3', {}, 'The prediction model'), h('p', {}, 'Paper model (1): team score standardised within round, regressed on skills and design controls')),
      h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Term'), h('th', { class: 'num' }, 'Coefficient (SD)'), h('th', { class: 'num' }, 'SE'), h('th', { class: 'num' }, 'p'))), h('tbody', {}, rows))),
      h('p', { class: 'small muted' }, `R² = ${fmt(M.r2, 3)} on ${fmtInt(M.n)} teams. Skill variables are standardised across teams, so coefficients read as SD of team score per SD of skill. Residual SD within managers σ̂e = ${fmt(res.fit.sigmaE, 2)}.` +
        (res.opts.conditioning === 'skills' ? '' : ' Skills are not controlled, so manager effects include the manager\'s own task skill (the "total contribution" of Study 1, column 2).')));
  }

  function renderPredictors() {
    const res = A.result, panel = $('#pred-panel'), P = res.predictors;
    const head = h('div', { class: 'panel-head' }, h('h3', {}, 'What predicts a good manager?'), h('p', {}, `Correlation of each person-level measure with managers' raw effect (managers with ≥ ${res.opts.minTeams} teams)`));
    if (!P.length) { put(panel, head, h('p', { class: 'muted small' }, 'Add a people file with measures for managers to see their correlates.')); return; }
    const f = frame(1000, 40 + P.length * 30, { l: 230, r: 120, t: 10, b: 30 });
    const ext = Math.max(0.3, ...P.map(p => Math.max(Math.abs(p.lo), Math.abs(p.hi)))) * 1.05;
    const x = scale(-ext, ext, f.m.l, f.W - f.m.r), rowY = i => f.m.t + 15 + i * 30;
    xAxis(f, x, ticks(-ext, ext, 6), v => fmtS(v, 1), '');
    f.svg.append(s('line', { class: 'zero', x1: x(0), x2: x(0), y1: f.m.t, y2: f.H - f.m.b }));
    P.forEach((p, i) => {
      const yy = rowY(i), sig = p.p < 0.05;
      f.svg.append(s('text', { x: f.m.l - 12, y: yy + 4, 'text-anchor': 'end', style: sig ? 'fill:var(--ink);font-weight:600' : '' }, p.label + (p.controlled ? ' (controlled)' : '')));
      f.svg.append(s('line', { x1: x(p.lo), x2: x(p.hi), y1: yy, y2: yy, stroke: sig ? 'var(--accent)' : 'var(--neutral)', 'stroke-width': 2, 'stroke-linecap': 'round' }));
      f.svg.append(s('circle', { cx: x(p.r), cy: yy, r: 5, fill: sig ? 'var(--accent)' : 'var(--neutral)', stroke: 'var(--panel)', 'stroke-width': 2 }));
      f.svg.append(s('text', { x: f.W - f.m.r + 10, y: yy + 4 }, `r ${fmtS(p.r, 2)}  p ${fmtP(p.p)}`));
      const hit = s('rect', { class: 'hit', x: 0, y: yy - 15, width: f.W, height: 30 });
      hit.addEventListener('mousemove', e => showTip(e, `<b>${esc(p.label)}</b><br>r = ${fmtS(p.r, 2)} (95% CI ${fmtS(p.lo, 2)} to ${fmtS(p.hi, 2)})<br>p = ${fmtP(p.p)}, n = ${p.n} managers`));
      hit.addEventListener('mouseleave', hideTip);
      f.svg.append(hit);
    });
    const RT = res.randomThird;
    let sel = '';
    if (RT) {
      const items = P.filter(p => !p.controlled);
      const g = frame(1000, 84 + items.length * 30, { l: 230, r: 120, t: 34, b: 44 });
      const vals = items.flatMap(p => [p.topMean - 1.96 * p.topSe, p.topMean + 1.96 * p.topSe]).concat([RT.lo, RT.hi]);
      const lo = Math.min(...vals), hi = Math.max(...vals), pd = (hi - lo) * 0.05;
      const gx = scale(lo - pd, hi + pd, g.m.l, g.W - g.m.r), gy = i => g.m.t + 15 + i * 30;
      xAxis(g, gx, ticks(lo - pd, hi + pd, 6), v => fmtS(v, 2), 'Average manager effect of the appointed group (SD)');
      g.svg.append(s('rect', { x: gx(RT.lo), y: g.m.t - 6, width: gx(RT.hi) - gx(RT.lo), height: g.ih + 6, fill: 'var(--neutral)', opacity: 0.16 }));
      g.svg.append(s('line', { x1: gx(RT.mean), x2: gx(RT.mean), y1: g.m.t - 6, y2: g.H - g.m.b, stroke: 'var(--ink-3)', 'stroke-width': 1 }));
      g.svg.append(s('text', { x: gx(RT.mean), y: g.m.t - 12, 'text-anchor': 'middle' }, 'Random third (95% band)'));
      items.forEach((p, i) => {
        const yy = gy(i), lab = p.binary ? `Only ${p.label.includes(' = ') ? p.label : p.label + ' = 1'}` : `Top third on ${p.label}`;
        g.svg.append(s('text', { x: g.m.l - 12, y: yy + 4, 'text-anchor': 'end' }, lab));
        g.svg.append(s('line', { x1: gx(p.topMean - 1.96 * p.topSe), x2: gx(p.topMean + 1.96 * p.topSe), y1: yy, y2: yy, stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.6 }));
        g.svg.append(s('circle', { cx: gx(p.topMean), cy: yy, r: 5, fill: 'var(--accent)', stroke: 'var(--panel)', 'stroke-width': 2 }));
        g.svg.append(s('text', { x: g.W - g.m.r + 10, y: yy + 4 }, fmtS(p.topMean, 2) + ` (n ${p.topN})`));
      });
      sel = [h('h4', { style: { marginTop: '22px' } }, 'If you appointed managers on one measure'),
        h('p', { class: 'small muted' }, `Average manager effect of the managers you would have picked, compared with picking a random third (Study 1, Figure 6). Uses only this sample, so differences of a few hundredths are noise.`),
        h('div', { class: 'chart' }, g.svg)];
    }
    put(panel, head, h('div', { class: 'chart' }, f.svg),
      h('p', { class: 'small muted' }, 'Bars are 95% confidence intervals. Measures marked (controlled) are part of the skill adjustment, so most of their link to team results has already been removed. As in the paper, these are exploratory correlations without multiple-testing correction.'),
      sel);
  }

  /* ================= AI leadership test ================= */
  const MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'default · most capable · slower and pricier' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'faster · cheaper' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'fastest · cheapest' }
  ];
  // The same app published on claude.ai, where teammates run on the viewer's own Claude account (no key).
  const CLAUDE_URL = 'https://claude.ai/artifact/696yvnhLNTxw2zjFXYXz42';
  // Hosted AI teammates (worker/worker.mjs): live teammates with no key for visitors. Empty until the
  // worker is deployed; set it to the worker's URL ending in /reply and the option appears.
  // On localhost, ?hosted=<url> points at a local stand-in (worker/dev-server.mjs) instead.
  const HOSTED_DEPLOYED = 'https://manager-effect-lab-teammates.ludek-stehlik.workers.dev/reply';
  const HOSTED_URL = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('hosted')) || HOSTED_DEPLOYED;
  const SCR = window.MEL_SCRIPTED, COACH = window.MEL_COACH;
  const FOL = PZ.FOLLOWERS;
  const folName = id => (FOL.find(f => f.id === id) || { name: 'You' }).name;
  // Quick suits visitors from a LinkedIn post; Standard and Extended add solo warm-ups, which a group comparison needs.
  const LENGTHS = {
    quick: { label: 'Quick', time: 'about 10–15 min', desc: '2 team puzzles', warmups: 0, team: ['t1', 't3'] },
    standard: { label: 'Standard', time: 'about 20–25 min', desc: '1 warm-up and 4 team puzzles', warmups: 1, team: null },
    extended: { label: 'Extended', time: 'about 30 min', desc: '3 warm-ups and 4 team puzzles', warmups: 3, team: null }
  };

  const AI = {
    sample: null, sampleState: inClaude ? 'checking' : 'absent',
    settings: Object.assign({ engine: inClaude ? 'claude' : HOSTED_URL ? 'hosted' : 'scripted', model: 'claude-opus-5-5', minutes: 6, name: '', remember: false, apiKey: '', geminiKey: '' }, store.get('ai.settings', {})),
    phase: 'intro', order: [], idx: 0, results: [], cur: null, notice: '',
    root: () => $('#ai-root')
  };
  if (!AI.settings.remember) { AI.settings.apiKey = ''; AI.settings.geminiKey = ''; }
  // test length (older saved settings stored the number of warm-ups, or a solo on/off switch)
  if (!LENGTHS[AI.settings.length]) AI.settings.length = AI.settings.warmups === 3 ? 'extended' : (AI.settings.warmups === 1 || AI.settings.solo === true) ? 'standard' : 'quick';
  delete AI.settings.warmups; delete AI.settings.solo;
  if (AI.settings.engine === 'hosted' && !HOSTED_URL) AI.settings.engine = 'scripted';
  if (!inClaude && AI.settings.engine === 'claude') AI.settings.engine = HOSTED_URL ? 'hosted' : 'scripted';
  if (inClaude && ['api', 'gemini', 'hosted'].includes(AI.settings.engine)) AI.settings.engine = 'claude';
  if (inClaude) {
    window.claude.use('sample').then(fn => { AI.sample = fn; AI.sampleState = fn ? 'ready' : 'absent'; if (!fn && AI.settings.engine === 'claude') AI.settings.engine = 'scripted'; if (AI.phase === 'intro' && !$('#view-ai-test').hidden) AI.render(); })
      .catch(() => { AI.sampleState = 'absent'; });
  }
  function saveSettings() {
    const st = Object.assign({}, AI.settings);
    if (!st.remember) { delete st.apiKey; delete st.geminiKey; }
    store.set('ai.settings', st);
  }

  AI.render = function () {
    if (AI.phase === 'intro') return renderIntro();
    if (AI.phase === 'puzzle') return renderPuzzle();
    if (AI.phase === 'feedback') return renderFeedback();
    if (AI.phase === 'summary') return renderSummary();
  };

  function engineCard(id, title, desc, disabled) {
    return h('button', { type: 'button', class: 'engine', 'aria-pressed': AI.settings.engine === id ? 'true' : 'false', disabled: disabled || null,
      onclick: () => { AI.settings.engine = id; saveSettings(); renderIntro(); } }, h('strong', {}, title), h('span', {}, desc));
  }

  function lengthCard(id) {
    const L = LENGTHS[id];
    return h('button', { type: 'button', class: 'engine', 'aria-pressed': AI.settings.length === id ? 'true' : 'false',
      onclick: () => { AI.settings.length = id; saveSettings(); renderIntro(); } }, h('strong', {}, L.label), h('span', {}, `${L.desc} · ${L.time}`));
  }

  function renderIntro() {
    const st = AI.settings, root = AI.root();
    const last = store.get('ai.last', null), len = LENGTHS[st.length];
    const claudeDesc = AI.sampleState === 'ready' ? 'Teammates run on your Claude account. No key needed; you will be asked to allow it once.' : AI.sampleState === 'checking' ? 'Checking whether this page can use Claude…' : 'Not available in this view.';
    const ownKey = st.engine === 'gemini' || st.engine === 'api';
    const engines = h('div', { class: 'engine-cards' },
      inClaude ? engineCard('claude', 'Claude (in claude.ai)', claudeDesc, AI.sampleState !== 'ready') : '',
      !inClaude && HOSTED_URL ? engineCard('hosted', 'Live AI teammates', 'Recommended. Gemini 3.8 Flash, hosted for this test. No key, no sign-up.') : '',
      engineCard('scripted', 'Scripted teammates', inClaude || HOSTED_URL ? 'Work offline. They follow a script, so they are less lifelike.' : 'No key, no sign-up. They follow a script, so they are less lifelike than AI teammates.'));
    let apiBox = '';
    if (!inClaude && st.engine === 'gemini') {
      const keyStatus = h('p', { class: 'small muted', id: 'key-status' });
      apiBox = h('div', { class: 'flow' },
        h('div', { class: 'row' },
          h('div', { class: 'field', style: { flex: '2 1 280px' } }, h('label', { for: 'gemini-key' }, 'Gemini API key ', h('span', { class: 'hint' }, 'from Google AI Studio')),
            h('input', { id: 'gemini-key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'AIza…', value: st.geminiKey, oninput: e => { st.geminiKey = e.target.value.trim(); saveSettings(); } })),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => checkKey(keyStatus) }, 'Check key'))),
        h('details', { class: 'map' }, h('summary', {}, 'No key yet? Get one in about a minute'),
          h('ol', { class: 'small', style: { paddingLeft: '1.2em', margin: '0' } },
            h('li', {}, 'Open ', h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener' }, 'Google AI Studio'), ' and sign in with a Google account.'),
            h('li', {}, 'Choose "Create API key" and copy it.'),
            h('li', {}, 'Paste it above and press "Check key".')),
          h('p', { class: 'small muted' }, 'Check Google\'s pricing and limits for your account. A full test makes roughly 100–250 short requests of about 1,000 tokens each.')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.remember, onchange: e => { st.remember = e.target.checked; saveSettings(); } }), 'Remember the key in this browser'),
        keyStatus,
        h('p', { class: 'note small' }, 'The key stays in your browser and is sent only to generativelanguage.googleapis.com. Teammates think at the low level to keep the chat quick.'));
    }
    if (!inClaude && st.engine === 'api') {
      const keyStatus = h('p', { class: 'small muted', id: 'key-status' });
      apiBox = h('div', { class: 'flow' },
        h('div', { class: 'row' },
          h('div', { class: 'field', style: { flex: '2 1 280px' } }, h('label', { for: 'api-key' }, 'Anthropic API key'),
            h('input', { id: 'api-key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'sk-ant-…', value: st.apiKey, oninput: e => { st.apiKey = e.target.value.trim(); saveSettings(); } })),
          h('div', { class: 'field' }, h('label', { for: 'api-model' }, 'Model'),
            h('select', { id: 'api-model', onchange: e => { st.model = e.target.value; saveSettings(); } }, MODELS.map(m => h('option', { value: m.id, selected: m.id === st.model }, m.label + ' — ' + m.note)))),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => checkKey(keyStatus) }, 'Check key'))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.remember, onchange: e => { st.remember = e.target.checked; saveSettings(); } }), 'Remember the key in this browser'),
        keyStatus,
        h('p', { class: 'note small' }, 'The key stays in your browser and is sent only to api.anthropic.com. Use a key with a spending limit. A full test makes roughly 100–250 short requests; with Opus 5.5 that is typically under a few dollars, with Haiku a few cents. Teammates reply at low effort to keep the chat quick.'));
    }
    const timeSel = h('select', { id: 'ai-min', onchange: e => { st.minutes = +e.target.value; saveSettings(); } },
      [[4, '4 minutes'], [6, '6 minutes'], [8, '8 minutes'], [0, 'No time limit']].map(([v, l]) => h('option', { value: v, selected: v === st.minutes }, l)));
    const more = h('details', { class: 'map', open: ownKey || null },
      h('summary', {}, inClaude ? 'More options: time limit' : 'More options: time limit, your own API key'),
      h('div', { class: 'flow' },
        h('div', { class: 'field', style: { maxWidth: '260px' } }, h('label', { for: 'ai-min' }, 'Time per team puzzle'), timeSel),
        inClaude ? '' : [
          h('div', { class: 'field' }, h('label', {}, HOSTED_URL ? 'Or run the teammates on your own API key' : 'Lifelike AI teammates with your own API key'),
            h('div', { class: 'engine-cards' },
              engineCard('gemini', 'Gemini 3.8 Flash', 'Your own key from Google AI Studio. Getting one takes about a minute.'),
              engineCard('api', 'Claude', 'Your own Anthropic API key.'))),
          apiBox,
          HOSTED_URL ? '' : h('p', { class: 'small muted' }, 'Have a Claude account? The ', h('a', { href: CLAUDE_URL, target: '_blank', rel: 'noopener' }, 'claude.ai version'), ' runs the teammates on your own account, so it needs no key, only a sign-in.')]));
    const free = st.engine === 'scripted' || st.engine === 'hosted';
    // with an unfinished test, resuming comes first and a new start says it replaces it
    const pending = loadProgress(), resumeWait = !!(pending && pending.cur && pending.cur.engine === 'claude' && AI.sampleState === 'checking');
    const startBtn = () => h('button', { class: 'btn' + (pending ? '' : ' primary') + ' start-btn', type: 'button', onclick: startTest }, `${pending ? 'Start a new test' : 'Start'} · ${len.time}`);
    const setup = h('div', { class: 'panel flow', id: 'ai-setup' }, h('h3', {}, 'Start'),
      h('div', { class: 'field' }, h('label', {}, 'Length'), h('div', { class: 'length-cards' }, Object.keys(LENGTHS).map(lengthCard)),
        len.warmups ? '' : h('span', { class: 'hint' }, 'To compare a group of people fairly, choose Standard: its warm-up measures how each person reasons alone.')),
      h('div', { class: 'field' }, h('label', {}, 'Teammates'), engines),
      AI.notice ? h('p', { class: 'note warn', id: 'ai-notice' }, AI.notice) : '',
      h('div', { class: 'btn-row' },
        pending ? h('button', { class: 'btn primary', type: 'button', disabled: resumeWait || null, onclick: resumeTest }, resumeWait ? 'Checking Claude…' : 'Resume your test') : '',
        startBtn(),
        last && !pending ? h('button', { class: 'btn', type: 'button', onclick: () => { AI.results = last.results; AI.settings.name = last.name || AI.settings.name; AI.phase = 'summary'; AI.render(); } }, 'See your last result') : ''),
      h('p', { class: 'small muted' }, free ? 'No sign-up and no key. ' : '', pending ? 'You have an unfinished test saved in this browser. Starting a new test replaces it.' : 'You can stop after any team puzzle and still get your result. If you leave mid-test, your progress is saved in this browser and you can resume.'),
      more);
    put(root,
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, 'Leadership test · inspired by Study 2'), h('h2', {}, 'How well do you lead a team?'),
        resumeBox(),
        h('p', {}, 'In a 2025 study, how well people led a team of AI agents strongly predicted how much they improved real human teams. Try a version of that test. You lead three AI teammates, Mira, Theo and Jonas, through hidden-profile puzzles. Each of you holds different clues and nobody can solve a puzzle alone, so your job is to draw out the right information, keep the team on track, and decide.'),
        // on a phone the set-up panel is far down; offer the start right here (the resume box above does it for an unfinished test)
        pending ? '' : h('div', { class: 'btn-row hero-start' }, startBtn(), h('a', { href: '#ai-setup', class: 'small', onclick: e => { e.preventDefault(); $('#ai-setup').scrollIntoView({ behavior: 'smooth' }); } }, 'Choose length and teammates'),
          h('span', { class: 'small muted' }, `${len.label}, ${st.engine === 'hosted' ? 'live AI' : st.engine === 'scripted' ? 'scripted' : 'AI'} teammates` + (free ? ', no sign-up' : ''))),
        h('p', { class: 'note' }, h('strong', {}, 'For fun, not a verdict. '), 'This version is inspired by the study, not a copy of it: new puzzles, other AI models, fewer puzzles and its own scoring. It has not been validated, so your result describes how you led today\'s game, not how good a manager you are.')),
      h('div', { class: 'grid-2' },
        setup,
        h('div', { class: 'panel prose' }, h('h3', {}, 'How it works'),
          h('ol', {},
            h('li', {}, h('strong', {}, 'Lead the team. '), 'In each team puzzle you see 8 reports; each teammate holds 8 more, half of them shared. Message everyone or one person. Teammates only talk to you.'),
            h('li', {}, h('strong', {}, 'Answer with probabilities. '), 'Each puzzle has two questions with five options. Reports either rule options out or are irrelevant; the options left standing are equally likely. Spread 100 points across them.'),
            h('li', {}, h('strong', {}, 'Get feedback on what you did. '), 'After each puzzle: which questions drew out decisive reports, which reports stayed hidden and who held them, and where your points went.'),
            h('li', {}, h('strong', {}, 'See how you led. '), 'Your score, the leadership habits the study linked to better team results, a playful leadership style, and a result card to share.')),
          h('p', { class: 'small muted' }, 'Standard and Extended start with solo warm-ups, where you see every report; they show how you reason on your own. Scores run from 0 to 100 (100 = exactly the right distribution; an even split scores 20–60). Results stay in your browser. AI teammates receive only your chat messages; scripted teammates run entirely in your browser.'))),
      h('details', { class: 'panel', id: 'ai-group-wrap', open: AI.group.leaders.length ? true : null },
        h('summary', { class: 'group-summary' }, h('strong', {}, 'For teams and researchers: compare a group of test takers')),
        h('div', { class: 'flow', id: 'ai-group', style: { marginTop: '14px' } }))
    );
    renderGroup();
  }
  /* ---- comparing a group (Study 2, models 1–3) ---- */
  AI.group = { leaders: [], files: [], key: null, isExample: false, truth: null, notes: [] };
  // hosted teammates use the same model, brief and settings as Gemini with your own key, so they are pooled
  const groupKey = l => (l.engine === 'hosted' ? 'gemini' : l.engine) + '|' + l.model + '|' + l.version;
  const groupLabel = k => { const [e, m, v] = k.split('|'); const eng = { gemini: 'Gemini', api: 'Claude API', claude: 'Claude', scripted: 'scripted', simulated: 'simulated' }[e] || e; return `${eng}${m ? ' · ' + m : ''} · test version ${v}`; };
  function addGroupRows(parsed, source) {
    const G = AI.group, rows = S.aiGroupRows(parsed.rows);
    if (!rows.length) { G.notes.push(source + ' has no team-puzzle scores; is it a results file from this test?'); return; }
    const base = source.replace(/\.[^.]+$/, '');
    rows.forEach((l, k) => {
      let id = l.id || (rows.length > 1 ? base + ' #' + (k + 1) : base), n = 2;
      if (G.leaders.some(x => x.id === id)) { const orig = id; while (G.leaders.some(x => x.id === orig + ' (' + n + ')')) n++; id = orig + ' (' + n + ')'; G.notes.push(`Two results share the name "${orig}"; they are treated as different people.`); }
      l.id = id; G.leaders.push(l);
    });
    G.files.push(source);
  }
  function readGroupFiles(files) {
    const G = AI.group;
    if (G.isExample) AI.group = { leaders: [], files: [], key: null, isExample: false, truth: null, notes: [] };
    let left = files.length;
    files.forEach(file => {
      const fr = new FileReader();
      fr.onload = () => { addGroupRows(parseCSV(fr.result), file.name); if (--left === 0) { AI.group.key = null; renderGroup(); } };
      fr.onerror = () => { AI.group.notes.push('Could not read ' + file.name + '.'); if (--left === 0) renderGroup(); };
      fr.readAsText(file);
    });
  }
  function loadGroupExample() {
    const ex = S.simulateAIGroup(51, 40);
    AI.group = { leaders: [], files: [], key: null, isExample: true, truth: ex.truth, notes: [] };
    addGroupRows(parseCSV(toCSV(Object.keys(ex.rows[0]), ex.rows)), 'simulated_group.csv');
    renderGroup();
  }
  function renderGroup() {
    const box = $('#ai-group'); if (!box) return;
    const G = AI.group;
    const input = h('input', { type: 'file', id: 'ai-files', accept: '.csv,.txt,text/csv', multiple: true, hidden: true, onchange: e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) readGroupFiles(f); } });
    const head = [
      h('p', { class: 'small' }, 'One person\'s raw score mixes leadership with how well they reason alone. To separate the two, collect the results files (CSV) of several people who took the same version of the test with the same teammates. The analysis standardises each team puzzle across the group, removes the part predicted by the solo warm-up, and shrinks each person\'s estimate toward the group average in proportion to its noise, following models (1)–(3) of Study 2. Everyone leads the same AI teammates, so there is no teammate skill to adjust for.'),
      h('div', { class: 'btn-row' }, h('label', { class: 'btn', for: 'ai-files' }, 'Choose results files'), input,
        h('button', { class: 'btn quiet', type: 'button', onclick: loadGroupExample }, 'Load simulated example'),
        G.leaders.length ? h('button', { class: 'btn quiet', type: 'button', onclick: () => { AI.group = { leaders: [], files: [], key: null, isExample: false, truth: null, notes: [] }; renderGroup(); } }, 'Clear') : ''),
      h('p', { class: 'small muted' }, G.leaders.length ? `${fmtInt(G.leaders.length)} results from ${fmtInt(G.files.length)} file${G.files.length === 1 ? '' : 's'}. Files are read in your browser and never uploaded.` : 'You can select many files at once, or one file with a row per person. Files are read in your browser and never uploaded.')
    ];
    if (G.notes.length) head.push(h('p', { class: 'note warn' }, [...new Set(G.notes)].join(' ')));
    if (!G.leaders.length) { put(box, head); return; }
    const counts = new Map();
    G.leaders.forEach(l => counts.set(groupKey(l), (counts.get(groupKey(l)) || 0) + 1));
    if (!G.key || !counts.has(G.key)) G.key = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (counts.size > 1) head.push(h('div', { class: 'flow' },
      h('p', { class: 'note warn' }, 'These results come from different teammates or test versions. Scores from different AI models or versions are not comparable, so analyse one set at a time.'),
      h('div', { class: 'field', style: { maxWidth: '420px' } }, h('label', { for: 'ai-group-key' }, 'Analyse'),
        h('select', { id: 'ai-group-key', onchange: e => { G.key = e.target.value; renderGroup(); } }, [...counts.entries()].map(([k, n]) => h('option', { value: k, selected: k === G.key }, `${groupLabel(k)} (${n} ${n === 1 ? 'person' : 'people'})`))))));
    let res;
    try { res = S.aiGroup(G.leaders.filter(l => groupKey(l) === G.key), { level: 0.95 }); }
    catch (e) { put(box, head, h('p', { class: 'note warn' }, e.message)); return; }
    AI.group.result = res;
    const fit = res.fit, adj = res.useSolo;
    const c = { above: 0, below: 0, unclear: 0 }; res.people.forEach(p => c[p.cls]++);
    const tiles = h('div', { class: 'stats' },
      h('div', { class: 'stat lead' }, h('span', { class: 'label' }, adj ? 'Typical leadership effect (beyond solo skill)' : 'Typical leadership effect (total)'), h('span', { class: 'value' }, fmt(fit.sigmaA, 2), h('span', { class: 'small muted' }, ' SD')), h('span', { class: 'sub' }, `95% CI ${fmt(fit.ci[0], 2)}–${fmt(fit.ci[1], 2)} · profile likelihood`)),
      adj ? h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Solo skill, per SD'), h('span', { class: 'value' }, fmt(res.soloBeta.b, 2), h('span', { class: 'small muted' }, ' SD')), h('span', { class: 'sub' }, `of team-puzzle score · p ${fmtP(res.soloBeta.p)}`)) : '',
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Reliability per person'), h('span', { class: 'value' }, fmt(res.reliability, 2)), h('span', { class: 'sub' }, `${fmt(res.puzzlesPerPerson, 1)} team puzzles each`)),
      h('div', { class: 'stat' }, h('span', { class: 'label' }, 'People'), h('span', { class: 'value' }, fmtInt(res.nPeople)), h('span', { class: 'sub' }, `${c.above} above average · ${c.below} below · ${c.unclear} can't tell`)));
    const verdict = h('p', { class: 'verdict' },
      fit.ci[0] <= 0 ? 'The spread between people is within what noise alone would produce, so this group cannot be ranked on leadership yet. ' : `People differ in how much they lift their AI team${adj ? ' beyond what their solo reasoning predicts' : ''}: one SD of leadership is worth about ${fmt(fit.sigmaA, 2)} SD of team-puzzle score. `,
      res.reliability < 0.6 ? `With ${fmt(res.puzzlesPerPerson, 1)} puzzles per person, individual estimates are noisy (reliability ${fmt(res.reliability, 2)}); treat the ranking as provisional.` : `Individual estimates are reasonably reliable (${fmt(res.reliability, 2)}).`,
      ' These estimates rank people within this group only. They are not validated against leadership of human teams.');
    const truth = G.isExample && G.truth ? h('p', { class: 'small muted' }, `Simulated data: leadership and solo skill both raise team scores. Correlation between each estimate and true leadership r = ${fmt(S.cor(res.people.map(p => p.eb), res.people.map(p => G.truth[p.id])).r, 2)}; between each estimate and solo skill r = ${fmt(S.cor(res.people.map(p => p.eb), res.people.map(p => p.solo)).r, 2)}.`) : '';
    const rows = res.people.map(p => h('tr', {},
      h('td', {}, p.id), h('td', { class: 'num' }, Math.round(p.score)), h('td', { class: 'num' }, isFinite(p.solo) ? Math.round(p.solo) : '–'),
      h('td', { class: 'num' }, fmtS(p.eb, 2)), h('td', { class: 'num' }, `${fmtS(p.lo, 2)} to ${fmtS(p.hi, 2)}`), h('td', { class: 'num' }, p.pct),
      h('td', {}, h('span', { class: 'pill ' + (p.cls === 'above' ? 'pos' : p.cls === 'below' ? 'neg' : '') }, h('span', { class: 'dot' }), p.cls === 'above' ? 'Above average' : p.cls === 'below' ? 'Below average' : 'Can\'t tell'))));
    put(box, head,
      res.warnings.length ? h('p', { class: 'note warn' }, res.warnings.join(' ')) : '',
      G.isExample ? h('p', { class: 'note example' }, h('strong', {}, 'Example data. '), 'Forty simulated people. Load your own results files to replace them.') : '',
      tiles, verdict, truth,
      h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Person', 'Team score (raw)', 'Solo score', adj ? 'Leadership estimate (SD)' : 'Total estimate (SD)', '95% interval', 'Percentile', 'Classification'].map((t, i) => h('th', { class: i && i < 6 ? 'num' : '' }, t)))), h('tbody', {}, rows))),
      h('p', { class: 'small muted' }, 'Team and solo scores are 0–100 means. Each estimate is the person\'s average puzzle score, standardised within puzzle' + (adj ? ' and net of solo skill' : '') + ', pulled toward zero in proportion to its noise (empirical Bayes). "Can\'t tell" means the 95% interval includes the group average.'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: exportGroup }, 'Download estimates (CSV)')));
  }
  function exportGroup() {
    const res = AI.group.result; if (!res) return;
    const rows = res.people.map(p => ({ person: p.id, engine: p.engine, model: p.model, test_version: p.version, team_score: fmt(p.score, 2), solo_score: fmt(p.solo, 2), team_puzzles: p.n, total_z: p.total.toFixed(4), residual_mean: p.raw.toFixed(4), estimate_eb: p.eb.toFixed(4), interval_low: p.lo.toFixed(4), interval_high: p.hi.toFixed(4), posterior_sd: p.postSd.toFixed(4), percentile: p.pct, classification: p.cls, adjusted_for_solo: res.useSolo ? 1 : 0 }));
    offerFile('ai_group_estimates.csv', toCSV(Object.keys(rows[0]), rows).replace(/−/g, '-'), 'text/csv');
  }

  async function checkKey(el) {
    const st = AI.settings;
    if (st.engine === 'gemini') {
      if (!st.geminiKey) { el.textContent = 'Enter a key first.'; return; }
      el.textContent = 'Checking…';
      try { await LLM.geminiCheck(st.geminiKey, LLM.GEMINI_MODEL); el.textContent = 'Key works and can use Gemini 3.8 Flash.'; }
      catch (e) { el.textContent = geminiErrorText(e); }
      return;
    }
    if (!st.apiKey) { el.textContent = 'Enter a key first.'; return; }
    el.textContent = 'Checking…';
    try {
      const client = await getClient();
      await client.models.retrieve(st.model);
      el.textContent = 'Key works and can use ' + MODELS.find(m => m.id === st.model).label + '.';
    } catch (e) { el.textContent = await apiErrorText(e); }
  }

  /* ---- unfinished tests: saved as you play, so a reload, a closed tab or "Save and exit" can resume ---- */
  const PROGRESS_DAYS = 7;
  function saveProgress() {
    if (AI.phase !== 'puzzle' && AI.phase !== 'feedback') return;
    const c = AI.phase === 'puzzle' ? AI.cur : null;
    if (c && c.paused) return;
    store.set('ai.progress', {
      v: PZ.VERSION, savedAt: Date.now(), order: AI.order, idx: AI.idx, phase: AI.phase, results: AI.results,
      // the clock stops while the player is away: only the time used so far is kept
      cur: c && { id: c.puzzle.id, used: Date.now() - c.startedAt, mins: c.mins, locked: c.locked, messages: c.messages, seq: c.seq, to: c.to, draft: c.draft,
        answers: c.answers, out: c.out, engine: c.engine, shared: Object.fromEntries(FOL.map(f => [f.id, [...c.followers[f.id].shared]])),
        // teammates still typing lose their reply if the page closes, so they are asked again on resume
        pending: FOL.map(f => f.id).filter(id => c.followers[id].busy || c.followers[id].queued) }
    });
    if (c) c.savedAt = Date.now();
  }
  function loadProgress() {
    const pr = store.get('ai.progress', null);
    if (!pr) return null;
    const ok = pr.v === PZ.VERSION && Array.isArray(pr.order) && pr.order.length && Date.now() - pr.savedAt < PROGRESS_DAYS * 864e5 &&
      (pr.phase === 'feedback' ? Array.isArray(pr.results) && pr.results.length : pr.cur && PZ.PUZZLES.some(p => p.id === pr.cur.id));
    if (!ok) { store.del('ai.progress'); return null; }
    return pr;
  }
  const clearProgress = () => store.del('ai.progress');
  function engineReady(e) {
    if (e === 'scripted') return true;
    if (e === 'hosted') return !inClaude && !!HOSTED_URL;
    if (e === 'claude') return inClaude && AI.sampleState === 'ready';
    if (e === 'gemini') return !inClaude && !!AI.settings.geminiKey;
    if (e === 'api') return !inClaude && !!AI.settings.apiKey;
    return false;
  }
  function resumeTest() {
    const pr = loadProgress();
    if (!pr) { renderIntro(); return; }
    AI.notice = '';
    AI.order = pr.order; AI.idx = pr.idx; AI.results = pr.results || [];
    if (pr.phase === 'feedback') { AI.phase = 'feedback'; AI.render(); window.scrollTo(0, 0); return; }
    const s = pr.cur, p = PZ.PUZZLES.find(x => x.id === s.id), startedAt = Date.now() - (+s.used || 0);
    let engine = s.engine, note = '';
    if (!engineReady(engine)) {
      engine = engineReady('hosted') ? 'hosted' : 'scripted';
      note = ` Your earlier teammates are not available here, so ${engine === 'hosted' ? 'live AI' : 'scripted'} teammates take over.`;
    }
    AI.cur = {
      puzzle: p, startedAt, mins: s.mins, deadline: s.mins ? startedAt + s.mins * 60000 : null, locked: !!s.locked,
      messages: s.messages || [], seq: s.seq || 0, to: s.to || 'all', draft: s.draft || '', confirm: false, timer: null,
      answers: s.answers, out: s.out,
      followers: Object.fromEntries(FOL.map(f => [f.id, { busy: false, queued: false, ctl: null, shared: new Set((s.shared || {})[f.id] || []), bubble: null }])),
      engine
    };
    AI.phase = 'puzzle';
    AI.render();
    window.scrollTo(0, 0);
    if (!p.solo) addSys('Welcome back. The clock was paused while you were away.' + note);
    tick();
    if (!AI.cur.locked) (s.pending || []).forEach(requestReply);
    saveProgress();
  }
  /** Leave mid-puzzle without losing anything: the test can be resumed from the start screen. */
  function exitTest() {
    const c = AI.cur;
    if (c && AI.phase === 'puzzle') {
      saveProgress();   // before cancelling replies still on their way, so they count as pending
      c.paused = true; clearTimeout(c.timer);
      for (const f of Object.values(c.followers)) { f.queued = false; if (f.ctl) f.ctl.abort(); }
    }
    AI.phase = 'intro'; AI.render(); window.scrollTo(0, 0);
  }
  const ago = ms => { const m = Math.round(ms / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  function resumeBox() {
    const pr = loadProgress();
    if (!pr) return '';
    const title = id => (PZ.PUZZLES.find(p => p.id === id) || { title: '' }).title, of = `${pr.idx + 1} of ${pr.order.length}`;
    let text;
    if (pr.phase === 'feedback') text = `You finished puzzle ${of}, ${title(pr.order[pr.idx])}` + (pr.idx + 1 < pr.order.length ? `; next up is ${title(pr.order[pr.idx + 1])}.` : '.');
    else {
      const left = pr.cur.mins ? Math.max(0, pr.cur.mins * 60 - Math.round(pr.cur.used / 1000)) : null;
      text = `Puzzle ${of}, ${title(pr.cur.id)}` + (pr.cur.messages.length ? `, with your chat so far` : '') + '. ' +
        (pr.cur.locked ? 'Time was up; your answers are waiting to be submitted.' : left != null ? `The clock is paused at ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}.` : 'No time limit.');
    }
    const waiting = pr.cur && pr.cur.engine === 'claude' && AI.sampleState === 'checking';
    return h('div', { class: 'note good resume', id: 'ai-resume' },
      h('p', {}, h('strong', {}, 'Pick up where you left off. '), text, h('span', { class: 'muted' }, ` Saved ${ago(Date.now() - pr.savedAt)}.`)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', type: 'button', disabled: waiting || null, onclick: resumeTest }, waiting ? 'Checking Claude…' : 'Resume test'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => { clearProgress(); renderIntro(); } }, 'Discard and start over')));
  }
  // save the clock when the page is hidden or closed (switching apps on a phone, closing the tab)
  const saveOnLeave = () => { if (AI.phase === 'puzzle' && AI.cur && !AI.cur.paused) saveProgress(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveOnLeave(); });
  window.addEventListener('pagehide', saveOnLeave);

  function startTest() {
    const st = AI.settings;
    AI.notice = '';
    if (st.engine === 'gemini' && !st.geminiKey) { AI.notice = 'Enter your Gemini API key, or choose scripted teammates.'; renderIntro(); }
    if (st.engine === 'api' && !st.apiKey) { AI.notice = 'Enter your Anthropic API key, or choose scripted teammates.'; renderIntro(); }
    if (st.engine === 'claude' && AI.sampleState !== 'ready') { AI.notice = 'Claude is not available in this view. Choose scripted teammates.'; renderIntro(); }
    if (AI.notice) { const n = $('#ai-notice'); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const L = LENGTHS[st.length] || LENGTHS.quick;
    AI.order = PZ.PUZZLES.filter(p => p.solo).slice(0, L.warmups).concat(PZ.PUZZLES.filter(p => !p.solo && (!L.team || L.team.includes(p.id)))).map(p => p.id);
    AI.idx = 0; AI.results = [];
    startPuzzle();
  }

  function startPuzzle() {
    const p = PZ.PUZZLES.find(x => x.id === AI.order[AI.idx]);
    const mins = p.solo ? (AI.settings.minutes ? 4 : 0) : AI.settings.minutes;
    AI.cur = {
      puzzle: p, startedAt: Date.now(), mins, deadline: mins ? Date.now() + mins * 60000 : null, locked: false,
      messages: [], seq: 0, to: 'all', draft: '', confirm: false, timer: null,
      answers: p.questions.map(() => [20, 20, 20, 20, 20]), out: p.questions.map(() => [false, false, false, false, false]),
      followers: Object.fromEntries(FOL.map(f => [f.id, { busy: false, queued: false, ctl: null, shared: new Set(), bubble: null }])),
      engine: AI.settings.engine
    };
    AI.phase = 'puzzle';
    AI.render();
    window.scrollTo(0, 0);
    tick();
    saveProgress();
  }

  function elapsed() { return Math.round((Date.now() - AI.cur.startedAt) / 1000); }
  function tick() {
    const c = AI.cur; if (!c || AI.phase !== 'puzzle' || c.paused) return;
    clearTimeout(c.timer);
    const el = $('#ai-timer');
    if (c.deadline) {
      const left = Math.max(0, c.deadline - Date.now());
      if (el) { el.textContent = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'); el.classList.toggle('low', left < 60000); }
      if (left <= 0 && !c.locked) { lockChat('Time is up. Submit your answers.'); saveProgress(); return; }
    } else if (el) { const e = elapsed(); el.textContent = Math.floor(e / 60) + ':' + String(e % 60).padStart(2, '0'); }
    if (!c.locked && Date.now() - (c.savedAt || 0) > 5000) saveProgress();   // keep the paused clock close to the truth
    c.timer = setTimeout(tick, 250);
  }
  function lockChat(msg) {
    const c = AI.cur; c.locked = true;
    for (const f of Object.values(c.followers)) { if (f.ctl) f.ctl.abort(); f.queued = false; }
    const comp = $('#composer'); if (comp) $$('textarea,button', comp).forEach(x => { x.disabled = true; });
    if (msg) addSys(msg);
  }

  /* ---- puzzle screen ---- */
  function renderPuzzle() {
    const c = AI.cur, p = c.puzzle, root = AI.root();
    const pos = AI.idx + 1, total = AI.order.length;
    const mine = PZ.cluesFor(p, 'leader');
    const reports = h('div', { class: 'reports' }, mine.map(cl => h('div', { class: 'report' },
      h('span', { class: 'q' }, 'Q' + (cl.q + 1) + (p.solo ? '' : cl.holder === 'public' ? ' · shared with the team' : ' · only you')),
      h('span', { class: 'rn' }, '#' + cl.num), cl.text)));
    const brief = h('div', { class: 'panel brief' },
      h('div', { class: 'eyebrow' }, p.solo ? 'Solo warm-up' : 'Team puzzle'),
      h('h3', {}, p.title), h('p', { class: 'small' }, p.scenario),
      h('ol', { class: 'small', style: { paddingLeft: '1.2em', margin: '0' } }, p.questions.map(q => h('li', {}, q.text))),
      h('h4', {}, p.solo ? 'All reports' : 'Your reports'), reports);
    const answers = h('div', { class: 'panel', id: 'answers' });
    const top = h('div', { class: 'ai-top' },
      h('div', {}, h('div', { class: 'eyebrow' }, `Puzzle ${pos} of ${total}`), h('h2', {}, p.title)),
      h('div', { class: 'btn-row' }, h('span', { class: 'timer', id: 'ai-timer', 'aria-live': 'off' }, '–:––'),
        h('button', { class: 'btn quiet', type: 'button', title: 'Your progress is saved. Resume from the start screen, now or later.', onclick: exitTest }, 'Save and exit')));
    let middle = '';
    if (!p.solo) middle = renderChat();
    put(root, top, h('div', { class: 'ai-grid' + (p.solo ? ' solo' : '') }, brief, middle, answers));
    renderAnswers();
    if (!p.solo) {
      const msgs = $('#msgs');
      c.messages.forEach(m => msgs.append(msgEl(m)));
      if (!c.messages.length) addSys(c.engine === 'scripted' ? 'Your scripted teammates are ready. They pick up names, options, report numbers and topics from your messages.' : 'Your teammates are online. Say hello, then start gathering information.');
      if (c.locked) lockChat();
    }
  }

  function renderChat() {
    const c = AI.cur;
    const toBtn = (id, label) => h('button', { type: 'button', 'aria-pressed': c.to === id ? 'true' : 'false', onclick: e => { c.to = id; $$('.to-row button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false')); $('#chat-in').focus(); } }, label);
    const ta = h('textarea', { id: 'chat-in', rows: 1, placeholder: 'Message your team… (Enter to send, Shift+Enter for a new line)', 'aria-label': 'Message',
      onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }, oninput: e => { c.draft = e.target.value; } });
    ta.value = c.draft || '';
    return h('div', { class: 'panel chat' },
      h('div', { class: 'chat-head' },
        h('div', { class: 'team' },
          h('span', { class: 'member' }, h('span', { class: 'avatar leader' }, 'Y'), 'You (leader)'),
          FOL.map(f => h('span', { class: 'member' }, h('span', { class: 'avatar ' + f.id }, f.name[0]), f.name))),
        h('span', { class: 'small muted' }, engineLabel())),
      h('div', { class: 'msgs', id: 'msgs', 'aria-live': 'polite' }),
      h('div', { class: 'composer', id: 'composer' },
        h('div', { class: 'to-row' }, 'To:', toBtn('all', 'Everyone'), FOL.map(f => toBtn(f.id, f.name))),
        h('div', { class: 'send-row' }, ta, h('button', { class: 'btn primary', type: 'button', onclick: send }, 'Send'))));
  }
  function engineLabel() {
    const e = AI.cur ? AI.cur.engine : AI.settings.engine;
    if (e === 'claude') return 'Teammates: Claude';
    if (e === 'gemini' || e === 'hosted') return 'Teammates: Gemini 3.8 Flash';
    if (e === 'api') return 'Teammates: ' + (MODELS.find(m => m.id === AI.settings.model) || MODELS[0]).label;
    return 'Teammates: scripted';
  }
  function msgEl(m) {
    const me = m.from === 'leader';
    const who = me ? 'You → ' + (m.to === 'all' ? 'everyone' : folName(m.to)) : folName(m.from);
    return h('div', { class: 'msg' + (me ? ' me' : '') }, h('span', { class: 'avatar ' + (me ? 'leader' : m.from) }, me ? 'Y' : folName(m.from)[0]),
      h('div', { class: 'bubble' }, h('span', { class: 'who' }, who), m.text));
  }
  function addSys(text) { const msgs = $('#msgs'); if (!msgs) return; msgs.append(h('div', { class: 'sys' }, text)); msgs.scrollTop = msgs.scrollHeight; }
  function scrollChat() { const msgs = $('#msgs'); if (msgs) msgs.scrollTop = msgs.scrollHeight; }

  function send() {
    const c = AI.cur, ta = $('#chat-in');
    if (!c || c.locked) return;
    const text = ta.value.trim(); if (!text) return;
    ta.value = ''; c.draft = '';
    const m = { from: 'leader', to: c.to, text, t: elapsed(), seq: ++c.seq };
    c.messages.push(m);
    $('#msgs').append(msgEl(m)); scrollChat();
    (c.to === 'all' ? FOL.map(f => f.id) : [c.to]).forEach(requestReply);
    saveProgress();
  }

  function requestReply(fid) {
    const c = AI.cur, st = c.followers[fid];
    if (c.locked || c.paused) return;
    if (st.busy) { st.queued = true; return; }
    st.busy = true;
    const bubbleText = h('span', {}, 'typing…');
    const bubble = h('div', { class: 'bubble typing' }, h('span', { class: 'who' }, folName(fid)), bubbleText);
    const row = h('div', { class: 'msg' }, h('span', { class: 'avatar ' + fid }, folName(fid)[0]), bubble);
    $('#msgs').append(row); scrollChat();
    const ctl = new AbortController(); st.ctl = ctl;
    // A reply answers the messages sent before it was requested, so it is filed there, even when the leader
    // writes again while it is still coming in; otherwise the teammate's turn would look finished and the
    // newer message would never get an answer.
    const puzzleAt = c, at = c.seq + 0.5;
    engineReply(fid, ctl.signal, text => { if (text && !/^PASS/i.test(text)) { bubble.classList.remove('typing'); bubbleText.textContent = text; scrollChat(); } })
      .then(text => {
        if (AI.cur !== puzzleAt) return;
        text = cleanReply(text, fid);
        if (!text) { row.remove(); return; }
        bubble.classList.remove('typing'); bubbleText.textContent = text;
        c.messages.push({ from: fid, to: 'leader', text, t: elapsed(), seq: at });
        c.messages.sort((a, b) => a.seq - b.seq);
        scrollChat();
      })
      .catch(async err => {
        if (AI.cur !== puzzleAt) return;
        if (err && err.code === 'cancelled') { row.remove(); return; }
        bubble.classList.remove('typing'); bubble.classList.add('err');
        bubbleText.textContent = await engineErrorText(err);
        c.errors = (c.errors || 0) + 1;
        if (((err && err.fatal) || c.errors >= 3) && !c.fatalShown && c.engine !== 'scripted') {
          c.fatalShown = true;
          const msgs = $('#msgs');
          if (msgs) { msgs.append(h('div', { class: 'sys' }, err && err.fatal ? 'The teammates cannot reply. ' : 'Replies keep failing. ', h('button', { class: 'btn quiet', type: 'button', onclick: e => { c.engine = 'scripted'; AI.settings.engine = 'scripted'; saveSettings(); e.currentTarget.parentElement.replaceWith(h('div', { class: 'sys' }, 'Switched to scripted teammates. Send your message again.')); } }, 'Switch to scripted teammates'))); scrollChat(); }
        }
      })
      .finally(() => {
        st.busy = false; st.ctl = null;
        if (AI.cur !== puzzleAt || c.paused) return;
        if (st.queued && !c.locked) { st.queued = false; requestReply(fid); }
        if (AI.phase === 'puzzle') saveProgress();
      });
  }
  function cleanReply(text, fid) {
    let t = String(text || '').trim();
    const nm = folName(fid);
    t = t.replace(new RegExp('^\\**' + nm + '\\**\\s*[:\\-–]\\s*', 'i'), '').replace(/^"(.*)"$/s, '$1').trim();
    return /^PASS\b/i.test(t) ? '' : t;
  }

  /* ---- teammate engines ---- */
  function followerTurns(fid) {
    const turns = [];
    for (const m of AI.cur.messages) {
      let role, content;
      if (m.from === 'leader' && (m.to === 'all' || m.to === fid)) { role = 'user'; content = (m.to === 'all' ? '[Leader, to everyone] ' : '[Leader, to you] ') + m.text; }
      else if (m.from === fid) { role = 'assistant'; content = m.text; }
      else continue;
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.content += '\n' + content; else turns.push({ role, content });
    }
    return turns;
  }
  function engineReply(fid, signal, onText) {
    const c = AI.cur, f = FOL.find(x => x.id === fid);
    if (c.engine === 'scripted') return scriptedReply(fid, signal);
    const system = PZ.followerBrief(c.puzzle, f), turns = followerTurns(fid);
    if (!turns.length || turns[turns.length - 1].role !== 'user') return Promise.reject({ code: 'cancelled' });
    if (c.engine === 'gemini') {
      return LLM.geminiStream({ apiKey: AI.settings.geminiKey, model: LLM.GEMINI_MODEL, system, messages: turns, signal, onText: t => onText(cleanReply(t, fid)) }).then(r => r.text);
    }
    if (c.engine === 'hosted') {
      return LLM.hostedStream({ url: HOSTED_URL, version: PZ.VERSION, puzzle: c.puzzle.id, follower: fid, messages: turns, signal, onText: t => onText(cleanReply(t, fid)) }).then(r => r.text);
    }
    if (c.engine === 'claude') {
      const input = [{ role: 'user', content: system + `\n\nThe chat follows. Reply with ${f.name}'s next chat message only.` }].concat(turns);
      return AI.sample(input, { modelTier: 'quick', cache: false, signal, onText: ({ text }) => onText(cleanReply(text, fid)) }).then(r => r.text);
    }
    return apiReply(system, turns, signal, t => onText(cleanReply(t, fid)));
  }

  let AnthropicSDK = null, apiClient = null, apiClientKey = null;
  async function getClient() {
    if (!AnthropicSDK) AnthropicSDK = (await import(SDK_URL)).default;
    if (!apiClient || apiClientKey !== AI.settings.apiKey) {
      apiClient = new AnthropicSDK({ apiKey: AI.settings.apiKey, dangerouslyAllowBrowser: true });
      apiClientKey = AI.settings.apiKey;
    }
    return apiClient;
  }
  async function apiReply(system, messages, signal, onText) {
    const client = await getClient();
    const model = AI.settings.model;
    const params = { model, max_tokens: 4000, system, messages, output_config: { effort: 'low' } };
    // Opus/Sonnet 5.5: let the API retry a declined request on its recommended fallback model.
    const stream = model === 'claude-haiku-5-5'
      ? client.messages.stream(params)
      : client.beta.messages.stream(Object.assign({}, params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }));
    const onAbort = () => stream.abort();
    signal.addEventListener('abort', onAbort);
    stream.on('text', (delta, snapshot) => onText(snapshot));
    try {
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw { code: 'refused' };
      let text = '';
      for (const b of msg.content) { if (b.type === 'fallback') text = ''; else if (b.type === 'text') text += b.text; }
      return text;
    } catch (e) {
      if (signal.aborted || isA(e, 'APIUserAbortError')) throw { code: 'cancelled' };
      throw e;
    } finally { signal.removeEventListener('abort', onAbort); }
  }
  const isA = (e, name) => !!(AnthropicSDK && typeof AnthropicSDK[name] === 'function' && e instanceof AnthropicSDK[name]);
  async function apiErrorText(e) {
    const A = AnthropicSDK;
    if (A) {
      if (isA(e, 'AuthenticationError')) return 'The API key was rejected. Check it on the start screen.';
      if (isA(e, 'PermissionDeniedError')) return 'This key is not allowed to use the selected model.';
      if (isA(e, 'NotFoundError')) return 'The selected model is not available to this key.';
      if (isA(e, 'RateLimitError')) return 'Rate limit reached. Wait a few seconds and ask again.';
      if (isA(e, 'APIConnectionError')) return 'Could not reach the Anthropic API. Check your connection and ask again.';
      if (isA(e, 'BadRequestError')) return 'The API rejected the request: ' + (e.message || 'bad request') + '. Try another model on the start screen.';
      if (isA(e, 'APIError')) return 'The API returned an error' + (e.status ? ' (' + e.status + ')' : '') + '. Ask again.';
    }
    if (e && e.code === 'refused') return 'No reply to that message. Try rephrasing it.';
    return 'Could not load the Claude SDK or reach the API: ' + ((e && e.message) || 'unknown error');
  }
  function geminiErrorText(e) {
    const code = e && e.code, st = e && e.status, reason = (e && e.reason) || '';
    if (code === 'refused') return 'No reply to that message. Try rephrasing it.';
    if (code === 'network') return 'Could not reach the Gemini API. Check your connection and ask again.';
    if (/API_KEY/.test(reason) || st === 401) { if (e) e.fatal = true; return 'The Gemini API key was rejected. Check it on the start screen.'; }
    if (st === 403) { if (e) e.fatal = true; return 'This key cannot use Gemini 3.8 Flash. Check that the Gemini API is enabled for it.'; }
    if (st === 404) { if (e) e.fatal = true; return 'Gemini 3.8 Flash is not available to this key.'; }
    if (st === 429) return 'Gemini rate limit or quota reached. Wait a few seconds and ask again.';
    if (st >= 500) return 'Gemini is busy right now. Ask again.';
    if (st === 400) { if (e) e.fatal = true; return 'Gemini rejected the request: ' + ((e && e.message) || 'bad request'); }
    return 'The reply was interrupted. Ask again.';
  }
  function hostedErrorText(e) {
    const code = e && e.code, st = e && e.status, reason = (e && e.reason) || '';
    if (code === 'refused') return 'No reply to that message. Try rephrasing it.';
    if (code === 'network') return 'Could not reach the AI teammates. Check your connection and ask again.';
    if (reason === 'DAILY_LIMIT') { e.fatal = true; return 'The free AI teammates are used up for today. Switch to scripted teammates, or come back tomorrow.'; }
    if (st === 429) return 'Too many messages at once. Wait a few seconds and ask again.';
    if (st === 409) { e.fatal = true; return 'This page is out of date. Reload it to continue.'; }
    if (st === 403 || reason === 'NOT_CONFIGURED') { e.fatal = true; return 'The hosted AI teammates are not available from this page.'; }
    if (st === 400 || st === 413) return 'That message could not be sent. Try a shorter one.';
    return 'The AI teammates are busy right now. Ask again in a moment.';
  }
  async function engineErrorText(e) {
    if (AI.cur && AI.cur.engine === 'gemini') return geminiErrorText(e);
    if (AI.cur && AI.cur.engine === 'hosted') return hostedErrorText(e);
    if (AI.cur && AI.cur.engine === 'api') {
      const A = AnthropicSDK;
      if (A && (isA(e, 'AuthenticationError') || isA(e, 'PermissionDeniedError') || isA(e, 'NotFoundError') || isA(e, 'BadRequestError'))) e.fatal = true;
      return apiErrorText(e);
    }
    const code = e && e.code;
    const map = {
      not_granted: 'Claude access was not allowed for this page.', sampling_disabled: 'Claude is not available for this account.',
      rate_limited: 'Too many requests right now. Wait a moment and ask again.', refused: 'No reply to that message. Try rephrasing it.',
      session_expired: 'Your Claude session expired. Sign in again.', empty_completion: 'No reply. Ask again.'
    };
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'].includes(code)) e.fatal = true;
    return map[code] || 'The reply was interrupted. Ask again.';
  }

  function scriptedReply(fid, signal) {
    const st = AI.cur.followers[fid], shared = new Set(st.shared);
    const reply = SCR.reply(AI.cur.puzzle, fid, AI.cur.messages, shared);
    // a typing pause that grows with the length of the reply
    const wait = reply ? Math.min(2800, 600 + reply.length * 12) * (0.8 + Math.random() * 0.4) : 250;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { st.shared = shared; resolve(reply); }, wait);
      signal.addEventListener('abort', () => { clearTimeout(t); reject({ code: 'cancelled' }); });
    });
  }

  /* ---- answers ---- */
  function evenSplit(qi) {
    const c = AI.cur, out = c.out[qi], left = out.map((o, i) => (o ? -1 : i)).filter(i => i >= 0);
    const a = [0, 0, 0, 0, 0];
    if (left.length) { const base = Math.floor(100 / left.length); left.forEach(i => { a[i] = base; }); for (let k = 0; k < 100 - base * left.length; k++) a[left[k]]++; }
    c.answers[qi] = a;
  }
  // keeps the proportions the leader typed but makes them add up to 100
  function scaleAnswers(qi) {
    const a = S.scaleTo100(AI.cur.answers[qi]);
    if (a) AI.cur.answers[qi] = a;
  }
  function renderAnswers() {
    const c = AI.cur, p = c.puzzle, box = $('#answers');
    const L = 'ABCDE';
    const qBlocks = p.questions.map((q, qi) => {
      const sum = c.answers[qi].reduce((a, b) => a + (+b || 0), 0);
      return h('div', { class: 'answer-q' },
        h('h4', {}, `Q${qi + 1}. ${q.text}`),
        q.options.map((o, k) => h('div', { class: 'opt' + (c.out[qi][k] ? ' out' : '') },
          h('span', { class: 'name' }, L[k] + '. ' + o),
          h('input', { type: 'number', min: 0, max: 100, step: 1, value: c.answers[qi][k], 'aria-label': `Percent for ${o}`, id: `ans-${qi}-${k}`,
            oninput: e => { c.answers[qi][k] = Math.max(0, Math.min(100, +e.target.value || 0)); updateSums(); saveProgress(); } }),
          h('button', { class: 'x', type: 'button', 'aria-pressed': c.out[qi][k] ? 'true' : 'false', 'aria-label': `Rule out ${o}`, title: 'Rule out',
            onclick: () => { c.out[qi][k] = !c.out[qi][k]; evenSplit(qi); renderAnswers(); saveProgress(); } }, '✕'))),
        h('div', { class: 'sum', id: `sum-${qi}` }, h('span', {}, `Total ${sum}%`),
          h('span', { class: 'btn-row' },
            h('button', { class: 'btn quiet', type: 'button', id: `scale-${qi}`, title: 'Rescale your numbers proportionally so they add up to 100', onclick: () => { scaleAnswers(qi); renderAnswers(); saveProgress(); } }, 'Scale to 100%'),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => { evenSplit(qi); renderAnswers(); saveProgress(); } }, 'Even split'))));
    });
    put(box,
      h('div', { class: 'panel-head' }, h('h3', {}, 'Your answer'), h('span', { class: 'small muted' }, 'Rule options out with ✕')),
      AI.results.length ? '' : h('p', { class: 'note small' }, h('strong', {}, 'How to answer. '), 'Press ✕ on each option a report rules out; the 100 points then split evenly over the rest. You score highest when the options you keep are exactly the ones still possible. If you type your own numbers, Scale to 100% rescales them proportionally.'),
      qBlocks,
      h('p', { class: 'small muted', id: 'ans-msg' }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', id: 'submit-btn', onclick: submitAnswers }, c.confirm ? 'Confirm and finish' : 'Submit answers')));
    updateSums();
  }
  function updateSums() {
    const c = AI.cur;
    c.answers.forEach((a, qi) => {
      const sum = a.reduce((x, y) => x + (+y || 0), 0), el = $('#sum-' + qi);
      if (el) { el.firstChild.textContent = `Total ${sum}%`; el.classList.toggle('bad', Math.abs(sum - 100) > 0.5); }
      const sb = $('#scale-' + qi);
      if (sb) sb.disabled = !(sum > 0) || Math.abs(sum - 100) <= 0.5;
    });
  }
  function submitAnswers() {
    const c = AI.cur, msg = $('#ans-msg');
    const bad = c.answers.findIndex(a => Math.abs(a.reduce((x, y) => x + (+y || 0), 0) - 100) > 0.5);
    if (bad >= 0) { msg.textContent = `Question ${bad + 1} adds up to ${c.answers[bad].reduce((x, y) => x + (+y || 0), 0)}%. Make it 100%, or use Scale to 100% or Even split.`; return; }
    if (!c.confirm && !c.locked && !c.puzzle.solo) { c.confirm = true; $('#submit-btn').textContent = 'Confirm and finish'; msg.textContent = 'Submitting ends the chat for this puzzle.'; setTimeout(() => { if (AI.cur === c && c.confirm) { c.confirm = false; const b = $('#submit-btn'); if (b) b.textContent = 'Submit answers'; } }, 5000); return; }
    lockChat();
    clearTimeout(c.timer);
    const p = c.puzzle;
    const scores = p.questions.map((q, qi) => S.credenceScore(c.answers[qi], S.correctDist(q.answer, 5)));
    const flat = p.questions.map(q => S.credenceScore([20, 20, 20, 20, 20], S.correctDist(q.answer, 5)));
    const timeLeft = c.deadline ? Math.max(0, (c.deadline - Date.now()) / 1000) : null;
    const analysis = COACH.analyse(p, c.messages, c.answers, { timeLeft });
    AI.results.push({ id: p.id, version: PZ.VERSION, title: p.title, solo: !!p.solo, scores, flat, answers: c.answers.map(a => a.slice()), seconds: elapsed(), metrics: p.solo ? null : analysis.metrics, analysis, transcript: c.messages.slice(), engine: c.engine, model: c.engine === 'api' ? AI.settings.model : (c.engine === 'gemini' || c.engine === 'hosted') ? LLM.GEMINI_MODEL : null });
    AI.phase = 'feedback';
    saveProgress();
    AI.render();
    window.scrollTo(0, 0);
  }
  // results saved before the feedback analysis existed get it from their transcript
  function ensureAnalysis(r) {
    if (r.analysis || r.version !== PZ.VERSION) return r;
    const p = PZ.PUZZLES.find(x => x.id === r.id);
    if (!p) return r;
    r.analysis = COACH.analyse(p, r.transcript || [], r.answers);
    if (!r.solo) r.metrics = Object.assign({}, r.metrics, r.analysis.metrics);
    return r;
  }

  /** Stacked bar: the score, points lost in using the reports, points lost to reports that stayed hidden. */
  function pointsSplit(info, solo) {
    const sc = Math.round(info.actual), use = Math.round(info.use), hid = Math.max(0, 100 - sc - use);
    const segs = solo ? [['score', sc, 'Your score'], ['use', 100 - sc, 'lost in reasoning']] : [['score', sc, 'Your score'], ['use', use, 'lost in using the reports you had'], ['hidden', hid, 'lost to reports that stayed hidden']];
    return h('div', { class: 'split' },
      h('div', { class: 'split-bar', role: 'img', 'aria-label': segs.map(([, v, l]) => l === 'Your score' ? `Score ${v}` : `${v} points ${l}`).join('; ') },
        segs.map(([k, v]) => h('div', { class: 'seg-' + k, style: { width: v + '%' } }))),
      h('div', { class: 'legend' }, segs.map(([k, v, l]) => h('span', {}, h('i', { class: 'bar seg-' + k }), l === 'Your score' ? `${l}: ${v}` : `${v} ${l}`))));
  }
  function obsLists(good, tips, goodTitle, tipTitle) {
    const item = o => h('li', {}, o.puzzle ? h('span', { class: 'obs-where' }, o.puzzle + ': ') : '', o.text);
    return h('div', { class: 'obs' },
      h('div', {}, h('h4', {}, goodTitle || 'What worked'), good.length ? h('ul', { class: 'obs-list good' }, good.map(item)) : h('p', { class: 'small muted' }, 'Nothing stood out this time.')),
      h('div', {}, h('h4', {}, tipTitle || 'Try next time'), tips.length ? h('ul', { class: 'obs-list next' }, tips.map(item)) : h('p', { class: 'small muted' }, 'Nothing to fix here.')));
  }

  /* ---- feedback ---- */
  function renderFeedback() {
    const r = ensureAnalysis(AI.results[AI.results.length - 1]), p = PZ.PUZZLES.find(x => x.id === r.id), root = AI.root();
    const A = r.analysis, L = 'ABCDE';
    const holderName = cl => cl.holder === 'leader' ? 'you' : cl.holder === 'public' ? 'everyone' : p.solo ? '' : folName(cl.holder);
    const qCards = p.questions.map((q, qi) => {
      const correct = S.correctDist(q.answer, 5);
      const groups = new Map();
      p.clues.filter(cl => cl.q === qi && cl.kind !== 'noise').forEach(cl => { const k = cl.rules.join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(cl); });
      return h('div', { class: 'panel flow' },
        h('div', { class: 'panel-head' }, h('h4', {}, `Q${qi + 1}. ${q.text}`), h('span', { class: 'score-big' }, Math.round(r.scores[qi]))),
        h('div', { class: 'bars' }, q.options.map((o, k) => h('div', { class: 'bar-row' },
          h('span', { class: 'lab' }, L[k] + '. ' + o),
          h('div', { class: 'bar-pair' }, h('div', { class: 'you', style: { width: r.answers[qi][k] + '%' } }), h('div', { class: 'truth', style: { width: correct[k] + '%' } })),
          h('span', { class: 'num small', style: { textAlign: 'right' } }, r.answers[qi][k] + '%')))),
        h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'bar', style: { background: 'var(--accent)' } }), 'Your answer'), h('span', {}, h('i', { class: 'bar', style: { background: 'var(--neutral)' } }), 'Correct')),
        h('ul', { class: 'explain' }, [...groups.values()].map(cls => h('li', {},
          cls[0].rules.map(i => q.options[i]).join(' and ') + ' ruled out by ' +
          cls.map(cl => `report #${cl.num}` + (p.solo ? '' : ` (${holderName(cl)})`)).join(' + ') + (cls.length > 1 ? ' together' : '') + '.'))),
        h('p', { class: 'small muted' }, `An even split would have scored ${Math.round(r.flat[qi])}` + (p.solo || !A ? '.' : `; the best answer possible with the reports you gathered, ${Math.round(A.info.perQ[qi].best)}.`)));
    });
    const m = r.metrics;
    const last = AI.idx >= AI.order.length - 1, teamDone = AI.results.filter(x => !x.solo).length;
    const obs = A ? COACH.top(A.observations, 2, 3) : { good: [], tips: [] };
    const time = Math.floor(r.seconds / 60) + ':' + String(r.seconds % 60).padStart(2, '0');
    const how = !A ? '' : m ? h('div', { class: 'panel flow' },
      h('h3', {}, 'How you led'),
      pointsSplit(A.info),
      obsLists(obs.good, obs.tips),
      h('div', { class: 'stats' },
        h('div', { class: 'stat lead' }, h('span', { class: 'label' }, 'Hidden reports surfaced'), h('span', { class: 'value' }, `${m.surfaced} of ${m.critical}`), h('span', { class: 'sub' }, 'decisive reports your teammates passed on')),
        h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Questions'), h('span', { class: 'value' }, m.questions), h('span', { class: 'sub' }, `${m.targeted} specific · ${m.generic} general · ${m.repeats} repeated`)),
        h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Follow-ups'), h('span', { class: 'value' }, m.followUps), h('span', { class: 'sub' }, `built on a teammate's answer` + (m.connects ? ` · ${m.connects} passed on to others` : ''))),
        h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Asked directly'), h('span', { class: 'value' }, `${m.askedDirect.length} of 3`), h('span', { class: 'sub' }, m.askedDirect.length ? m.askedDirect.map(folName).join(', ') : 'only messages to everyone')),
        h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Time used'), h('span', { class: 'value' }, time), h('span', { class: 'sub' }, `${m.turns} turns · ${m.words} words`))),
      h('p', { class: 'small muted' }, 'In Study 2, leaders who asked more questions and had more back-and-forth did better with both AI and human teams; the sheer number of words did not matter. Here a question counts as specific when it names an option, a report number or a detail from the reports.' +
        (m.critical && m.surfaced === m.critical ? ' You drew out every decisive report, so more questions would not have added anything here.' : '')))
      : h('div', { class: 'panel flow' }, h('h3', {}, 'How you reasoned'), pointsSplit(A.info, true), obsLists(obs.good, obs.tips),
        h('p', { class: 'small muted' }, 'In the warm-up you see every report, so any points lost come from reasoning, not from missing information.'));
    put(root,
      h('div', { class: 'ai-top' }, h('div', {}, h('div', { class: 'eyebrow' }, `Puzzle ${AI.idx + 1} of ${AI.order.length} · result`), h('h2', {}, p.title)),
        h('div', { class: 'btn-row' },
          !last && teamDone ? h('button', { class: 'btn quiet', type: 'button', onclick: finishTest }, 'Stop here and see results') : '',
          h('button', { class: 'btn primary', type: 'button', onclick: () => { if (last) { finishTest(); } else { AI.idx++; startPuzzle(); } } }, last ? 'See your results' : 'Next puzzle'))),
      how,
      h('div', { class: 'grid-2' }, qCards));
  }

  function finishTest() {
    AI.phase = 'summary';
    store.set('ai.last', { results: AI.results, name: AI.settings.name, when: new Date().toISOString() });
    clearProgress();
    AI.render();
    window.scrollTo(0, 0);
  }

  function summaryNumbers(results) {
    results.forEach(ensureAnalysis);
    const team = results.filter(r => !r.solo), solo = results.filter(r => r.solo);
    const all = team.flatMap(r => r.scores), soloAll = solo.flatMap(r => r.scores);
    const solved = all.filter(x => x >= 95).length;
    // rough 95% range for the raw score, treating puzzles as the units of measurement
    const per = team.map(r => S.mean(r.scores));
    let teamLo = NaN, teamHi = NaN;
    // (with two puzzles the t interval spans almost 0–100 and says nothing, so it needs three or more)
    if (per.length >= 3) { const half = S.tCrit(per.length - 1) * S.sd(per) / Math.sqrt(per.length); teamLo = Math.max(0, S.mean(per) - half); teamHi = Math.min(100, S.mean(per) + half); }
    const C = COACH.summarise(results);
    return Object.assign({ team, solo, teamScore: all.length ? S.mean(all) : NaN, teamLo, teamHi, solved, nq: all.length, soloScore: soloAll.length ? S.mean(soloAll) : NaN, soloN: soloAll.length },
      C.totals, { strengths: C.strengths, tips: C.tips });
  }
  /* ---- results: habits, a playful style, and a card to share ---- */
  const APP_URL = 'https://lstehlik2809.github.io/manager-effect-lab/';
  // habit ratings and the playful style come from src/coach.js (habits, leaderStyle)
  const RATING = { strong: 'Strong', efficient: 'Efficient', some: 'Some', little: 'Little' };
  const goodRating = r => r === 'strong' || r === 'efficient';
  function shareText(N, style) {
    return `I just led a team of AI agents through ${N.team.length} hidden-profile puzzles: team score ${Math.round(N.teamScore)}/100, ${N.surfaced} of ${N.critical} hidden clues surfaced, leadership style "${style.name}". ` +
      `It's a playful test inspired by Weidmann, Xu & Deming's research on measuring leadership with AI agents. Try it: ${APP_URL}`;
  }
  async function drawCard(N, hb, style, name) {
    const W = 1200, H = 627, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    try { await Promise.all(['700 60px Archivo', '400 22px "Public Sans"', '600 22px "Public Sans"'].map(f => document.fonts.load(f))); } catch (e) { /* system fonts */ }
    const ink = '#14211f', ink2 = '#4c5a57', accent = '#2847c9', pos = '#00806a', rule = '#d2dbd8';
    const display = w => `${w} Archivo, "Arial Narrow", Arial, sans-serif`, body = w => `${w} "Public Sans", "Segoe UI", Arial, sans-serif`;
    g.fillStyle = '#eef2f1'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.fillRect(36, 36, W - 72, H - 72);
    g.fillStyle = accent; g.fillRect(36, 36, 12, H - 72);
    g.fillStyle = ink2; g.font = body('600 20px'); g.fillText('MANAGER EFFECT LAB  ·  LEADERSHIP TEST', 88, 96);
    const title = (name ? name + ' led' : 'I led') + ' a team of AI agents';
    let ts = 46;
    g.font = display(`700 ${ts}px`);
    while (g.measureText(title).width > W - 176 && ts > 20) { ts -= 2; g.font = display(`700 ${ts}px`); }
    g.fillStyle = ink; g.fillText(title, 88, 152);
    const score = String(Math.round(N.teamScore));
    g.fillStyle = accent; g.font = display('700 140px'); g.fillText(score, 84, 318);
    const sw = g.measureText(score).width;
    g.fillStyle = ink2; g.font = body('500 26px'); g.fillText('/ 100', 96 + sw, 278); g.fillText('team score', 96 + sw, 314);
    g.fillStyle = ink2; g.font = body('600 20px'); g.fillText('LEADERSHIP STYLE (FOR FUN)', 640, 222);
    g.fillStyle = ink; g.font = display('700 50px'); g.fillText(style.name, 640, 282);
    g.strokeStyle = rule; g.lineWidth = 2; g.beginPath(); g.moveTo(88, 350); g.lineTo(W - 88, 350); g.stroke();
    hb.forEach((x, k) => {
      const y = 394 + k * 48;
      g.fillStyle = ink; g.font = body('600 25px'); g.fillText(x.label, 88, y);
      g.fillStyle = ink2; g.font = body('400 23px'); g.fillText(x.value, 480, y);
      g.fillStyle = goodRating(x.rating) ? pos : ink2; g.font = body('700 23px'); g.textAlign = 'right'; g.fillText(RATING[x.rating], W - 88, y); g.textAlign = 'left';
    });
    g.fillStyle = ink2; g.font = body('400 18px'); g.fillText('A playful test inspired by Weidmann, Xu & Deming (2025). Not a validated assessment.', 88, 538);
    g.fillStyle = accent; g.font = body('600 20px'); g.fillText('Try it: ' + APP_URL.replace(/^https:\/\//, '').replace(/\/$/, ''), 88, 570);
    return c;
  }
  function saveCard(canvas, status) {
    canvas.toBlob(async blob => {
      if (!blob) { status.textContent = 'Could not create the image. Right-click the card to save it.'; return; }
      if (downloadsCap) {
        try { await downloadsCap.save({ filename: 'leadership-test-result.png', data: blob }); return; }
        catch (e) { if (e && e.code === 'declined') return; }
      }
      if (inClaude) { status.textContent = 'Saving files is not available here. Right-click the card to save it.'; return; }
      const url = URL.createObjectURL(blob), a = h('a', { href: url, download: 'leadership-test-result.png' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }
  async function copyText(text, status, okMsg) {
    try { await navigator.clipboard.writeText(text); status.textContent = okMsg; return true; }
    catch (e) { textModal('Text for your post', text); return false; }
  }

  function renderSummary() {
    const R = AI.results, root = AI.root(), N = summaryNumbers(R), name = (AI.settings.name || '').trim();
    const cell = (r, f) => h('td', { class: 'num' }, r.metrics && r.metrics[f] != null ? r.metrics[f] : '–');
    const rows = R.map(r => h('tr', {},
      h('td', {}, r.title + (r.solo ? ' (solo)' : '')), h('td', { class: 'num' }, Math.round(r.scores[0])), h('td', { class: 'num' }, Math.round(r.scores[1])),
      h('td', { class: 'num' }, r.metrics ? `${r.metrics.surfaced}/${r.metrics.critical}` : '–'), cell(r, 'questions'), cell(r, 'targeted'), cell(r, 'repeats'), cell(r, 'followUps'),
      cell(r, 'turns'), cell(r, 'words'),
      h('td', { class: 'num' }, Math.floor(r.seconds / 60) + ':' + String(r.seconds % 60).padStart(2, '0'))));
    const head = h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, 'Your result' + (name ? ' · ' + name : '')), h('h2', {}, 'How you led your AI team'));
    const again = h('button', { class: 'btn quiet', type: 'button', onclick: () => { AI.phase = 'intro'; AI.render(); } }, 'Take the test again');
    if (!N.team.length) { put(root, head, h('div', { class: 'panel' }, h('p', {}, 'Complete the team puzzles to see a result.'), again)); return; }
    const hb = COACH.habits(N), style = COACH.leaderStyle(hb, N);
    const pct = N.nq ? Math.round(100 * N.solved / N.nq) : 0;
    const range = rangeText(N);
    const toGroup = e => { e.preventDefault(); AI.phase = 'intro'; AI.render(); setTimeout(() => { const w = $('#ai-group-wrap'); if (w) { w.open = true; w.scrollIntoView({ behavior: 'smooth' }); } }, 30); };
    const shareStatus = h('span', { class: 'small muted', 'aria-live': 'polite' });
    const cardBox = h('div', { class: 'card-preview' }, h('span', { class: 'small muted' }, 'Drawing your result card…'));
    let canvas = null, nameTimer = null;
    const text = shareText(N, style);
    put(root, head,
      h('div', { class: 'panel flow' },
        h('div', { class: 'result-hero' },
          h('div', { class: 'stat lead' }, h('span', { class: 'label' }, 'Team-puzzle score'), h('span', { class: 'value big' }, Math.round(N.teamScore), h('span', { class: 'small muted' }, ' / 100')), h('span', { class: 'sub' }, `mean of ${N.nq} questions` + (range ? ' · ' + range : ''))),
          h('div', { class: 'style-box' }, h('span', { class: 'eyebrow' }, 'Your leadership style · for fun'), h('h3', {}, style.name), h('p', {}, style.text))),
        h('h3', {}, 'What you did, specifically'),
        obsLists(N.strengths, N.tips, 'What you did well', 'Try next time'),
        h('h3', {}, 'Where your points went'),
        pointsSplit({ actual: N.teamScore, use: N.use, hidden: N.hidden }),
        h('p', { class: 'small muted' }, 'Points lost to reports that stayed hidden reflect leading: drawing out what your teammates knew. Points lost in using the reports you had reflect reasoning. A report counts as drawn out only when a teammate cited its number, so the hidden part can be overstated if teammates paraphrased.'),
        h('h3', {}, 'The habits behind good leadership'),
        h('p', { class: 'small muted' }, 'In Study 2, these behaviours separated effective leaders from the rest. Ratings use rough thresholds set for these puzzles, not norms.'),
        h('div', { class: 'habits' }, hb.map(x => h('div', { class: 'habit' },
          h('div', {}, h('strong', {}, x.label), h('p', { class: 'small muted' }, x.note)),
          h('span', { class: 'mono' }, x.value),
          h('span', { class: 'pill ' + (goodRating(x.rating) ? 'pos' : '') }, h('span', { class: 'dot' }), RATING[x.rating])))),
        h('p', { class: 'small' }, `You wrote about ${fmt(N.words, 0)} words per puzzle. In the study, the amount of talking made no difference; asking and listening did.`),
        h('p', { class: 'verdict small' }, interpret(N))),
      h('div', { class: 'panel flow' },
        h('div', { class: 'panel-head' }, h('h3', {}, 'Share your result'), h('p', {}, 'Image sized for a LinkedIn post')),
        h('div', { class: 'field', style: { maxWidth: '320px' } }, h('label', { for: 'ai-name' }, 'Name on the card ', h('span', { class: 'hint' }, 'optional')),
          h('input', { id: 'ai-name', type: 'text', value: AI.settings.name, autocomplete: 'given-name', oninput: e => { AI.settings.name = e.target.value; saveSettings(); clearTimeout(nameTimer); nameTimer = setTimeout(redraw, 350); } })),
        cardBox,
        h('div', { class: 'btn-row' },
          // a real link: scripted pop-ups are blocked for most viewers of the claude.ai version
          h('a', { class: 'btn primary', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(APP_URL), target: '_blank', rel: 'noopener', onclick: () => { copyText(text, shareStatus, 'Text copied. Paste it into your post.'); } }, 'Share on LinkedIn'),
          h('button', { class: 'btn', type: 'button', onclick: () => { if (canvas) saveCard(canvas, shareStatus); } }, 'Download result card'),
          h('button', { class: 'btn quiet', type: 'button', onclick: () => copyText(text, shareStatus, 'Text copied.') }, 'Copy text'),
          shareStatus),
        h('p', { class: 'small muted' }, '"Share on LinkedIn" copies a short text for your post and opens LinkedIn with a link to this test. Attach the result card if you like. Nothing is shared until you post it.')),
      h('div', { class: 'panel' }, h('h3', {}, 'Puzzle by puzzle'),
        h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Puzzle', 'Q1', 'Q2', 'Clues surfaced', 'Questions', 'Specific', 'Repeated', 'Follow-ups', 'Turns', 'Words', 'Time'].map((t, i) => h('th', { class: i ? 'num' : '' }, t)))), h('tbody', {}, rows))),
        h('p', { class: 'small muted' }, `Questions solved (score of 95 or more): ${N.solved} of ${N.nq} (${pct}%). Solo warm-up score: ${isFinite(N.soloScore) ? Math.round(N.soloScore) + ' (mean of ' + N.soloN + ' questions)' : 'skipped'}. "We" language: ${fmt(N.weRate, 1)} per 100 words.`)),
      h('details', { class: 'panel prose' }, h('summary', { class: 'group-summary' }, h('strong', {}, 'How to read this')),
        h('ul', {},
          h('li', {}, `Your team-puzzle score is raw. It mixes how well you led with how well you reason on your own, and ${sampleText(N)} is a small sample. Study 2 measured leadership as team results after controlling for hard skills (three solo puzzles, fluid IQ and typing speed), standardised across its 249 leaders. One person's score can do neither.`),
          h('li', {}, 'The leadership style is a playful summary of the three habits above, not a validated type.'),
          h('li', {}, 'The feedback reads your chat with simple rules. A question counts as specific when it names an option, a report number or a detail from the reports; a follow-up picks up something a teammate said; a repeat asks the same people the same thing again. Unusual phrasing can be misread.'),
          h('li', {}, 'To compare people properly, collect the results files of a group who took the same version with the same teammates and load them under ', h('a', { href: '#ai-test', onclick: toGroup }, 'compare a group of test takers'), ' on the start screen.'),
          h('li', {}, 'In Study 2, leaders 1 SD above average gave optimal answers to 53% of questions and leaders 1 SD below average to 10%, averaged over its AI and human versions. Those figures belong to the study\'s own puzzles, GPT-4o teammates and sample. They are not benchmarks for this version.'),
          h('li', {}, '"Clues surfaced" counts a decisive clue only when a teammate cites its report number, so it undercounts if teammates paraphrase.'),
          h('li', {}, 'Scores from scripted, Gemini and Claude teammates are not comparable with each other. The scripted teammates are a simplified stand-in for the study\'s LLM followers.'))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => exportAI('csv') }, 'Download results (CSV)'),
        h('button', { class: 'btn', type: 'button', onclick: () => exportAI('json') }, 'Download with transcripts (JSON)'),
        again));
    function redraw() {
      drawCard(N, hb, style, (AI.settings.name || '').trim()).then(c => {
        canvas = c;
        put(cardBox, h('img', { src: c.toDataURL('image/png'), alt: `Result card: team score ${Math.round(N.teamScore)} out of 100, leadership style ${style.name}, ${hb.map(x => x.label + ' ' + RATING[x.rating].toLowerCase()).join(', ')}.` }));
      }).catch(() => put(cardBox, h('span', { class: 'small muted' }, 'The result card could not be drawn in this browser.')));
    }
    redraw();
  }
  const rangeText = N => (isFinite(N.teamLo) && Math.round(N.teamHi) > Math.round(N.teamLo) ? `rough 95% range ${Math.round(N.teamLo)}–${Math.round(N.teamHi)}` : '');
  const sampleText = N => (['no', 'one', 'two', 'three', 'four'][N.team.length] || N.team.length) + ' team puzzle' + (N.team.length === 1 ? '' : 's');
  function interpret(N) {
    if (!N.team.length) return 'Complete the team puzzles to see a result.';
    return `Your score describes this game only: it mixes how well you led with how well you reason on your own, and ${sampleText(N)} is a small sample` +
      (rangeText(N) ? ` (${rangeText(N)})` : '') +
      '. There are no norms for this version, so it cannot say how you compare with the leaders in Study 2 or with other people.' +
      (N.soloN ? '' : ' Without a warm-up this result cannot be adjusted for reasoning skill in a group comparison; the Standard length includes one.');
  }
  function exportAI(kind) {
    const R = AI.results, N = summaryNumbers(R), name = AI.settings.name || '';
    const uniq = xs => [...new Set(xs.filter(Boolean))].join('+');
    const engine = uniq(R.map(r => r.engine)), model = uniq(R.map(r => r.model)), version = R[0] && R[0].version || 1;
    if (kind === 'json') { offerFile('ai_leadership_test.json', JSON.stringify({ name, finished: new Date().toISOString(), test_version: version, summary: N.team.length ? { team_score: N.teamScore, team_score_range: [N.teamLo, N.teamHi], solved: N.solved, questions: N.nq, solo_score: N.soloScore, solo_questions: N.soloN, points_lost_hidden: N.hidden, points_lost_use: N.use } : null, puzzles: R }, null, 2), 'application/json'); return; }
    const row = { name, finished: new Date().toISOString(), test_version: version, engine, model, team_score: fmt(N.teamScore, 2), team_score_low: fmt(N.teamLo, 2), team_score_high: fmt(N.teamHi, 2), questions_solved: N.solved, questions: N.nq, solo_score: fmt(N.soloScore, 2), solo_questions: N.soloN, info_surfaced: N.surfaced, info_total: N.critical, questions_per_puzzle: fmt(N.questions, 2), specific_questions_per_puzzle: fmt(N.targeted, 2), repeated_questions_per_puzzle: fmt(N.repeats, 2), followups_per_puzzle: fmt(N.followUps, 2), turns_per_puzzle: fmt(N.turns, 2), words_per_puzzle: fmt(N.words, 1), we_per_100_words: fmt(N.weRate, 2), points_lost_hidden: fmt(N.hidden, 2), points_lost_use: fmt(N.use, 2) };
    R.forEach(r => { row[r.id + '_q1'] = fmt(r.scores[0], 1); row[r.id + '_q2'] = fmt(r.scores[1], 1); });
    offerFile('ai_leadership_test.csv', toCSV(Object.keys(row), [row]).replace(/−/g, '-'), 'text/csv');
  }

  /* ================= boot ================= */
  renderIllustration();
  initDesign();
  initAnalyze();
  showTab(location.hash.slice(1));
})();
