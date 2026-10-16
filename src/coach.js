/* Manager Effect Lab — reads one puzzle's chat and answer and turns them into specific feedback:
 * which questions were specific or repeated, where the leader built on a teammate's answer, which
 * decisive reports never came up and who held them, and how many points were lost to hidden reports
 * versus to how the leader used the reports they had.
 * Pure functions with no DOM, so the same code runs in the browser and in the Node tests.
 * These are rough rules for these puzzles, not a validated coding scheme. */
(function (root) {
  'use strict';
  const S = root.MEL || require('./stats.js');
  const PZ = root.MEL_PUZZLES || require('./puzzles.js');
  const FOL = PZ.FOLLOWERS;
  const NAMES = FOL.map(f => f.name.toLowerCase());
  const nameOf = id => (FOL.find(f => f.id === id) || { name: id }).name;

  /* ---------- text helpers (also used by the scripted teammates) ---------- */
  const STOP = new Set(('the and for are but not you your yours with from have has had what whats which who whom whose when where why how ' +
    'this that these those there theres their they them then than was were been being does did doing done can could would should will shall ' +
    'may might must just also very really about into onto over under again more most some any anything something everything nothing all each ' +
    'every other another such only own same too yes now here our ours let lets please thanks thank okay hey hello hiya good great cool nice ' +
    'tell know think say says said share send give list check confirm see look got get need want like one two three first second ' +
    'report reports question questions option options rule ruled rules team everyone anyone anybody guys folks clue clues info information ' +
    'mean means its did didnt dont doesnt isnt arent wasnt else still sure maybe thing things whole far lot bit way yet ' +
    'out off never ever since after before while until because cannot cant both either neither found show shows showed without within').split(' '));
  const stem = w => (w.length > 5 ? w.slice(0, 5) : w.replace(/s$/, ''));
  const words = t => (String(t).toLowerCase().replace(/['’]/g, '').match(/[a-z0-9]+/g) || []);
  /** Content words, stemmed (no stop words, numbers or teammate names). */
  const tokens = t => words(t).filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w) && !NAMES.includes(w)).map(stem);
  const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Per puzzle: generic words (title, scenario, questions) and the specific terms of its reports and options. */
  const vocabCache = new Map();
  function vocab(p) {
    if (vocabCache.has(p.id)) return vocabCache.get(p.id);
    const generic = new Set(tokens([p.title, p.scenario].concat(p.questions.map(q => q.text)).join(' ')));
    const specific = new Set();
    p.clues.forEach(c => tokens(c.text).forEach(t => { if (!generic.has(t)) specific.add(t); }));
    const options = p.questions.map(q => q.options.map((o, k) => {
      const keys = tokens(o).filter(t => !generic.has(t) && !q.options.some((o2, k2) => k2 !== k && tokens(o2).includes(t)));
      keys.forEach(t => specific.add(t));
      // options without a distinctive word ("1 March") are matched as a phrase
      return { keys, phrase: keys.length || !/\s/.test(o) ? null : new RegExp('(^|[^a-z0-9])' + escRe(o.toLowerCase()) + '($|[^a-z0-9])') };
    }));
    const v = { generic, specific, options, optionKeys: new Set(options.flat().flatMap(o => o.keys)) };
    vocabCache.set(p.id, v);
    return v;
  }
  /** Options named in a text: [{ q, k }]. */
  function optionMentions(p, text) {
    const v = vocab(p), lower = String(text).toLowerCase(), toks = new Set(tokens(text)), out = [];
    v.options.forEach((opts, q) => opts.forEach((o, k) => { if (o.keys.some(t => toks.has(t)) || (o.phrase && o.phrase.test(lower))) out.push({ q, k }); }));
    return out;
  }
  /** Report numbers cited in a text ("#12", "report 12", "report no. 12"). */
  function reportNums(text) {
    const out = new Set(), re = /(?:#\s?|\breports?\s+(?:no\.?\s*|number\s*)?#?\s?)(\d{1,2})\b/gi;
    let m;
    while ((m = re.exec(String(text)))) out.add(+m[1]);
    return [...out];
  }
  /** Which question a text points at ("question 2", "Q1", "the first question"), or null. */
  function questionMention(text) {
    const t = String(text).toLowerCase();
    if (/\b(question|q)\s*#?\s*(1|one)\b|\bfirst question\b/.test(t)) return 0;
    if (/\b(question|q)\s*#?\s*(2|two)\b|\bsecond question\b/.test(t)) return 1;
    return null;
  }
  const sentences = text => String(text).split(/(?<=[?!.])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const LEAD = new RegExp('^(?:(?:ok|okay|so|and|also|great|thanks|thank you|cool|right|now|then|next|first|hi|hey|hello|guys|team|all|everyone|folks|quick question|one more|last|finally|btw|over to you|go ahead and|' + NAMES.join('|') + ')\\b[\\s,!:;.\\-–—]*)+', 'i');
  const ASK = /^(what|which|who|whom|whose|when|where|why|how|do|does|did|is|are|was|were|can|could|would|will|should|have|has|had|any|anything|anyone|anybody|tell|share|send|give|list|check|confirm|explain|describe|let me know|please|pls|might)\b/i;
  // requests for reports worded as instructions: "post your reports", "I need what you have", "keep going"
  const WANTED = "(?:reports?|clues?|info|information|notes|findings|evidence|details|facts|everything|anything|#\\s?\\d+|what (?:you|you all|each of you|everyone) (?:have|has|know|knows|got|found|hold|holds|see)|what you'?ve got)";
  const REQUEST = new RegExp('^(?:' + [
    '(?:post|paste|dump|drop|put|type|write|show|read|bring|pass|forward|lay out|spill|start|begin|walk (?:me|us) through|run (?:me|us) through|go through|fill (?:me|us) in)\\b.*\\b' + WANTED,
    "(?:i|we)(?:'d| would)?\\s+(?:need|want|like|love)\\s+(?:to\\s+(?:see|hear|know|get)\\b|.*\\b" + WANTED + ')',
    "let'?s (?:hear|see|get|go through|collect|gather|pool|list|share)\\b",
    'report in\\b',
    '(?:more|the rest|next(?: ones?)?|another(?: one)?|keep (?:going|them coming)|go on|go ahead|continue|carry on)(?:\\s*,?\\s*(?:please|pls))?[\\s!.]*$'
  ].join('|') + ')', 'i');
  // "Reports, please", "all reports in the chat now"; not "the reports point to B"
  const NOUN_REQ = /^(?:(?:all|each|every|any)\s+(?:of\s+)?)?(?:your\s+|the\s+)?(?:other\s+|private\s+|hidden\s+|remaining\s+)?(?:reports|clues|info|information|notes|findings)\b(?!\s+(?:is|are|was|were|seems?|seem|looks?|says?|said|shows?|showed|rules?|ruled|points?|suggests?|agrees?|agree|confirms?|match(?:es)?|do|does|don'?t|doesn'?t|all|both|clearly)\b)/i;
  /**
   * A question or a request for information: ends in "?", opens like a question or request ("what…", "tell me…",
   * "share…"), or asks for reports in other words ("post your reports", "reports, please", "keep going").
   */
  function isQuestion(s) {
    if (s.includes('?')) return true;
    const t = s.replace(LEAD, '').trim();
    if (/^(please\s+)?(submit|wait|stop|hold on|be quiet|don'?t|do not|no need|never ?mind)\b/i.test(t)) return false;
    return ASK.test(t) || REQUEST.test(t) || REQUEST.test(s.trim()) ||
      (NOUN_REQ.test(t) && (/\b(please|pls|in the chat)\b|\b(now|here)[\s!.]*$/i.test(t) || words(t).length <= 2));
  }
  /* ---------- who a message to everyone is for ---------- */
  // A teammate is addressed by name ("Theo, …", "…, Theo?", "Hi Theo", "@Theo", "Theo what do you have?"),
  // not merely mentioned ("Theo said…", "Theo's report", "ask Theo", "agree with Theo").
  const NAME = '@?(?:' + FOL.map(f => f.name).join('|') + ')';
  const NAMES_ONLY = new RegExp('^' + NAME + '(?:\\s*(?:,|&|\\+|/|\\band\\b)\\s*' + NAME + ')*[\\s?!.]*$', 'i');
  const NAME_FIRST = new RegExp('^(' + NAME + ')\\s+(.+)$', 'i'), NAME_LAST = new RegExp('(\\S+)\\s+(' + NAME + ')[\\s?!.]*$', 'i');
  const AT_NAME = new RegExp('@(?:' + FOL.map(f => f.name).join('|') + ')\\b', 'gi');
  const VOC_LEAD = /^(?:(?:ok|okay|so|and|also|but|right|now|then|next|btw|hi|hey|hello|hiya|yo|dear|morning|good morning|thanks|thank you|thx|cheers|great|nice|perfect|cool)\b[\s!.]*)+/i;
  // after a name that opens a clause: words that turn to that person. "do", "are", "were" and "have" cannot
  // follow a third-person name, so "Jonas were the bottles dry?" addresses Jonas; "did", "can"… need a "you".
  const TO_YOU = /^(?:what|which|who|whom|whose|when|where|why|how|any|anything|tell|share|send|give|list|check|confirm|explain|describe|please|pls|you|your|do|are|were|have|over to you)\b|^(?:did|can|could|would|will|should|may|might)\s+(?:you|u)\b/i;
  // before a name that closes a clause: words that make it a mention ("agree with Theo", "ask Theo")
  const ABOUT = new Set(('about after against among around as at before behind between beyond by except for from in including into like near of off on onto per than through to toward towards under unlike until upon versus vs via with without ' +
    'and or nor plus ask asked asking tell told telling hear heard thank thanked agree agreed believe trust ping pinged cc call called quote quoted see saw follow followed is was isnt wasnt that not just only even').split(' '));
  const EVERYONE = /\b(everyone|everybody|all of you|you all|y'?all|each of you|any of you|anyone|anybody|someone|somebody|team|guys|folks)\b/i;
  const ACK = /\b(thanks|thank you|thx|cheers|great|nice|perfect|good point|got it|noted)\b/i;
  const nameIds = t => FOL.filter(f => new RegExp('\\b' + f.name + '\\b', 'i').test(t)).map(f => f.id);
  /** Teammates addressed by name in one sentence. */
  function vocatives(s) {
    const out = new Set(), add = t => nameIds(t).forEach(id => out.add(id));
    String(s).split(/[,;:()–—]|\s-\s/).forEach(raw => {
      const c = raw.trim().replace(VOC_LEAD, '').trim();
      if (!c) return;
      if (NAMES_ONLY.test(c)) return add(c);
      const first = c.match(NAME_FIRST), last = c.match(NAME_LAST);
      if (first && TO_YOU.test(first[2])) add(first[1]);
      if (last && !ABOUT.has(last[1].toLowerCase().replace(/['’]/g, ''))) add(last[2]);
      (c.match(AT_NAME) || []).forEach(add);
    });
    return out;
  }
  /**
   * Who a leader message is for: its recipient, or, for a message to everyone, the teammates its questions
   * address by name (else those its other sentences address, leaving out a passing "thanks, Theo"); everyone otherwise.
   */
  function audienceOf(m) {
    const all = FOL.map(f => f.id);
    if (m.to !== 'all') return [m.to];
    const ss = sentences(m.text).map(s => ({ s, q: isQuestion(s), voc: vocatives(s), all: EVERYONE.test(s) }));
    const qs = ss.filter(x => x.q), ids = new Set();
    if (qs.some(x => x.voc.size)) {
      if (qs.some(x => !x.voc.size && x.all)) return all;   // "Mira, what do you have? Anyone else?"
      qs.forEach(x => x.voc.forEach(id => ids.add(id)));
    } else {
      if (ss.some(x => x.all)) return all;
      // "Theo, thanks. Anything else?" is still for Theo
      const more = qs.some(x => /\b(else|more|another|other|rest)\b/i.test(x.s));
      ss.filter(x => !x.q && (more || !ACK.test(x.s))).forEach(x => x.voc.forEach(id => ids.add(id)));
    }
    return ids.size ? all.filter(id => ids.has(id)) : all;
  }
  const quote = (t, n) => { t = String(t).replace(/\s+/g, ' ').trim().replace(/\.$/, ''); n = n || 90; return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
  const listText = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

  /* ---------- what the leader could have known ---------- */
  /** Options of question qi that the reports in `nums` rule out: Map option -> report numbers that do it. */
  function ruledOut(p, qi, nums) {
    const res = new Map();
    p.clues.filter(c => c.q === qi && c.kind === 'out' && nums.has(c.num)).forEach(c => c.rules.forEach(k => { if (!res.has(k)) res.set(k, [c.num]); }));
    ruleGroups(p, qi).filter(g => g.length > 1 && g.every(c => nums.has(c.num))).forEach(g => g[0].rules.forEach(k => { if (!res.has(k)) res.set(k, g.map(c => c.num)); }));
    return res;
  }
  /** The decisive reports of a question as rule groups: a report that rules out on its own, or both halves of a two-part rule. */
  function ruleGroups(p, qi) {
    const groups = [], halves = new Map();
    p.clues.filter(c => c.q === qi && c.kind !== 'noise').forEach(c => {
      if (c.kind === 'out') groups.push([c]);
      else { const k = c.rules.join(','); if (!halves.has(k)) { halves.set(k, []); groups.push(halves.get(k)); } halves.get(k).push(c); }
    });
    return groups;
  }
  /** Best possible score on question qi with only the reports in `nums`: an even split over the options they leave standing. */
  function bestWith(p, qi, nums) {
    const out = ruledOut(p, qi, nums), left = [0, 1, 2, 3, 4].filter(k => !out.has(k));
    return S.credenceScore(S.correctDist(left, 5), S.correctDist(p.questions[qi].answer, 5));
  }

  /* ---------- one puzzle ---------- */
  const OFFER = /\b(i have|i've got|i got|there's|there is|i also have)\s+(more|another|one more|something else|other|a couple more)|\bmore (on|about) (this|that|it)\b|\bif you (want|need) (it|them|more)\b|\bmore where that came from\b|\bask (me )?if you need\b/i;
  const MORE_REQ = /\b(more|else|rest|other|another|yes|go ahead|sure|send (it|them)|keep going|go on|continue|carry on|next)\b/i;
  const REPEAT_ADVICE = 'Asking again makes teammates recite their reports a couple at a time, relevant or not; asking about the options still standing gets the decisive ones sooner.';
  // Every decisive report out within this many requests counts as efficient (one per teammate).
  const EFFICIENT_ASKS = FOL.length;
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

  /**
   * Analyse one puzzle. messages: the chat ({ from: 'leader' | 'f1'…, to, text, t }); answers: [[5 credences] per question].
   * opts.timeLeft: seconds left on the clock when the answer was submitted (optional).
   * Returns { metrics, info, observations }.
   */
  function analyse(p, messages, answers, opts) {
    opts = opts || {};
    messages = messages || [];
    const v = vocab(p);
    const clueBy = new Map(p.clues.map(c => [c.num, c]));
    const critical = p.solo ? [] : PZ.criticalFollowerClues(p);
    const critNums = new Set(critical.map(c => c.num));
    const leaderMsgs = [], qList = [], heard = [], leaderToks = new Set();
    const surfaced = new Map(), offers = new Map(), lastTo = {};
    const askedAny = new Set(), askedDirect = new Set(), askedAbout = {};
    let turns = 0, asksToAll = null;   // requests the leader had sent when the last decisive report came out
    messages.forEach((m, i) => {
      if (i && (m.from === 'leader') !== (messages[i - 1].from === 'leader')) turns++;
      if (m.from === 'leader') {
        const aud = audienceOf(m), direct = aud.length < FOL.length;
        const toks = tokens(m.text), nums = reportNums(m.text);
        // a follow-up picks up a report number or a specific term that a teammate brought up; it connects
        // teammates when it reaches someone who had not mentioned that detail themselves
        // Option names come from the answer sheet, so they count only when asked straight back to the teammate who raised them.
        const picked = [], srcOf = has => new Set(heard.filter(has).map(r => r.fid));
        nums.forEach(n => { const src = srcOf(r => r.nums.has(n)); if (src.size) picked.push(src); });
        toks.filter(t => v.specific.has(t) && !leaderToks.has(t)).forEach(t => {
          const src = srcOf(r => r.toks.has(t));
          if (!src.size) return;
          if (!v.optionKeys.has(t)) picked.push(src);
          else if (direct && aud.some(a => src.has(a))) picked.push(new Set(aud));
        });
        let followUp = picked.length > 0;
        const connect = picked.some(src => aud.some(a => !src.has(a)));
        aud.forEach(fid => {
          if (!offers.has(fid)) return;
          if (direct || /\b(more|else|rest|other|another|keep going|go on|continue|carry on)\b/i.test(m.text)) { offers.delete(fid); if (direct && MORE_REQ.test(m.text)) followUp = true; }
        });
        // specific: the message names an option, a report number or a detail from the reports
        // ("You mentioned the label applicator. Anything else on it?" counts)
        const specificMsg = nums.length > 0 || toks.some(t => v.specific.has(t));
        const qs = sentences(m.text).filter(isQuestion).map(s => {
          const norm = new Set(words(s).filter(w => !NAMES.includes(w) && !/^(please|pls|thanks|team|guys|hi|hey|hello|ok|okay|so|and)$/.test(w)));
          const key = [...norm].sort().join(' ');
          const targeted = specificMsg;
          const repeat = qList.some(q => q.aud.some(a => aud.includes(a)) && (q.key === key || jaccard(q.norm, norm) >= 0.75));
          const q = { msg: leaderMsgs.length, text: s, norm, key, aud, targeted, repeat };
          qList.push(q);
          return q;
        });
        if (qs.length) aud.forEach(fid => {
          askedAny.add(fid);
          if (direct) askedDirect.add(fid);
          optionMentions(p, m.text).forEach(o => { (askedAbout[fid] = askedAbout[fid] || new Set()).add(o.q + ':' + o.k); });
        });
        const lm = { i, m, aud, direct, qs, followUp, connect, credited: [] };
        leaderMsgs.push(lm);
        aud.forEach(fid => { lastTo[fid] = lm; });
        toks.forEach(t => leaderToks.add(t));
      } else {
        const nums = reportNums(m.text);
        nums.forEach(n => {
          if (critNums.has(n) && clueBy.get(n).holder === m.from && !surfaced.has(n)) {
            surfaced.set(n, m.from);
            if (lastTo[m.from]) lastTo[m.from].credited.push(n);
            // requests: questions, and any other message that drew out a decisive report
            if (surfaced.size === critical.length) asksToAll = leaderMsgs.filter(x => x.qs.length || x.credited.length).length;
          }
        });
        heard.push({ fid: m.from, toks: new Set(tokens(m.text)), nums: new Set(nums) });
        if (OFFER.test(m.text)) offers.set(m.from, i);
      }
    });

    const L = leaderMsgs.map(x => x.m);
    const leaderText = L.map(m => m.text).join(' ');
    const nWords = (leaderText.match(/\S+/g) || []).length;
    const we = (leaderText.match(/\b(we|us|our|ours|ourselves|let's|lets)\b/gi) || []).length;
    const repeats = qList.filter(q => q.repeat), targeted = qList.filter(q => !q.repeat && q.targeted), generic = qList.filter(q => !q.repeat && !q.targeted);
    const missed = critical.filter(c => !surfaced.has(c.num));
    const metrics = {
      leaderMessages: L.length, words: nWords, questions: qList.length, turns, weRate: nWords ? 100 * we / nWords : 0,
      engaged: new Set(messages.filter(m => m.from !== 'leader').map(m => m.from)).size,
      surfaced: surfaced.size, critical: critical.length, broadcast: L.filter(m => m.to === 'all').length,
      targeted: targeted.length, generic: generic.length, repeats: repeats.length,
      followUps: leaderMsgs.filter(x => x.followUp).length, connects: leaderMsgs.filter(x => x.connect).length,
      askedDirect: FOL.map(f => f.id).filter(id => askedDirect.has(id)), askedAny: FOL.map(f => f.id).filter(id => askedAny.has(id)),
      offersIgnored: [...offers.keys()], surfacedNums: [...surfaced.keys()], missedNums: missed.map(c => c.num), asksToAll
    };

    /* where the points went: hidden reports vs using the reports the leader had */
    const avail = new Set(p.clues.filter(c => p.solo || c.holder === 'public' || c.holder === 'leader').map(c => c.num));
    surfaced.forEach((_, n) => avail.add(n));
    const perQ = p.questions.map((q, qi) => {
      const correct = S.correctDist(q.answer, 5), a = answers[qi].map(x => +x || 0);
      const best = bestWith(p, qi, avail), actual = S.credenceScore(a, correct);
      const out = ruledOut(p, qi, avail);
      const kept = [...out.keys()].filter(k => a[k] > 0).map(k => ({ k, pct: a[k], refs: out.get(k) }));
      const dropped = q.answer.filter(k => !(a[k] > 0));
      const pos = [0, 1, 2, 3, 4].filter(k => a[k] > 0 && !out.has(k));
      const uneven = pos.length >= 2 && Math.max(...pos.map(k => a[k])) - Math.min(...pos.map(k => a[k])) >= 10;
      return { best, actual, hidden: 100 - Math.max(best, actual), use: Math.max(0, best - actual), kept, dropped, uneven };
    });
    const info = {
      perQ: perQ.map(x => ({ best: x.best, actual: x.actual, hidden: x.hidden, use: x.use })),
      best: S.mean(perQ.map(x => x.best)), actual: S.mean(perQ.map(x => x.actual)),
      hidden: S.mean(perQ.map(x => x.hidden)), use: S.mean(perQ.map(x => x.use))
    };

    /* observations: specific things the leader did, good and to try next time */
    const obs = [];
    const add = tone => (key, weight, text) => { const o = { tone, key, weight, text }; obs.push(o); return o; };
    const good = add('good'), tip = add('tip');
    const optName = (qi, k) => p.questions[qi].options[k];
    const ref = n => { const c = clueBy.get(n); return c.holder === 'leader' ? 'your report #' + n : c.holder === 'public' ? 'shared report #' + n : nameOf(c.holder) + '\'s report #' + n; };

    if (!p.solo) {
      // praise a question that drew out decisive reports, but not a general call to everyone
      const best = leaderMsgs.filter(x => x.credited.length && x.qs.some(q => !q.repeat) && (x.qs.some(q => q.targeted) || x.direct))
        .sort((a, b) => b.credited.length - a.credited.length || (b.qs.some(q => q.targeted) - a.qs.some(q => q.targeted)))[0];
      if (best) {
        const who = [...new Set(best.credited.map(n => surfaced.get(n)))].map(nameOf);
        good('best-ask', 3 + 2 * best.credited.length, `Your question “${quote(best.m.text)}” drew out ${best.credited.length === 1 ? 'decisive report' : 'decisive reports'} ${listText(best.credited.map(n => '#' + n))} from ${listText(who)}.`);
      }
      // getting everything out with a few requests is efficient, however broad they were
      if (critical.length && missed.length === 0) {
        const quick = asksToAll >= 1 && asksToAll <= EFFICIENT_ASKS;
        good('all-surfaced', quick ? 7 : 6, quick
          ? `Every decisive report your teammates held came out after just ${asksToAll === 1 ? 'one request' : NUM[asksToAll] + ' requests'} from you. Efficient: there was nothing left to ask.`
          : 'Every decisive report your teammates held came out.');
      }
      const conn = leaderMsgs.find(x => x.connect);
      if (conn) good('connect', 3 + metrics.connects, `You passed on what one teammate said to the others${metrics.connects > 1 ? ` ${metrics.connects} times` : ''}, for example “${quote(conn.m.text, 80)}”. Connecting reports is how hidden-profile puzzles get solved.`);
      if (metrics.askedDirect.length === FOL.length) good('all-asked', 2, 'You asked all three teammates directly.');

      if (!qList.length && missed.length) tip('no-questions', 8, 'You didn\'t ask your teammates anything. Most of the decisive reports sat with them.');
      // the costliest group of decisive reports that never came up
      // points at stake = what the report would add beyond the better of the best possible and the actual answer;
      // a missing report that was guessed right anyway costs nothing, but the guess is worth naming
      const gaps = [];
      p.questions.forEach((q, qi) => ruleGroups(p, qi).forEach(g => {
        const miss = g.filter(c => !avail.has(c.num));
        if (!miss.length) return;
        const plus = new Set(avail); miss.forEach(c => plus.add(c.num));
        const withIt = bestWith(p, qi, plus);
        if (withIt - perQ[qi].best < 0.5) return;
        const stake = Math.max(0, withIt - Math.max(perQ[qi].best, perQ[qi].actual));
        const guessed = stake <= 0.5 && g[0].rules.every(k => !(+answers[qi][k] > 0));
        if (stake > 0.5 || guessed) gaps.push({ qi, g, miss, stake, guessed });
      }));
      gaps.sort((a, b) => b.stake - a.stake);
      gaps.slice(0, 2).forEach((gp, rank) => {
        const opts = gp.g[0].rules.map(k => optName(gp.qi, k)), have = gp.g.filter(c => avail.has(c.num));
        const holder = gp.miss[0].holder, nm = nameOf(holder);
        if (gp.guessed) {
          const together = have.length ? ` together with ${ref(have[0].num)}` : gp.miss.length > 1 ? ' together' : '';
          tip(rank ? 'guess-2' : 'guess', 1.5, `You ruled out ${listText(opts)} on a guess: ${listText(gp.miss.map(c => ref(c.num)))}, which ${gp.miss.length > 1 ? 'settle' : 'settles'} ${opts.length > 1 ? 'them' : 'it'}${together}, never came up. Right this time, but asking would have made it certain.`);
          return;
        }
        let text = gp.miss.length === 1
          ? `${nm}'s report #${gp.miss[0].num} never came up. ${have.length ? 'Together with ' + ref(have[0].num) + ', it' : 'It'} rules out ${listText(opts)}.`
          : `${listText(gp.miss.map(c => ref(c.num)))} never came up. Together they rule out ${listText(opts)}.`;
        const about = askedAbout[holder] || new Set();
        if (gp.g[0].rules.some(k => about.has(gp.qi + ':' + k))) text += ` You did ask ${nm} about ${opts[0]}; when a teammate answers without a report number, ask which report says so.`;
        else if (!askedAny.has(holder)) text += ` You never asked ${nm} anything.`;
        else if (!askedDirect.has(holder)) text += ` You never asked ${nm} directly; a question about ${opts[0]} would have found it.`;
        else text += ` A question to ${nm} about ${opts[0]} would have found it.`;
        tip(rank ? 'missed-2' : 'missed', 2 + gp.stake / 4, text + ` (Worth ${Math.round(gp.stake)} points on Q${gp.qi + 1}.)`);
      });
      // How the leader asked matters only if something stayed hidden: when every decisive report came out,
      // broad or repeated requests did the job and the feedback doesn't suggest asking differently.
      if (repeats.length >= 2 && missed.length) {
        const example = quote(repeats[0].text, 70);
        tip('repeats', 2 + repeats.length, `${repeats.length} of your questions repeated an earlier one to the same people, such as “${example}”. ${REPEAT_ADVICE}`).example = example;
      }
      if (qList.length >= 2 && !targeted.length && missed.length) {
        const opt = p.questions[0].options.find((o, k) => p.questions[0].answer.indexOf(k) < 0);
        tip('generic', 4, `All your questions were general, such as “${quote((generic[0] || qList[0]).text, 60)}”. Naming an option, for example asking who has anything on “${opt}”, tells teammates which report to look for.`);
      }
      metrics.offersIgnored.forEach(fid => {
        const stillHidden = missed.filter(c => c.holder === fid).length;
        if (stillHidden) tip('offer', 3 + stillHidden, `${nameOf(fid)} offered to share more, but you didn't follow up. ${nameOf(fid)} still held ${stillHidden === 1 ? 'a decisive report' : stillHidden + ' decisive reports'}.`);
      });
      if (opts.timeLeft >= 60 && missed.length && !perQ.every(x => x.actual >= 99.5)) tip('early', 2, `You submitted with ${Math.floor(opts.timeLeft / 60)}:${String(Math.round(opts.timeLeft % 60)).padStart(2, '0')} left while ${missed.length === 1 ? 'a decisive report was' : missed.length + ' decisive reports were'} still hidden.`);
    }
    // using the reports: the same checks for solo and team puzzles
    perQ.forEach((x, qi) => {
      x.kept.slice(0, 1).forEach(kp => {
        const refs = listText(kp.refs.map(n => (p.solo ? '#' + n : ref(n)))) + (kp.refs.length > 1 ? ' together' : '');
        tip('kept', 2 + kp.pct / 6, (p.solo ? `The reports rule out ${optName(qi, kp.k)} (${refs})` : `You had what you needed to rule out ${optName(qi, kp.k)} (${refs})`) + `, but you still gave it ${kp.pct}%.`);
      });
      x.dropped.slice(0, 1).forEach(k => tip('dropped', 4, `You ruled out ${optName(qi, k)}, but no report rules it out: it was one of the right answers on Q${qi + 1}.`));
      if (x.uneven && !x.kept.length && !x.dropped.length) tip('uneven', 2, `On Q${qi + 1} you gave unequal shares to options that no report ${p.solo ? '' : 'you saw '}separated. When the reports can't tell options apart, equal shares score best.`);
    });
    const perfect = perQ.every(x => x.actual >= 99.5);
    if (perfect) good('perfect', 5, p.solo ? 'You read every report correctly.' : 'You got the exact answer on both questions.');
    else if (!p.solo && perQ.every(x => x.use < 1 && x.actual <= x.best + 1)) good('used-well', 3, 'You used the reports you gathered well: your answer was the best one possible with them.');

    return { metrics, info, observations: obs };
  }
  function jaccard(a, b) {
    if (!a.size && !b.size) return 1;
    let n = 0; a.forEach(x => { if (b.has(x)) n++; });
    return n / (a.size + b.size - n);
  }
  /** The observations worth showing: the strongest few of each tone. */
  function top(observations, nGood, nTip) {
    const by = tone => observations.filter(o => o.tone === tone).sort((a, b) => b.weight - a.weight);
    return { good: by('good').slice(0, nGood == null ? 2 : nGood), tips: by('tip').slice(0, nTip == null ? 3 : nTip) };
  }

  /* ---------- a whole test ---------- */
  /**
   * results: [{ title, solo, analysis: analyse(…) }]. Returns totals and the strongest specific observations across puzzles.
   */
  function summarise(results) {
    const team = results.filter(r => !r.solo && r.analysis), n = team.length;
    const sum = k => team.reduce((a, r) => a + (+r.analysis.metrics[k] || 0), 0);
    const per = k => (n ? sum(k) / n : NaN);
    const allQ = team.flatMap(r => r.analysis.info.perQ);
    const totals = {
      questions: per('questions'), targeted: per('targeted'), generic: per('generic'), repeats: per('repeats'),
      followUps: per('followUps'), connects: per('connects'), turns: per('turns'), words: per('words'), weRate: per('weRate'),
      surfaced: sum('surfaced'), critical: sum('critical'), repeatsTotal: sum('repeats'), connectsTotal: sum('connects'),
      targetedShare: sum('targeted') + sum('generic') ? sum('targeted') / (sum('targeted') + sum('generic')) : NaN,
      hidden: allQ.length ? S.mean(allQ.map(x => x.hidden)) : NaN, use: allQ.length ? S.mean(allQ.map(x => x.use)) : NaN,
      allAsked: team.filter(r => r.analysis.metrics.askedDirect.length === FOL.length).length,
      allSurfaced: team.filter(r => r.analysis.metrics.critical && r.analysis.metrics.surfaced === r.analysis.metrics.critical).length,
      quickPuzzles: team.filter(r => quickDone(r.analysis.metrics)).length, puzzles: n
    };
    const quickMax = Math.max(0, ...team.filter(r => quickDone(r.analysis.metrics)).map(r => r.analysis.metrics.asksToAll));
    // strongest instance of each kind of observation, labelled with its puzzle
    const best = tone => {
      const byKey = new Map();
      results.filter(r => r.analysis).forEach(r => r.analysis.observations.filter(o => o.tone === tone).forEach(o => {
        const k = o.key.replace(/-2$/, '');
        const cur = byKey.get(k);
        if (!cur || o.weight > cur.weight) byKey.set(k, Object.assign({}, o, { key: k, puzzle: r.title, count: (cur ? cur.count : 0) + 1 }));
        else cur.count++;
      }));
      return [...byKey.values()];
    };
    const goods = best('good'), tips = best('tip');
    // summary-level wording for patterns that recur across puzzles
    goods.forEach(o => {
      if (o.key === 'all-surfaced') {
        const where = totals.allSurfaced < n ? `${totals.allSurfaced} of ${n} team puzzles` : n === 1 ? 'your team puzzle' : n === 2 ? 'both team puzzles' : `all ${n} team puzzles`;
        const quick = totals.quickPuzzles === totals.allSurfaced;
        const asks = quickMax === 1 ? 'one request' : NUM[quickMax] + ' requests';
        o.text = `Every decisive report came out in ${where}` + (quick ? (totals.allSurfaced > 1 ? `, each time after at most ${asks}` : `, after just ${asks}`) + ' from you. Efficient.' : '.');
        o.weight = 3 + 2 * totals.allSurfaced + (quick ? 1 : 0); o.puzzle = null;
      }
      if (o.key === 'all-asked') { o.text = `You asked all three teammates directly in ${totals.allAsked} of ${n} team puzzles.`; o.weight = 1 + totals.allAsked; o.puzzle = null; }
      if (o.key === 'connect' && totals.connectsTotal > 1) o.weight += totals.connectsTotal;
    });
    tips.forEach(o => {
      if (o.key === 'repeats' && o.count > 1) { o.text = `Across the test, ${totals.repeatsTotal} of your questions repeated an earlier one, such as “${o.example}”. ${REPEAT_ADVICE}`; o.puzzle = null; }
    });
    const pick = (xs, k) => xs.sort((a, b) => b.weight - a.weight).slice(0, k);
    return { totals, strengths: pick(goods, 3), tips: pick(tips, 3) };
  }
  const quickDone = m => m.critical > 0 && m.surfaced === m.critical && m.asksToAll >= 1 && m.asksToAll <= EFFICIENT_ASKS;

  /* ---------- the habits Study 2 linked to effective leaders, and a playful style ---------- */
  const fmt1 = x => (isFinite(x) ? x.toFixed(1) : '–'), pctText = x => (isFinite(x) ? Math.round(100 * x) + '%' : '–');
  /**
   * The three habits, rated strong / some / little on rough thresholds for these puzzles (5–6 decisive hidden
   * clues each), not norms. Specific questions count fully, general ones half and repeats not at all, so asking
   * the same thing again earns nothing. When every decisive clue came out, fewer questions or follow-ups were
   * enough: those rate 'efficient' rather than 'some' or 'little'. T: totals from summarise().
   */
  function habits(T) {
    const rate = (v, strong, some) => (!isFinite(v) ? 'little' : v >= strong ? 'strong' : v >= some ? 'some' : 'little');
    const complete = T.critical > 0 && T.surfaced === T.critical;
    const enough = r => (complete && r !== 'strong' ? 'efficient' : r), ENOUGH = ' You drew out every decisive clue, so fewer was enough.';
    const ask = enough(rate(T.targeted + 0.5 * T.generic, 4, 2)), back = enough(rate(T.followUps, 2, 1));
    return [
      { label: 'Asking questions', value: `${fmt1(T.targeted + T.generic)} per puzzle, ${pctText(T.targetedShare)} specific`, rating: ask, note: 'Leaders who asked more questions got better results, with AI and with human teams. Specific questions count fully here, general ones half, repeats not at all.' + (ask === 'efficient' ? ENOUGH : '') },
      { label: 'Back-and-forth', value: `${fmt1(T.followUps)} follow-ups per puzzle`, rating: back, note: 'More conversational turn-taking went with better team results. Here it counts the times you built on what a teammate said.' + (back === 'efficient' ? ENOUGH : '') },
      { label: 'Drawing out hidden clues', value: `${T.surfaced} of ${T.critical} decisive clues`, rating: rate(T.critical ? T.surfaced / T.critical : NaN, 0.75, 0.4), note: 'Weak leaders learned little from their team: their answers looked like uninformed guesses.' }
    ];
  }
  /** A playful leadership style from the habits: { name, text }. */
  function leaderStyle(hb, T) {
    const [q, t, i] = hb.map(x => x.rating), general = !(T.targetedShare >= 0.35);
    const complete = T.critical > 0 && T.surfaced === T.critical;
    if (i === 'strong' && (q === 'strong' || t === 'strong') && !general) return { name: 'The Facilitator', text: 'You asked specific questions, built on the answers and pulled out what each teammate knew. That is the pattern Study 2 linked to the most effective leaders.' };
    if (i === 'strong' && complete) return { name: 'The Collector', text: (general ? 'You drew out every hidden clue by asking the team broadly.' : 'You drew out every hidden clue with well-aimed questions.') +
      (T.quickPuzzles === T.puzzles ? ' It took only a few requests: efficient, with nothing left to ask.' : ' That is the heart of leading a hidden-profile team.') };
    if (i === 'strong') return { name: 'The Collector', text: general ? 'You got most of the hidden clues out by asking for everything at once. For the last few, ask about the options still standing.' : 'You got most of the hidden clues out with few questions. Building on what teammates say would surface the rest.' };
    if (T.repeats >= 1.5) return { name: 'The Broadcaster', text: 'You asked the team for everything, often more than once. Teammates share a couple of reports at a time, so specific follow-ups would have drawn out more.' };
    if (q === 'strong' || t === 'strong') return { name: 'The Explorer', text: 'You kept the conversation going, but some decisive clues stayed hidden. Ask each teammate directly about the options still standing.' };
    if (i === 'little' && q === 'little') return { name: 'The Lone Solver', text: 'You leaned on your own clues. Most decisive clues sat with your teammates, so draw them out before you decide.' };
    return { name: 'The Coordinator', text: 'You kept the team moving and got part of the picture. A few more follow-up questions would surface the rest.' };
  }

  root.MEL_COACH = { tokens, words, vocab, optionMentions, reportNums, questionMention, sentences, isQuestion, vocatives, audienceOf, ruledOut, bestWith, analyse, top, summarise, habits, leaderStyle };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_COACH;
})(typeof window !== 'undefined' ? window : globalThis);
