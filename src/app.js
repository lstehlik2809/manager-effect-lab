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
  const TABS = ['method', 'design', 'analyze', 'ai-test'];
  function showTab(name) {
    if (!TABS.includes(name)) name = 'method';
    $$('[data-view]').forEach(v => { v.hidden = v.dataset.view !== name; });
    $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.tab === name ? 'page' : 'false'));
    if (name === 'analyze') ensureAnalysis();
    if (name === 'ai-test') AI.render();
    if (name === 'design') renderReliability();
  }
  window.addEventListener('hashchange', () => { showTab(location.hash.slice(1)); window.scrollTo(0, 0); });

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
  const FOL = PZ.FOLLOWERS;
  const folName = id => (FOL.find(f => f.id === id) || { name: 'You' }).name;

  const AI = {
    sample: null, sampleState: inClaude ? 'checking' : 'absent',
    settings: Object.assign({ engine: inClaude ? 'claude' : 'gemini', model: 'claude-opus-5-5', minutes: 6, solo: true, name: '', remember: false, apiKey: '', geminiKey: '' }, store.get('ai.settings', {})),
    phase: 'intro', order: [], idx: 0, results: [], cur: null, notice: '',
    root: () => $('#ai-root')
  };
  if (!AI.settings.remember) { AI.settings.apiKey = ''; AI.settings.geminiKey = ''; }
  if (!inClaude && AI.settings.engine === 'claude') AI.settings.engine = 'gemini';
  if (inClaude && (AI.settings.engine === 'api' || AI.settings.engine === 'gemini')) AI.settings.engine = 'claude';
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

  function renderIntro() {
    const st = AI.settings, root = AI.root();
    const last = store.get('ai.last', null);
    const claudeDesc = AI.sampleState === 'ready' ? 'Teammates run on your Claude account. You will be asked to allow it once.' : AI.sampleState === 'checking' ? 'Checking whether this page can use Claude…' : 'Not available in this view.';
    const engines = h('div', { class: 'engine-cards' },
      inClaude ? engineCard('claude', 'Claude (in claude.ai)', claudeDesc, AI.sampleState !== 'ready') : [
        engineCard('gemini', 'Gemini 3.8 Flash', "Teammates run on Google's Gemini API with your own key. Fast and low-cost."),
        engineCard('api', 'Claude', 'Teammates run on the Anthropic API with your own key.')],
      engineCard('scripted', 'Scripted teammates', 'Offline, keyword-matching teammates. Good for a dry run; less like real people.'));
    let apiBox = '';
    if (!inClaude && st.engine === 'gemini') {
      const keyStatus = h('p', { class: 'small muted', id: 'key-status' });
      apiBox = h('div', { class: 'flow' },
        h('div', { class: 'row' },
          h('div', { class: 'field', style: { flex: '2 1 280px' } }, h('label', { for: 'gemini-key' }, 'Gemini API key ', h('span', { class: 'hint' }, 'from Google AI Studio')),
            h('input', { id: 'gemini-key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'AIza…', value: st.geminiKey, oninput: e => { st.geminiKey = e.target.value.trim(); saveSettings(); } })),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => checkKey(keyStatus) }, 'Check key'))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.remember, onchange: e => { st.remember = e.target.checked; saveSettings(); } }), 'Remember the key in this browser'),
        keyStatus,
        h('p', { class: 'note small' }, 'The key stays in your browser and is sent only to generativelanguage.googleapis.com. Use a key with a budget or quota you are comfortable with. A full test makes roughly 100–250 short requests of about 1,000 tokens each. Teammates think at the low level to keep the chat quick.'));
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
    put(root, 
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, 'Step 3 · Study 2'), h('h2', {}, 'Lead a team of AI agents'),
        h('p', {}, 'In Study 2, how well people led teams of LLM agents predicted how much they improved real human teams (ρ = 0.81). This version recreates the test: you lead three AI teammates, Mira, Theo and Jonas, through hidden-profile puzzles. Each of you holds different reports. Nobody can solve a puzzle alone, so your job is to draw out the right information, keep the team on track, and decide.')),
      h('div', { class: 'grid-2' },
        h('div', { class: 'panel prose' }, h('h3', {}, 'How it works'),
          h('ol', {},
            h('li', {}, h('strong', {}, 'Warm-up (solo). '), 'One puzzle where you see every report. It measures how well you reason from clues on your own, the "hard skill" the study controls for.'),
            h('li', {}, h('strong', {}, 'Four team puzzles. '), 'You see 8 reports; each teammate holds 8 more, half of them shared. Message everyone or one person. Teammates only talk to you.'),
            h('li', {}, h('strong', {}, 'Answer with probabilities. '), 'Each puzzle has two questions with five options. Reports either rule options out or are irrelevant; the options left standing are equally likely. Spread 100 points across the options accordingly.')),
          h('p', { class: 'small muted' }, 'Scores run from 0 to 100 (100 = exactly the right distribution; an even split scores 20–60). The app also records the behaviours Study 2 linked to good leadership: questions asked, conversational turn-taking, and how much of the hidden information you surfaced.')),
        h('div', { class: 'panel flow' }, h('h3', {}, 'Set up'),
          h('div', { class: 'field' }, h('label', {}, 'Teammates'), engines),
          apiBox,
          h('div', { class: 'row' },
            h('div', { class: 'field' }, h('label', { for: 'ai-min' }, 'Time per team puzzle'), timeSel),
            h('div', { class: 'field' }, h('label', { for: 'ai-name' }, 'Name or ID ', h('span', { class: 'hint' }, 'optional, for the results file')), h('input', { id: 'ai-name', type: 'text', value: st.name, oninput: e => { st.name = e.target.value; saveSettings(); } }))),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.solo, onchange: e => { st.solo = e.target.checked; saveSettings(); } }), 'Start with the solo warm-up'),
          AI.notice ? h('p', { class: 'note warn' }, AI.notice) : '',
          h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', onclick: startTest }, 'Start the test'),
            last ? h('button', { class: 'btn', type: 'button', onclick: () => { AI.results = last.results; AI.settings.name = last.name || AI.settings.name; AI.phase = 'summary'; AI.render(); } }, 'See your last result') : '')))
    );
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

  function startTest() {
    const st = AI.settings;
    AI.notice = '';
    if (st.engine === 'gemini' && !st.geminiKey) { AI.notice = 'Enter your Gemini API key, or choose scripted teammates.'; renderIntro(); return; }
    if (st.engine === 'api' && !st.apiKey) { AI.notice = 'Enter your Anthropic API key, or choose scripted teammates.'; renderIntro(); return; }
    if (st.engine === 'claude' && AI.sampleState !== 'ready') { AI.notice = 'Claude is not available in this view. Choose scripted teammates.'; renderIntro(); return; }
    AI.order = (st.solo ? ['solo'] : []).concat(['t1', 't2', 't3', 't4']);
    AI.idx = 0; AI.results = [];
    startPuzzle();
  }

  function startPuzzle() {
    const p = PZ.PUZZLES.find(x => x.id === AI.order[AI.idx]);
    const mins = p.solo ? (AI.settings.minutes ? 4 : 0) : AI.settings.minutes;
    AI.cur = {
      puzzle: p, startedAt: Date.now(), deadline: mins ? Date.now() + mins * 60000 : null, locked: false,
      messages: [], to: 'all', draft: '', confirm: false, timer: null,
      answers: p.questions.map(() => [20, 20, 20, 20, 20]), out: p.questions.map(() => [false, false, false, false, false]),
      followers: Object.fromEntries(FOL.map(f => [f.id, { busy: false, queued: false, ctl: null, shared: new Set(), bubble: null }])),
      engine: AI.settings.engine
    };
    AI.phase = 'puzzle';
    AI.render();
    window.scrollTo(0, 0);
    tick();
  }

  function elapsed() { return Math.round((Date.now() - AI.cur.startedAt) / 1000); }
  function tick() {
    const c = AI.cur; if (!c || AI.phase !== 'puzzle') return;
    clearTimeout(c.timer);
    const el = $('#ai-timer');
    if (c.deadline) {
      const left = Math.max(0, c.deadline - Date.now());
      if (el) { el.textContent = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'); el.classList.toggle('low', left < 60000); }
      if (left <= 0 && !c.locked) { lockChat('Time is up. Submit your answers.'); return; }
    } else if (el) { const e = elapsed(); el.textContent = Math.floor(e / 60) + ':' + String(e % 60).padStart(2, '0'); }
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
        h('button', { class: 'btn quiet', type: 'button', onclick: () => { lockChat(); AI.phase = 'intro'; AI.render(); } }, 'Quit test')));
    let middle = '';
    if (!p.solo) middle = renderChat();
    put(root, top, h('div', { class: 'ai-grid' + (p.solo ? ' solo' : '') }, brief, middle, answers));
    renderAnswers();
    if (!p.solo) {
      const msgs = $('#msgs');
      c.messages.forEach(m => msgs.append(msgEl(m)));
      if (!c.messages.length) addSys(c.engine === 'scripted' ? 'Scripted teammates answer by matching keywords in your messages. Ask about topics, options or reports.' : 'Your teammates are online. Say hello, then start gathering information.');
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
    if (e === 'gemini') return 'Teammates: Gemini 3.8 Flash';
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
    const m = { from: 'leader', to: c.to, text, t: elapsed() };
    c.messages.push(m);
    $('#msgs').append(msgEl(m)); scrollChat();
    (c.to === 'all' ? FOL.map(f => f.id) : [c.to]).forEach(requestReply);
  }

  function requestReply(fid) {
    const c = AI.cur, st = c.followers[fid];
    if (c.locked) return;
    if (st.busy) { st.queued = true; return; }
    st.busy = true;
    const bubbleText = h('span', {}, 'typing…');
    const bubble = h('div', { class: 'bubble typing' }, h('span', { class: 'who' }, folName(fid)), bubbleText);
    const row = h('div', { class: 'msg' }, h('span', { class: 'avatar ' + fid }, folName(fid)[0]), bubble);
    $('#msgs').append(row); scrollChat();
    const ctl = new AbortController(); st.ctl = ctl;
    const puzzleAt = c;
    engineReply(fid, ctl.signal, text => { if (text && !/^PASS/i.test(text)) { bubble.classList.remove('typing'); bubbleText.textContent = text; scrollChat(); } })
      .then(text => {
        if (AI.cur !== puzzleAt) return;
        text = cleanReply(text, fid);
        if (!text) { row.remove(); return; }
        bubble.classList.remove('typing'); bubbleText.textContent = text;
        c.messages.push({ from: fid, to: 'leader', text, t: elapsed() });
        scrollChat();
      })
      .catch(async err => {
        if (AI.cur !== puzzleAt) return;
        if (err && err.code === 'cancelled') { row.remove(); return; }
        bubble.classList.remove('typing'); bubble.classList.add('err');
        bubbleText.textContent = await engineErrorText(err);
        if (err && err.fatal && !c.fatalShown) {
          c.fatalShown = true;
          const msgs = $('#msgs');
          if (msgs) { msgs.append(h('div', { class: 'sys' }, 'The teammates cannot reply. ', h('button', { class: 'btn quiet', type: 'button', onclick: e => { c.engine = 'scripted'; AI.settings.engine = 'scripted'; saveSettings(); e.currentTarget.parentElement.replaceWith(h('div', { class: 'sys' }, 'Switched to scripted teammates. Send your message again.')); } }, 'Switch to scripted teammates'))); scrollChat(); }
        }
      })
      .finally(() => {
        st.busy = false; st.ctl = null;
        if (st.queued && !c.locked && AI.cur === puzzleAt) { st.queued = false; requestReply(fid); }
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
  async function engineErrorText(e) {
    if (AI.cur && AI.cur.engine === 'gemini') return geminiErrorText(e);
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

  const STOP = new Set('that this with from have what about your there their they them were been does which would could should into some just than then also more other only very when where know tell think share please team everyone anything something reports report question options option ruled rule help need does help'.split(' '));
  const stem = w => w.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  const toks = t => (String(t).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 3 && !STOP.has(w)).map(stem);
  function scriptedReply(fid, signal) {
    const c = AI.cur, p = c.puzzle, st = c.followers[fid];
    let lastOwn = -1;
    c.messages.forEach((m, i) => { if (m.from === fid) lastOwn = i; });
    const incoming = c.messages.slice(lastOwn + 1).filter(m => m.from === 'leader' && (m.to === 'all' || m.to === fid));
    const text = incoming.map(m => m.text).join(' ').toLowerCase();
    const latest = incoming[incoming.length - 1];
    if (latest && latest.to === 'all') {
      const named = FOL.filter(f => new RegExp('\b' + f.name + '\b', 'i').test(latest.text)).map(f => f.id);
      if (named.length && !named.includes(fid)) return new Promise(resolve => setTimeout(() => resolve(''), 300));
    }
    const mine = PZ.cluesFor(p, fid).sort((a, b) => (a.holder === 'public') - (b.holder === 'public'));
    const unshared = mine.filter(cl => !st.shared.has(cl.num));
    const asked = new Set(toks(text));
    const qMention = /(question|q)\s*(1|one)\b|first question/.test(text) ? 0 : /(question|q)\s*(2|two)\b|second question/.test(text) ? 1 : null;
    const scored = unshared.map(cl => {
      let sc = 0; toks(cl.text).forEach(t => { if (asked.has(t)) sc += 1; });
      if (qMention !== null && cl.q === qMention) sc += 1.5;
      if (new RegExp('#\\s?' + cl.num + '\\b').test(text)) sc += 5;
      return { cl, sc };
    });
    const wantsAll = /\b(all|every|everything|anything|what do you (have|know|got)|your (reports?|clues?|info)|share|send|list)\b/.test(text);
    let pick = scored.filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).map(x => x.cl);
    if (!pick.length && (wantsAll || qMention !== null)) pick = unshared.filter(cl => qMention === null || cl.q === qMention);
    const out = pick.slice(0, 2);
    out.forEach(cl => st.shared.add(cl.num));
    let reply;
    if (out.length) {
      reply = out.map(cl => `Report #${cl.num}: ${cl.text}`).join(' ');
      if (pick.length > 2) reply += ' I have more on this if you want it.';
    } else if (/^\s*(hi|hello|hey|good (morning|afternoon))\b/.test(text)) reply = 'Hi! Ready when you are.';
    else if (!unshared.length) reply = 'I have shared everything I have.';
    else reply = 'I don\'t have anything on that. Ask me about a specific question or option.';
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve(reply), 600 + Math.random() * 900);
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
            oninput: e => { c.answers[qi][k] = Math.max(0, Math.min(100, +e.target.value || 0)); updateSums(); } }),
          h('button', { class: 'x', type: 'button', 'aria-pressed': c.out[qi][k] ? 'true' : 'false', 'aria-label': `Rule out ${o}`, title: 'Rule out',
            onclick: () => { c.out[qi][k] = !c.out[qi][k]; evenSplit(qi); renderAnswers(); } }, '✕'))),
        h('div', { class: 'sum', id: `sum-${qi}` }, h('span', {}, `Total ${sum}%`), h('button', { class: 'btn quiet', type: 'button', onclick: () => { evenSplit(qi); renderAnswers(); } }, 'Even split')));
    });
    put(box, 
      h('div', { class: 'panel-head' }, h('h3', {}, 'Your answer'), h('span', { class: 'small muted' }, 'Rule options out with ✕')),
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
    });
  }
  function submitAnswers() {
    const c = AI.cur, msg = $('#ans-msg');
    const bad = c.answers.findIndex(a => Math.abs(a.reduce((x, y) => x + (+y || 0), 0) - 100) > 0.5);
    if (bad >= 0) { msg.textContent = `Question ${bad + 1} adds up to ${c.answers[bad].reduce((x, y) => x + (+y || 0), 0)}%. Make it 100%, or use Even split.`; return; }
    if (!c.confirm && !c.locked && !c.puzzle.solo) { c.confirm = true; $('#submit-btn').textContent = 'Confirm and finish'; msg.textContent = 'Submitting ends the chat for this puzzle.'; setTimeout(() => { if (AI.cur === c && c.confirm) { c.confirm = false; const b = $('#submit-btn'); if (b) b.textContent = 'Submit answers'; } }, 5000); return; }
    lockChat();
    clearTimeout(c.timer);
    const p = c.puzzle;
    const scores = p.questions.map((q, qi) => S.credenceScore(c.answers[qi], S.correctDist(q.answer, 5)));
    const flat = p.questions.map(q => S.credenceScore([20, 20, 20, 20, 20], S.correctDist(q.answer, 5)));
    AI.results.push({ id: p.id, title: p.title, solo: !!p.solo, scores, flat, answers: c.answers.map(a => a.slice()), seconds: elapsed(), metrics: p.solo ? null : processMetrics(c), transcript: c.messages.slice(), engine: c.engine, model: c.engine === 'api' ? AI.settings.model : c.engine === 'gemini' ? LLM.GEMINI_MODEL : null });
    AI.phase = 'feedback';
    AI.render();
    window.scrollTo(0, 0);
  }

  function processMetrics(c) {
    const L = c.messages.filter(m => m.from === 'leader');
    const leaderText = L.map(m => m.text).join(' ');
    const words = (leaderText.match(/\S+/g) || []).length;
    const questions = L.reduce((n, m) => n + (m.text.match(/\?+/g) || []).length, 0);
    let turns = 0;
    for (let i = 1; i < c.messages.length; i++) if ((c.messages[i].from === 'leader') !== (c.messages[i - 1].from === 'leader')) turns++;
    const we = (leaderText.match(/\b(we|us|our|ours|ourselves|let's|lets)\b/gi) || []).length;
    const critical = PZ.criticalFollowerClues(c.puzzle);
    const surfacedNums = new Set();
    c.messages.filter(m => m.from !== 'leader').forEach(m => {
      const re = /(?:#\s?|report\s+(?:no\.?\s*)?#?\s?)(\d{1,2})\b/gi; let mm;
      while ((mm = re.exec(m.text))) { const n = +mm[1]; const cl = critical.find(x => x.num === n && x.holder === m.from); if (cl) surfacedNums.add(n); }
    });
    return { leaderMessages: L.length, words, questions, turns, weRate: words ? 100 * we / words : 0, engaged: new Set(c.messages.filter(m => m.from !== 'leader').map(m => m.from)).size, surfaced: surfacedNums.size, critical: critical.length, broadcast: L.filter(m => m.to === 'all').length };
  }

  /* ---- feedback ---- */
  function renderFeedback() {
    const r = AI.results[AI.results.length - 1], p = PZ.PUZZLES.find(x => x.id === r.id), root = AI.root();
    const L = 'ABCDE';
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
        h('p', { class: 'small muted' }, `An even split would have scored ${Math.round(r.flat[qi])}.`));
    });
    const m = r.metrics;
    const last = AI.idx >= AI.order.length - 1;
    put(root, 
      h('div', { class: 'ai-top' }, h('div', {}, h('div', { class: 'eyebrow' }, `Puzzle ${AI.idx + 1} of ${AI.order.length} · result`), h('h2', {}, p.title)),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { if (last) { finishTest(); } else { AI.idx++; startPuzzle(); } } }, last ? 'See your results' : 'Next puzzle')),
      h('div', { class: 'grid-2' }, qCards),
      m ? h('div', { class: 'panel' },
        h('h3', {}, 'How you led'),
        h('div', { class: 'stats' },
          h('div', { class: 'stat lead' }, h('span', { class: 'label' }, 'Hidden information surfaced'), h('span', { class: 'value' }, `${m.surfaced} of ${m.critical}`), h('span', { class: 'sub' }, 'decisive reports your teammates passed on')),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Questions asked'), h('span', { class: 'value' }, m.questions), h('span', { class: 'sub' }, `${m.leaderMessages} messages, ${m.words} words`)),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Conversational turns'), h('span', { class: 'value' }, m.turns), h('span', { class: 'sub' }, `${m.engaged} of 3 teammates replied`)),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, '"We" language'), h('span', { class: 'value' }, fmt(m.weRate, 1)), h('span', { class: 'sub' }, 'per 100 words')),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Time used'), h('span', { class: 'value' }, Math.floor(r.seconds / 60) + ':' + String(r.seconds % 60).padStart(2, '0')), h('span', { class: 'sub' }, 'minutes:seconds'))),
        h('p', { class: 'small muted' }, 'In Study 2, leaders who asked more questions and had more back-and-forth did better with both AI and human teams; the sheer number of words did not matter.')) : ''
    );
  }

  function finishTest() {
    AI.phase = 'summary';
    store.set('ai.last', { results: AI.results, name: AI.settings.name, when: new Date().toISOString() });
    AI.render();
    window.scrollTo(0, 0);
  }

  function summaryNumbers(results) {
    const team = results.filter(r => !r.solo), solo = results.find(r => r.solo);
    const all = team.flatMap(r => r.scores);
    const solved = all.filter(x => x >= 95).length;
    const avg = k => team.length ? S.mean(team.map(r => r.metrics[k])) : NaN;
    return { team, solo, teamScore: all.length ? S.mean(all) : NaN, solved, nq: all.length, soloScore: solo ? S.mean(solo.scores) : NaN,
      surfaced: team.reduce((n, r) => n + r.metrics.surfaced, 0), critical: team.reduce((n, r) => n + r.metrics.critical, 0),
      questions: avg('questions'), turns: avg('turns'), words: avg('words'), weRate: avg('weRate') };
  }
  function renderSummary() {
    const R = AI.results, root = AI.root(), N = summaryNumbers(R);
    const rows = R.map(r => h('tr', {},
      h('td', {}, r.title + (r.solo ? ' (solo)' : '')), h('td', { class: 'num' }, Math.round(r.scores[0])), h('td', { class: 'num' }, Math.round(r.scores[1])),
      h('td', { class: 'num' }, r.metrics ? `${r.metrics.surfaced}/${r.metrics.critical}` : '–'), h('td', { class: 'num' }, r.metrics ? r.metrics.questions : '–'),
      h('td', { class: 'num' }, r.metrics ? r.metrics.turns : '–'), h('td', { class: 'num' }, r.metrics ? r.metrics.words : '–'),
      h('td', { class: 'num' }, Math.floor(r.seconds / 60) + ':' + String(r.seconds % 60).padStart(2, '0'))));
    const pct = N.nq ? Math.round(100 * N.solved / N.nq) : 0;
    put(root, 
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, 'AI leadership test · results' + (AI.settings.name ? ' · ' + AI.settings.name : '')), h('h2', {}, 'How you led your AI team')),
      h('div', { class: 'panel' },
        h('div', { class: 'stats' },
          h('div', { class: 'stat lead' }, h('span', { class: 'label' }, 'Team-puzzle score'), h('span', { class: 'value' }, isFinite(N.teamScore) ? Math.round(N.teamScore) : '–'), h('span', { class: 'sub' }, `mean of ${N.nq} questions, 0–100`)),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Questions fully solved'), h('span', { class: 'value' }, `${N.solved} of ${N.nq}`), h('span', { class: 'sub' }, `${pct}% · score of 95 or more`)),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Solo warm-up score'), h('span', { class: 'value' }, isFinite(N.soloScore) ? Math.round(N.soloScore) : '–'), h('span', { class: 'sub' }, 'reasoning with every report in hand')),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Hidden information surfaced'), h('span', { class: 'value' }, `${N.surfaced} of ${N.critical}`), h('span', { class: 'sub' }, 'decisive reports held by teammates')),
          h('div', { class: 'stat' }, h('span', { class: 'label' }, 'Questions asked per puzzle'), h('span', { class: 'value' }, fmt(N.questions, 1)), h('span', { class: 'sub' }, `${fmt(N.turns, 1)} turns · ${fmt(N.words, 0)} words`))),
        h('p', { class: 'verdict' }, interpret(N, pct))),
      h('div', { class: 'panel' }, h('h3', {}, 'Puzzle by puzzle'),
        h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Puzzle', 'Q1', 'Q2', 'Info surfaced', 'Questions', 'Turns', 'Words', 'Time'].map((t, i) => h('th', { class: i ? 'num' : '' }, t)))), h('tbody', {}, rows)))),
      h('div', { class: 'panel prose' }, h('h3', {}, 'How to read this'),
        h('ul', {},
          h('li', {}, 'In Study 2, a leader one standard deviation above average fully solved 53% of questions; one standard deviation below, 10%. Bad leaders\' answers looked like uninformed guesses: they learned little from their team.'),
          h('li', {}, 'The study standardised scores within its sample of 249 leaders and controlled for hard skills (the solo puzzle, fluid IQ and typing speed). A single person\'s score cannot be standardised. To compare people, have a group take the test and load the CSV results into a spreadsheet or the analysis tab of your choice.'),
          h('li', {}, 'If your solo score is high but your team score is lower, the gap is information gathering: ask each teammate directly, follow up on reports they mention, and check which options are still standing before deciding.'),
          h('li', {}, 'The scripted teammates are a simplified stand-in. The study used LLM followers prompted like the human participants, and this version\'s puzzles and scoring are an independent reconstruction, not the study\'s materials.'))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => exportAI('csv') }, 'Download results (CSV)'),
        h('button', { class: 'btn', type: 'button', onclick: () => exportAI('json') }, 'Download with transcripts (JSON)'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => { AI.phase = 'intro'; AI.render(); } }, 'Take the test again')));
  }
  function interpret(N, pct) {
    if (!N.team.length) return 'Complete the team puzzles to see a result.';
    const parts = [];
    parts.push(pct >= 50 ? `You fully solved ${pct}% of team questions, in line with the strong leaders in Study 2.` : pct >= 25 ? `You fully solved ${pct}% of team questions, between the study's weak (10%) and strong (53%) leaders.` : `You fully solved ${pct}% of team questions, close to the study's weaker leaders.`);
    if (N.critical) parts.push(` Your teammates passed on ${N.surfaced} of the ${N.critical} decisive reports they held.`);
    if (isFinite(N.soloScore) && isFinite(N.teamScore)) parts.push(N.soloScore - N.teamScore > 15 ? ' Your solo score is well above your team score, so drawing information out of the team is where most of the points went.' : ' Your team score keeps up with your solo reasoning, which means the team was not the bottleneck.');
    return parts.join('');
  }
  function exportAI(kind) {
    const R = AI.results, N = summaryNumbers(R), name = AI.settings.name || '';
    if (kind === 'json') { offerFile('ai_leadership_test.json', JSON.stringify({ name, finished: new Date().toISOString(), summary: N.team.length ? { team_score: N.teamScore, solved: N.solved, questions: N.nq, solo_score: N.soloScore } : null, puzzles: R }, null, 2), 'application/json'); return; }
    const row = { name, finished: new Date().toISOString(), engine: R[0] ? R[0].engine : '', model: R[0] && R[0].model || '', team_score: fmt(N.teamScore, 2), questions_solved: N.solved, questions: N.nq, solo_score: fmt(N.soloScore, 2), info_surfaced: N.surfaced, info_total: N.critical, questions_per_puzzle: fmt(N.questions, 2), turns_per_puzzle: fmt(N.turns, 2), words_per_puzzle: fmt(N.words, 1), we_per_100_words: fmt(N.weRate, 2) };
    R.forEach(r => { row[r.id + '_q1'] = fmt(r.scores[0], 1); row[r.id + '_q2'] = fmt(r.scores[1], 1); });
    offerFile('ai_leadership_test.csv', toCSV(Object.keys(row), [row]).replace(/−/g, '-'), 'text/csv');
  }

  /* ================= boot ================= */
  renderIllustration();
  initDesign();
  initAnalyze();
  showTab(location.hash.slice(1));
})();
