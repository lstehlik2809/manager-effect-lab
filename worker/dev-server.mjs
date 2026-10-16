// Local stand-in for the Cloudflare Worker, to try the hosted teammates before deploying.
//   node --env-file=path/to/.env worker/dev-server.mjs        (needs GEMINI_API_KEY)
// then open the app on localhost with ?hosted=http://127.0.0.1:8787/reply
// No per-visitor or daily caps here; those need the Cloudflare bindings.
import http from 'node:http';
import worker from './worker.mjs';

const PORT = 8787;
const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, ALLOWED_ORIGINS: 'http://127.0.0.1:8765,http://localhost:8765' };
if (!env.GEMINI_API_KEY) console.warn('GEMINI_API_KEY is not set: every request will get 503.');

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = {};
  ['origin', 'content-type'].forEach(k => { if (req.headers[k]) headers[k] = req.headers[k]; });
  const r = await worker.fetch(new Request(`http://127.0.0.1:${PORT}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const c of r.body) res.write(c);
  res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`hosted teammates on http://127.0.0.1:${PORT}/reply`));
