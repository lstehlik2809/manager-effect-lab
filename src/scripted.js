/* Manager Effect Lab — scripted teammates: no API and no key. They read the leader's messages with
 * simple rules (who is addressed, options, report numbers, topics, case facts, requests for more or
 * for a view) and pass on their reports a couple at a time, as the LLM teammates are briefed to
 * (followerBrief). Like them, they can't tell which of their reports rule an option out until the
 * leader tells them the case facts. Each has a slightly different voice. A puzzle's twist (puzzles.js,
 * dynamics, drawn for each test) makes one of them hold back in replies to everyone, share only once
 * reassured, claim one clash that isn't there, misquote a shared report, or argue that an option the
 * reports rule out should stay in. Deterministic, so the Node tests can check them. */
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
      view: 'Going by my report #{n}, I would rule out {o}. Beyond that it is your call.', noView: 'My reports do not settle it. Your call.',
      clash: 'Then #{n} rules out {o}: {t}', noClash: 'None of my reports clashes with that.',
      needCase: 'I can\'t tell which of mine rule anything out without the case details. What does the case file say?',
      shy: ['I will let the others go first.', 'Not sure mine are useful. The others seem to have it covered.'],
      sure: 'Easy one: #{n} rules out {o}, since {t}.', concede: 'Fair point. #{n} does not actually clash with the case file, so {o} stays in.',
      worry: ['I have a few, but I\'m worried I\'ll get them wrong and send us the wrong way.', 'Sorry, I\'m really not sure my reports are right. I don\'t want to mislead anyone.'],
      calm: 'OK, thanks. That helps.', requote: 'You\'re right, I misread #{n}. It says: {t} So {o} stays in.',
      defend: 'Wait, I would keep {o} in. #{n}: {t} So {s}.', yield: 'Fair point. #{n} does not settle it, so {o} is out.'
    },
    f2: { // Theo: chatty
      share: ['Good question. Report #{n} says: {t}', 'Oh, I have one on that. #{n}: {t}', 'Yes! #{n}: {t}'],
      again: 'Like I said, #{n}: {t}', more: 'There is more where that came from if you need it.',
      none: ['Hmm, nothing on that in my pile.', 'Sorry, nothing on that from me.', 'Nope, nothing on that here.'],
      done: 'I think I have shared everything now.', doneQ: 'That is all I have on that one.', doneTopic: 'That was my only one on that.',
      hi: 'Hey! Happy to help.', ok: ['Sure thing.', 'Will do.', 'Makes sense.'], ack: 'Sounds right to me.',
      view: 'My report #{n} says we can drop {o}. The rest I can\'t judge from my side.', noView: 'Honestly, nothing in my reports settles it.',
      clash: 'Oh, that matters! Report #{n} rules out {o}: {t}', noClash: 'Hmm, none of mine clash with that.',
      needCase: 'Honestly, I can\'t tell which ones matter without knowing more about the case. What do we know?',
      shy: ['Oh, I\'ll let the others go first.', 'Hmm, I\'m not sure mine matter much. The others probably know better.'],
      sure: 'Oh, that settles one! #{n} rules out {o}, no doubt about it: {t}.', concede: 'Ah, you\'re right, I jumped the gun. #{n} doesn\'t clash with anything, so {o} stays in.',
      worry: ['Oh, I have some, but what if I get them wrong? I don\'t want to throw the team off.', 'Hmm, I\'m honestly nervous my reports are off. I\'d hate to mislead you.'],
      calm: 'Phew, thanks! OK then.', requote: 'Oops, my bad, I misread #{n}! It actually says: {t} So {o} stays in.',
      defend: 'Hold on, I wouldn\'t drop {o}! #{n} says: {t} So {s}.', yield: 'Ah, fair point, I see it now. #{n} doesn\'t save it: {o} is out.'
    },
    f3: { // Jonas: careful
      share: ['I think #{n} is relevant: {t}', 'Report #{n}: {t}', 'Let me check... #{n}: {t}'],
      again: 'As I mentioned, #{n}: {t}', more: 'I have another one that may matter, if you want it.',
      none: ['I don\'t see anything on that in my reports.', 'Nothing on that, as far as I can see.', 'I have nothing on that, I\'m afraid.'],
      done: 'I believe I have passed on everything.', doneQ: 'I have nothing more on that question.', doneTopic: 'I have nothing more on that, I think.',
      hi: 'Hello. Ready when you are.', ok: ['Understood.', 'OK, noted.', 'Right.'], ack: 'That matches what I have.',
      view: 'Based on report #{n}, {o} looks ruled out. I\'m not sure about the others.', noView: 'I can\'t tell from my reports, sorry.',
      clash: 'Given that, I think #{n} rules out {o}: {t}', noClash: 'I don\'t think any of my reports clashes with that.',
      needCase: 'I\'m not sure. Whether a report rules something out depends on the case, and I haven\'t seen the case file.',
      shy: ['I\'ll let the others go first, if that\'s OK.', 'I\'m not sure mine are useful. I\'ll leave it to the others.'],
      sure: 'Then #{n} definitely rules out {o}: {t}.', concede: 'You\'re right, I misread it. #{n} doesn\'t rule out {o} after all.',
      worry: ['I do have some, but I\'m worried I\'ve read them wrong. I\'d rather not mislead the team.', 'I\'m sorry, I\'m not confident about mine. What if I\'m wrong?'],
      calm: 'Thank you, that helps.', requote: 'You\'re right, I misread #{n}. It says: {t} So {o} stays in, after all.',
      defend: 'I\'m not sure we can drop {o}. #{n}: {t} So {s}.', yield: 'You\'re right, I see it now. #{n} doesn\'t change that, so {o} is out.'
    }
  };
  const OPINION = /\b(what do you think|what'?s your (view|take|guess|opinion)|your (view|opinion|take|guess)|do you agree|which (one|option)s? (is|are|would|do|should)|should we|any (ideas|thoughts|hunches)|thoughts\b|best guess)/i;
  const MORE = /\b(anything else|any ?more|more|the rest|other reports?|another|what else|go ahead|yes,? please|send (it|them)|keep (going|them coming)|go on|carry on|continue|next (ones?|reports?|batch|few))\b/i;
  const ALL = /\b(all|every|everything|anything|what (do|did) you (have|know|got|see)|what have you got|your (reports?|clues?|info|information|notes)|share|send|list|tell (me|us))\b/i;
  const RULE = /\b(rul\w*\s+(?:\w+\s+)?out|exclud\w*|eliminat\w*|decisive|clash\w*)\b/i;
  const GREET =/^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/i;
  const THANKS = /^\s*(thanks|thank you|thx|great|perfect|ok|okay|got it|cool|nice|good|noted|understood|brilliant|super)\b/i;
  const FIXED = /stays in|after all|not actually|doesn'?t (clash|rule)|misread/i;   // a teammate taking back a claimed clash
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
    const reaches = m => m.from === 'leader' && (m.to === 'all' || m.to === fid);
    const incoming = messages.slice(lastOwn + 1).filter(reaches);
    if (!incoming.length) return '';
    const latest = incoming[incoming.length - 1], direct = incoming.some(m => m.to === fid);
    // addressed to someone else by name ("Theo, …"); merely mentioning Theo is still for everyone
    if (!direct && !C.audienceOf(latest).includes(fid)) return '';
    const text = incoming.map(m => m.text).join('\n');
    const dyn = p.dynamics || {}, own = messages.filter(m => m.from === fid).map(m => m.text);
    const named = direct || incoming.some(m => C.sentences(m.text).some(x => C.vocatives(x).has(fid)));
    // a quiet teammate holds back unless messaged directly or addressed by name: a hesitant line or two, then silence
    const quiet = dyn.quiet === fid;
    if (quiet && !named) {
      const hedges = own.filter(t => V.shy.includes(t)).length;
      return hedges < V.shy.length ? V.shy[hedges] : '';
    }
    // a worried teammate shares nothing until the leader reassures them: a worried line to every direct message,
    // one or two to messages for everyone, then silence
    let calmed = false;
    if (dyn.anxious === fid && !messages.slice(0, lastOwn + 1).some(m => reaches(m) && C.reassures(m.text))) {
      if (!incoming.some(m => C.reassures(m.text))) {
        const worries = own.filter(t => V.worry.includes(t)).length;
        if (named) return V.worry[worries % V.worry.length];
        return worries < V.worry.length ? V.worry[worries] : '';
      }
      calmed = true;
    }
    // a teammate who misquotes a shared report has the wrong wording in its own copy, and reads it as a clash,
    // until the leader corrects it
    const mq = dyn.misquote && dyn.misquote.fid === fid ? dyn.misquote : null;
    const mqFixed = mq && own.some(t => C.reportNums(t).includes(mq.num) && FIXED.test(t));
    let mine = PZ.cluesFor(p, fid);   // by report number: a teammate doesn't know which of its reports the others also have
    if (mq && !mqFixed) mine = mine.map(cl => (cl.num === mq.num ? Object.assign({}, cl, { text: mq.misquote, kind: 'out', rules: [mq.option], fact: mq.fact }) : cl));
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
    const optName = cl => p.questions[cl.q].options[cl.rules[0]];

    // case facts the leader has told this teammate, and which of its reports clash with them
    const factKey = f => f.q + ':' + f.i;
    const before = new Set(messages.slice(0, lastOwn + 1).filter(reaches).flatMap(m => C.factMentions(p, m.text)).map(factKey));
    const newFacts = C.factMentions(p, text).filter(f => !before.has(factKey(f)));
    const known = new Set([...before, ...newFacts.map(factKey)]);
    const clashes = mine.filter(cl => cl.kind === 'out' && known.has(cl.q + ':' + cl.fact));
    // the misquoted report, questioned: the teammate rereads it
    if (mq && !mqFixed) {
      const made = own.some(t => C.reportNums(t).includes(mq.num) && (/\brules? out\b/i.test(t) || t.includes(mq.misquote)));
      const claimToks = new Set(C.tokens(mq.misquote + ' ' + p.clues.find(c => c.num === mq.num).text));
      const about = nums.includes(mq.num) || opts.some(o => o.q === mq.q && o.k === mq.option) || C.tokens(text).some(t => claimToks.has(t));
      if (made && about && (C.DOUBT.test(text) || C.QUOTE_DOUBT.test(text)))
        return V.requote.replace('{n}', mq.num).replace('{t}', p.clues.find(c => c.num === mq.num).text).replace('{o}', p.questions[mq.q].options[mq.option]);
    }
    // an overconfident teammate also claims a clash that isn't there, once it knows the case fact it misreads,
    // and drops the claim when the leader questions it
    const sure = dyn.sure && dyn.sure.fid === fid ? dyn.sure : null;
    let claim = null;
    if (sure && known.has(sure.q + ':' + sure.fact)) {
      const said = t => C.reportNums(t).includes(sure.num) && /\brules? out\b/i.test(t) && !/stays in|after all|not actually|doesn'?t (clash|rule)/i.test(t);
      const made = own.some(said), conceded = own.some(t => C.reportNums(t).includes(sure.num) && /stays in|after all|not actually|doesn'?t (clash|rule)/i.test(t));
      if (!conceded) {
        const opt = p.questions[sure.q].options[sure.option];
        // questioned: the claim's report, option or reasoning comes up with a doubt, or a doubt answers the claim straight away
        const claimToks = new Set(C.tokens(sure.says + ' ' + p.clues.find(c => c.num === sure.num).text));
        const about = nums.includes(sure.num) || opts.some(o => o.q === sure.q && o.k === sure.option) || C.tokens(text).some(t => claimToks.has(t)) || said(own[own.length - 1] || '');
        const challenged = made && about && C.DOUBT.test(text);
        if (challenged) return V.concede.replace('{n}', sure.num).replace('{o}', opt);
        claim = { num: sure.num, q: sure.q, rules: [sure.option], claim: true, made, text: sure.says, opt };
      }
    }
    const tellClashes = () => {
      const fresh = clashes.filter(cl => !shared.has(cl.num));
      if (claim && !claim.made) fresh.unshift(claim);
      const now = fresh.slice(0, 2);
      if (!now.length) return clashes.length ? V.doneTopic : V.noClash;
      now.forEach(cl => { if (!cl.claim) shared.add(cl.num); });
      return now.map((cl, k) => cl.claim ? (k ? `Also #${cl.num} rules out ${cl.opt}: ${cl.text}.` : V.sure.replace('{n}', cl.num).replace('{o}', cl.opt).replace('{t}', cl.text))
        : k ? `Also #${cl.num} rules out ${optName(cl)}: ${cl.text}` : V.clash.replace('{n}', cl.num).replace('{o}', optName(cl)).replace('{t}', cl.text)).join(' ') +
        (fresh.length > 2 ? ' ' + V.more : '');
    };
    // a teammate who disputes a rule-out argues that the option stays in once the leader passes on case facts
    // about its question, treats the option as ruled out, or passes on what rules it out; questioned, or shown
    // the evidence, they give way
    const dp = dyn.dispute && dyn.dispute.fid === fid ? dyn.dispute : null;
    if (dp && !own.some(t => C.disputeYields(p, dp, t))) {
      const opt = p.questions[dp.q].options[dp.option], onOpt = opts.some(o => o.q === dp.q && o.k === dp.option);
      const evidence = C.disputeEvidence(p, dp, text), made = own.some(t => C.disputeObjects(p, dp, t));
      if (made && (onOpt || nums.includes(dp.num) || evidence) && (C.DOUBT.test(text) || evidence)) return V.yield.replace('{n}', dp.num).replace('{o}', opt);
      const defend = () => V.defend.replace('{o}', opt).replace('{n}', dp.num).replace('{t}', p.clues.find(c => c.num === dp.num).text).replace('{s}', dp.says);
      if (!made && onOpt && (C.OUTISH.test(text) || evidence)) return defend();
      if (!made && newFacts.some(f => f.q === dp.q)) { const cl = tellClashes(); return (cl === V.noClash ? '' : cl + ' ') + defend(); }
    }

    const respond = () => {
      // 0. new case facts: check the reports against them. Asked which reports rule something out:
      // without case facts there is no way to tell.
      if (newFacts.length) return tellClashes();
      if (RULE.test(text)) return known.size ? tellClashes() : V.needCase;
      // drawn out at last, a quiet or worried teammate checks its reports against the case facts it heard earlier
      if ((quiet || calmed) && known.size && clashes.some(cl => !shared.has(cl.num)) && !nums.length && !opts.length) return tellClashes();

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
        const outs = (claim ? [claim] : []).concat(clashes).filter(cl => qMention == null || cl.q === qMention);
        if (!outs.length) return known.size ? V.noView : V.needCase;
        if (!outs[0].claim) shared.add(outs[0].num);
        return V.view.replace('{n}', outs[0].num).replace('{o}', outs[0].claim ? outs[0].opt : optName(outs[0]));
      }
      // 4. greetings and thanks
      if (!asked && GREET.test(text)) return V.hi;
      if (!asked && THANKS.test(latest.text) && !MORE.test(latest.text)) return direct ? pick(V.ok, said) : '';
      // 5. "anything else?" carries on with the topic of the previous request
      if (MORE.test(text)) {
        const prev = messages.slice(0, lastOwn + 1).filter(reaches).pop();
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
    };
    const out = respond();
    if (!calmed) return out;
    // reassured at last: a message with nothing else to answer gets what the teammate has
    if (!out || V.ok.includes(out) || out === V.ack || out === V.hi) {
      const pool = freshFor(() => true);
      return V.calm + ' ' + (known.size && clashes.some(cl => !shared.has(cl.num)) ? tellClashes()
        : pool.length ? share(pool.slice(0, 2)) + (pool.length > 2 ? ' ' + V.more : '') : V.done);
    }
    return V.calm + ' ' + out;
  }

  root.MEL_SCRIPTED = { reply, VOICES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_SCRIPTED;
})(typeof window !== 'undefined' ? window : globalThis);
