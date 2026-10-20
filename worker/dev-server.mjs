// Local stand-in for the Cloudflare Worker, to try the hosted teammates before deploying.
//   node --env-file=path/to/.env worker/dev-server.mjs        (needs GEMINI_API_KEY)
// then open the app on localhost with ?hosted=http://127.0.0.1:8787/reply
// No per-visitor or daily caps here; those need the Cloudflare bindings. Pilot data is kept in memory
// until the server stops; read it with  node tools/pilot-export.mjs http://127.0.0.1:8787  (token "dev").
import http from 'node:http';
import worker, { PilotStore } from './worker.mjs';

const PORT = 8787;
const mem = new Map();
const storage = { get: async k => mem.get(k), put: async (k, v) => { mem.set(k, v); }, list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)).sort()) };
const pilot = new PilotStore({ storage });
const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY, ALLOWED_ORIGINS: 'http://127.0.0.1:8765,http://localhost:8765,http://127.0.0.1:8775,http://localhost:8775',
  PILOT_STORE: { idFromName: () => 'pilot', get: () => ({ fetch: (u, init) => pilot.fetch(new Request(u, init)) }) }, PILOT_TOKEN: 'dev'
};
if (!env.GEMINI_API_KEY) console.warn('GEMINI_API_KEY is not set: every teammate request will get 503.');

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = {};
  ['origin', 'content-type', 'authorization'].forEach(k => { if (req.headers[k]) headers[k] = req.headers[k]; });
  const r = await worker.fetch(new Request(`http://127.0.0.1:${PORT}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const c of r.body) res.write(c);
  res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`hosted teammates on http://127.0.0.1:${PORT}/reply`));
