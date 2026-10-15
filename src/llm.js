/* Manager Effect Lab — Gemini API client for the AI teammates.
 * Plain fetch + server-sent events, so it runs in the browser (GitHub Pages) and in Node 18+ (tests). */
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

  /**
   * Stream one teammate reply.
   * messages: [{role: 'user' | 'assistant', content}], starting and ending with a user turn.
   * onText(textSoFar) is called as the reply streams in. Resolves {text, finish, usage}.
   * Rejects with {code: 'cancelled' | 'network' | 'http' | 'refused', status?, reason?, message?}.
   */
  async function geminiStream({ apiKey, model, system, messages, signal, onText, thinkingLevel, maxOutputTokens }) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { thinkingConfig: { thinkingLevel: thinkingLevel || 'low' }, maxOutputTokens: maxOutputTokens || 4096 }
    };
    let res;
    try {
      res = await fetch(BASE + encodeURIComponent(model || GEMINI_MODEL) + ':streamGenerateContent?alt=sse', {
        method: 'POST', headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify(body), signal
      });
    } catch (e) {
      throw (signal && signal.aborted) ? { code: 'cancelled' } : { code: 'network', message: e.message };
    }
    if (!res.ok) throw await httpError(res);
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

  /** Cheap key check: read the model's metadata (no tokens generated). */
  async function geminiCheck(apiKey, model) {
    let res;
    try { res = await fetch(BASE + encodeURIComponent(model || GEMINI_MODEL), { headers: { 'x-goog-api-key': apiKey } }); }
    catch (e) { throw { code: 'network', message: e.message }; }
    if (!res.ok) throw await httpError(res);
    return res.json();
  }

  root.MEL_LLM = { GEMINI_MODEL, geminiStream, geminiCheck };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_LLM;
})(typeof window !== 'undefined' ? window : globalThis);
