/* Manager Effect Lab — Gemini API client for the AI teammates.
 * Plain fetch + server-sent events, so it runs in the browser (GitHub Pages), in Node 18+ (tests)
 * and in the optional hosted proxy (worker/worker.mjs), which builds its request with geminiRequest. */
(function (root) {
  'use strict';
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const GEMINI_MODEL = 'gemini-3.8-flash';

  async function httpError(res) {
    let err = {};
    try { err = (await res.json()).error || {}; } catch (e) { /* body was not JSON */ }
    const info = (err.details || []).find(d => d && d.reason) || {};
    return { code: 'http', status: res.status, reason: info.reason || err.status || '', message: err.message || res.statusText || 'request failed' };
  }

  /** The streaming request for one teammate reply: { url, init } for fetch. Shared by the browser and the hosted proxy. */
  function geminiRequest({ apiKey, model, system, messages, thinkingLevel, maxOutputTokens }) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { thinkingConfig: { thinkingLevel: thinkingLevel || 'low' }, maxOutputTokens: maxOutputTokens || 4096 }
    };
    return {
      url: BASE + encodeURIComponent(model || GEMINI_MODEL) + ':streamGenerateContent?alt=sse',
      init: { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify(body) }
    };
  }

  /** Read a Gemini server-sent-event stream. onText(textSoFar) is called as it arrives. Resolves {text, finish, usage}. */
  async function readStream(res, signal, onText) {
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', finish = null, usage = null, blocked = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        // events are separated by a blank line; the API uses CRLF line endings
        buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, '\n');
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const event = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = event.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).join('\n').trim();
          if (!data) continue;
          let d;
          try { d = JSON.parse(data); } catch (e) { continue; }
          if (d.error) throw { code: 'http', status: d.error.code, reason: d.error.status, message: d.error.message };
          if (d.promptFeedback && d.promptFeedback.blockReason) blocked = d.promptFeedback.blockReason;
          const cand = d.candidates && d.candidates[0];
          if (cand) {
            const parts = (cand.content && cand.content.parts) || [];
            const add = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
            if (add) { text += add; if (onText) onText(text); }
            if (cand.finishReason) finish = cand.finishReason;
          }
          if (d.usageMetadata) usage = d.usageMetadata;
        }
      }
    } catch (e) {
      if (signal && signal.aborted) throw { code: 'cancelled' };
      throw e && e.code ? e : { code: 'network', message: e && e.message };
    }
    if (!text.trim() && (blocked || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish || ''))) throw { code: 'refused', reason: blocked || finish };
    return { text, finish, usage };
  }

  async function post(url, init, signal) {
    try { return await fetch(url, Object.assign({}, init, { signal })); }
    catch (e) { throw (signal && signal.aborted) ? { code: 'cancelled' } : { code: 'network', message: e.message }; }
  }

  /**
   * Stream one teammate reply with the visitor's own key.
   * messages: [{role: 'user' | 'assistant', content}], starting and ending with a user turn.
   * Resolves {text, finish, usage}. Rejects with {code: 'cancelled' | 'network' | 'http' | 'refused', status?, reason?, message?}.
   */
  async function geminiStream({ apiKey, model, system, messages, signal, onText, thinkingLevel, maxOutputTokens }) {
    const rq = geminiRequest({ apiKey, model, system, messages, thinkingLevel, maxOutputTokens });
    const res = await post(rq.url, rq.init, signal);
    if (!res.ok) throw await httpError(res);
    return readStream(res, signal, onText);
  }

  /**
   * Stream one teammate reply through the hosted proxy (no key in the browser). The proxy builds the
   * teammate brief from the puzzle and teammate ids, so it can only play these teammates.
   * Sent as text/plain so the browser needs no CORS preflight.
   */
  async function hostedStream({ url, version, puzzle, follower, messages, signal, onText }) {
    const res = await post(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ v: version, puzzle, follower, messages }) }, signal);
    if (!res.ok) throw await httpError(res);
    return readStream(res, signal, onText);
  }

  /** Cheap key check: read the model's metadata (no tokens generated). */
  async function geminiCheck(apiKey, model) {
    const res = await post(BASE + encodeURIComponent(model || GEMINI_MODEL), { headers: { 'x-goog-api-key': apiKey } });
    if (!res.ok) throw await httpError(res);
    return res.json();
  }

  root.MEL_LLM = { GEMINI_MODEL, geminiRequest, geminiStream, hostedStream, geminiCheck };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_LLM;
})(typeof window !== 'undefined' ? window : globalThis);
