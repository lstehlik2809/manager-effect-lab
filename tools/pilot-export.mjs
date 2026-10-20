// Reads the pilot data from the hosted worker: how many tests were started and finished, and the
// results players chose to send. Writes the results as a CSV that "Compare a group" in the app loads
// (it shows the pilot overview: completion, ratings, score spread and styles).
// Usage: node --env-file=path/to/.env tools/pilot-export.mjs [worker URL] [output.csv]
//   needs PILOT_TOKEN in the environment (the worker's secret); the local dev server uses "dev".
// The token is read from the environment and never printed.
import fs from 'node:fs';

const base = (process.argv[2] || 'https://manager-effect-lab-teammates.ludek-stehlik.workers.dev').replace(/\/+$/, '').replace(/\/reply$/, '');
const out = process.argv[3] || 'pilot_results.csv';
const token = process.env.PILOT_TOKEN || (/127\.0\.0\.1|localhost/.test(base) ? 'dev' : '');
if (!token) { console.error('Set PILOT_TOKEN (the worker secret) in the environment.'); process.exit(1); }

const res = await fetch(base + '/pilot', { headers: { authorization: 'Bearer ' + token } });
if (!res.ok) { console.error(`The worker answered ${res.status}. Check the URL and PILOT_TOKEN.`); process.exit(1); }
const { counts, results } = await res.json();

// completion: tests started and finished per length (all days, all engines)
const sum = f => counts.filter(f).reduce((a, c) => a + c.n, 0);
console.log('Tests started and finished (anonymous counts)');
for (const len of ['quick', 'standard', 'extended']) {
  const started = sum(c => c.kind === 'start' && c.what === len), finished = sum(c => c.kind === 'finish' && c.what === len);
  if (!started && !finished) continue;
  console.log(`  ${len.padEnd(9)} started ${String(started).padStart(5)}, finished ${String(finished).padStart(5)}` + (started ? ` (${Math.round(100 * finished / started)}%)` : ''));
}
const puzzles = [...new Set(counts.filter(c => c.kind === 'puzzle').map(c => c.what))].sort();
if (puzzles.length) console.log('  team puzzles submitted: ' + puzzles.map(id => `${id} ${sum(c => c.kind === 'puzzle' && c.what === id)}`).join(', '));
const days = [...new Set(counts.map(c => c.day))].sort();
if (days.length) console.log(`  from ${days[0]} to ${days[days.length - 1]}`);

// sent results as one CSV, one row per person (named by the day they arrived and a number)
const rows = results.map((r, i) => Object.assign({ name: `pilot-${r.day}-${String(i + 1).padStart(3, '0')}`, sent: r.day }, r.row));
const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
const cell = v => { const t = v == null ? '' : String(v); return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
fs.writeFileSync(out, [cols.join(',')].concat(rows.map(r => cols.map(k => cell(r[k])).join(','))).join('\n') + '\n');
console.log(`\n${rows.length} result${rows.length === 1 ? '' : 's'} sent by players, written to ${out}. Load it under "Compare a group" in the app.`);
