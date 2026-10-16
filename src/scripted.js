/* Manager Effect Lab — scripted teammates: no API and no key. They read the leader's messages with
 * simple rules (who is addressed, options, report numbers, topics, requests for more or for a view)
 * and pass on their reports a couple at a time, as the LLM teammates are briefed to (followerBrief).
 * Each has a slightly different voice. Deterministic, so the Node tests can check them. */
(function (root) {
  'use strict';
  const PZ = root.MEL_PUZZLES || require('./puzzles.js');
  const C = root.MEL_COACH || require('./coach.js');

  const VOICES = {
    f1: { // Mira: brisk and precise
      share: ['Report #{n}: {t}', 'I have #{n}: {t}', '#{n} says: {t}'],
      again: 'Same as before, #{n}: {t}', more: 'I have more on that if you want it.',
      none: ['Nothing on that in my reports.', 'Nothing on that, sorry.', 'I have nothing on that.'],
      done: 'That is everything I have.', doneQ: 'That is all I have on that question.', doneTopic: 'That is all I have on that.',
      hi: 'Hi! Ready.', ok: ['OK.', 'Got it.', 'Noted.'], ack: 'Agreed.',
      view: 'Going by my report #{n}, I would rule out {o}. Beyond that it is your call.', noView: 'My reports do not settle it. Your call.'
    },
    f2: { // Theo: chatty
      share: ['Good question. Report #{n} says: {t}', 'Oh, I have one on that. #{n}: {t}', 'Yes! #{n}: {t}'],
      again: 'Like I said, #{n}: {t}', more: 'There is more where that came from if you need it.',
      none: ['Hmm, nothing on that in my pile.', 'Sorry, nothing on that from me.', 'Nope, nothing on that here.'],
      done: 'I think I have shared everything now.', doneQ: 'That is all I have on that one.', doneTopic: 'That was my only one on that.',
      hi: 'Hey! Happy to help.', ok: ['Sure thing.', 'Will do.', 'Makes sense.'], ack: 'Sounds right to me.',
      view: 'My report #{n} says we can drop {o}. The rest I can\'t judge from my side.', noView: 'Honestly, nothing in my reports settles it.'
    },
    f3: { // Jonas: careful
      share: ['I think #{n} is relevant: {t}', 'Report #{n}: {t}', 'Let me check... #{n}: {t}'],
      again: 'As I mentioned, #{n}: {t}', more: 'I have another one that may matter, if you want it.',
      none: ['I don\'t see anything on that in my reports.', 'Nothing on that, as far as I can see.', 'I have nothing on that, I\'m afraid.'],
      done: 'I believe I have passed on everything.', doneQ: 'I have nothing more on that question.', doneTopic: 'I have nothing more on that, I think.',
      hi: 'Hello. Ready when you are.', ok: ['Understood.', 'OK, noted.', 'Right.'], ack: 'That matches what I have.',
      view: 'Based on report #{n}, {o} looks ruled out. I\'m not sure about the others.', noView: 'I can\'t tell from my reports, sorry.'
    }
  };
  const OPINION = /\b(what do you think|what'?s your (view|take|guess|opinion)|your (view|opinion|take|guess)|do you agree|which (one|option)s? (is|are|would|do|should)|should we|any (ideas|thoughts|hunches)|thoughts\b|best guess)/i;
  const MORE = /\b(anything else|any ?more|more|the rest|other reports?|another|what else|go ahead|yes,? please|send (it|them)|keep (going|them coming)|go on|carry on|continue|next (ones?|reports?|batch|few))\b/i;
  const ALL = /\b(all|every|everything|anything|what (do|did) you (have|know|got|see)|what have you got|your (reports?|clues?|info|information|notes)|share|send|list|tell (me|us))\b/i;
  const GREET = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/i;
  const THANKS = /^\s*(thanks|thank you|thx|great|perfect|ok|okay|got it|cool|nice|good|noted|understood|brilliant|super)\b/i;
  const pick = (x, n) => (Array.isArray(x) ? x[n % x.length] : x);
  const fill = (tpl, cl) => tpl.replace('{n}', cl.num).replace('{t}', cl.text);

  /**
   * The next message from scripted teammate fid in puzzle p, or '' to stay quiet.
   * messages: the chat so far. shared: Set of report numbers fid has passed on (updated in place).
   */
  function reply(p, fid, messages, shared) {
    const V = VOICES[fid];
    let lastOwn = -1;
    messages.forEach((m, i) => { if (m.from === fid) lastOwn = i; });
    const said = messages.filter(m => m.from === fid).length;
    const incoming = messages.slice(lastOwn + 1).filter(m => m.from === 'leader' && (m.to === 'all' || m.to === fid));
    if (!incoming.length) return '';
    const latest = incoming[incoming.length - 1], direct = incoming.some(m => m.to === fid);
    // addressed to someone else by name ("Theo, …"); merely mentioning Theo is still for everyone
    if (!direct && !C.audienceOf(latest).includes(fid)) return '';
    const text = incoming.map(m => m.text).join('\n');
    const mine = PZ.cluesFor(p, fid).slice().sort((a, b) => (a.holder === 'public') - (b.holder === 'public'));
    const v = C.vocab(p);
    const topics = new Set(C.tokens(text).filter(t => v.specific.has(t)));
    const opts = C.optionMentions(p, text), nums = C.reportNums(text);
    // a question named by number ("question 1") or by its wording ("which component failed?")
    let qMention = C.questionMention(text);
    if (qMention == null) {
      const words = new Set(C.tokens(text)), hits = p.questions.map(q => C.tokens(q.text).filter(t => words.has(t)).length);
      if (hits.filter(n => n > 0).length === 1) qMention = hits.findIndex(n => n > 0);
    }
    const asked = C.sentences(text).some(C.isQuestion);
    const share = (cls, again) => {
      cls.forEach(cl => shared.add(cl.num));
      return cls.map((cl, k) => (k ? 'Also #' + cl.num + ': ' + cl.text : fill(again ? V.again : pick(V.share, said), cl))).join(' ');
    };
    const freshFor = filter => mine.filter(cl => !shared.has(cl.num) && filter(cl));

    // 1. report numbers
    if (nums.length) {
      const held = mine.filter(cl => nums.includes(cl.num));
      if (held.length) return share(held.slice(0, 2), held.every(cl => shared.has(cl.num)));
      if (!topics.size && !opts.length) return direct ? `I don't have #${nums[0]}.` : '';
    }
    // 2. a topic: options or specific terms from the reports. When an option is named, one shared
    // word is not enough ("operator error" should not bring up "zero errors" on the vision sensor).
    const onTopic = (tp, op) => mine.map(cl => {
      let sc = new Set(C.tokens(cl.text).filter(t => tp.has(t))).size;
      if (cl.rules && op.some(o => o.q === cl.q && cl.rules.includes(o.k))) sc += 2;
      if (qMention != null && cl.q === qMention) sc += 0.5;
      return { cl, sc };
    }).filter(x => x.sc >= (op.length ? 2 : 1)).sort((a, b) => b.sc - a.sc || (a.cl.holder === 'public') - (b.cl.holder === 'public'));
    if (topics.size || opts.length) {
      const scored = onTopic(topics, opts);
      const fresh = scored.filter(x => !shared.has(x.cl.num)).map(x => x.cl);
      if (fresh.length) return share(fresh.slice(0, 2)) + (fresh.length > 2 ? ' ' + V.more : '');
      if (scored.length) return MORE.test(latest.text) ? V.doneTopic : share([scored[0].cl], true);
      if (asked) return pick(V.none, said);
      return direct ? pick(V.ok, said) : '';
    }
    // 3. a view on the answer
    if (OPINION.test(text)) {
      const outs = mine.filter(cl => cl.kind === 'out' && (qMention == null || cl.q === qMention));
      if (!outs.length) return V.noView;
      shared.add(outs[0].num);
      return V.view.replace('{n}', outs[0].num).replace('{o}', p.questions[outs[0].q].options[outs[0].rules[0]]);
    }
    // 4. greetings and thanks
    if (!asked && GREET.test(text)) return V.hi;
    if (!asked && THANKS.test(latest.text) && !MORE.test(latest.text)) return direct ? pick(V.ok, said) : '';
    // 5. "anything else?" carries on with the topic of the previous request
    if (MORE.test(text)) {
      const prev = messages.slice(0, lastOwn + 1).filter(m => m.from === 'leader' && (m.to === 'all' || m.to === fid)).pop();
      if (prev) {
        const fresh = onTopic(new Set(C.tokens(prev.text).filter(t => v.specific.has(t))), C.optionMentions(p, prev.text)).filter(x => !shared.has(x.cl.num)).map(x => x.cl);
        if (fresh.length) return share(fresh.slice(0, 2)) + (fresh.length > 2 ? ' ' + V.more : '');
      }
    }
    // 6. a general request for reports, or for more
    if (asked || MORE.test(text) || ALL.test(text) || qMention != null) {
      const pool = freshFor(cl => qMention == null || cl.q === qMention);
      if (pool.length) return share(pool.slice(0, 2)) + (pool.length > 2 ? ' ' + V.more : '');
      return qMention != null ? V.doneQ : V.done;
    }
    // 7. a statement: acknowledge it once
    return direct ? pick(V.ok, said) : fid === 'f1' ? V.ack : '';
  }

  root.MEL_SCRIPTED = { reply, VOICES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_SCRIPTED;
})(typeof window !== 'undefined' ? window : globalThis);
