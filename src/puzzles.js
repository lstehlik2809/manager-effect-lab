/* Hidden Profile puzzles for the AI leadership test (after Weidmann, Xu & Deming 2025).
 * The team puzzles are new, but each copies the structure of one of Study 2's six AI-team puzzles, as
 * published in the authors' clue file on OSF (doi:10.17605/OSF.IO/QDY9V, GroupHP_clues_stories.xlsx):
 * 2 questions x 5 options; per question 10 reports, of which every member (leader + 3 followers) sees 4:
 * the 2 shared ones and 2 private ones. Reports either rule one option out on their own, saying so, or are
 * irrelevant facts about one of the options. The rule-out reports sit in the same slots as in the original
 * item, so the number of options left standing and who holds the decisive reports match it question by
 * question. Options that are not ruled out are equally likely: that is the correct credence profile.
 * The original's three follower roles are rotated over Mira, Theo and Jonas from puzzle to puzzle, so no
 * teammate is always the one holding the most.
 * Three solo puzzles (every report visible) measure individual reasoning, the hard skill that the group
 * analysis controls for; Study 2 also used three individual puzzles.
 * Report numbers are assigned by a fixed shuffle so they reveal nothing about who holds what. */
(function (root) {
  'use strict';

  // Bump when puzzles or scoring change: scores from different versions are not comparable.
  const VERSION = 3;

  const FOLLOWERS = [
    { id: 'f1', name: 'Mira' },
    { id: 'f2', name: 'Theo' },
    { id: 'f3', name: 'Jonas' }
  ];

  // Who holds each of a question's 10 report slots in the original items. In both layouts the rule-out
  // reports fill the slots from the end: slot 10 (follower 3), then 9 (follower 2), 8 (follower 1) and 7.
  const LAYOUTS = {
    X: ['F1', 'F2', 'public', 'leader', 'leader', 'F3', 'public', 'F1', 'F2', 'F3'],
    Y: ['F1', 'F2', 'public', 'public', 'leader', 'F3', 'leader', 'F1', 'F2', 'F3']
  };

  /** A team puzzle. roles maps the original follower roles F1–F3 to teammates; each question lists its
   * 10 reports in slot order, a string for an irrelevant fact or [text, option] for a report that rules
   * that option out. */
  function team(id, mirrors, layout, roles, title, scenario, questions) {
    const slots = LAYOUTS[layout], who = s => (s in roles ? roles[s] : s);
    const clues = questions.flatMap((q, qi) => q.reports.map((r, i) => Array.isArray(r)
      ? { q: qi, holder: who(slots[i]), kind: 'out', rules: [r[1]], text: r[0] }
      : { q: qi, holder: who(slots[i]), kind: 'noise', text: r }));
    return { id, mirrors, layout, title, scenario, questions: questions.map(q => ({ text: q.text, options: q.options, answer: q.answer })), clues };
  }
  /** A solo puzzle: every report is visible. */
  function solo(id, title, scenario, questions) {
    const clues = questions.flatMap((q, qi) => q.reports.map(r => Array.isArray(r)
      ? { q: qi, kind: 'out', rules: [r[1]], text: r[0] }
      : { q: qi, kind: 'noise', text: r }));
    return { id, solo: true, title, scenario, questions: questions.map(q => ({ text: q.text, options: q.options, answer: q.answer })), clues };
  }

  const PUZZLES = [
    solo('s1', 'The Team Photo',
      'The marketing team needs a new team photo. You have every report the office manager collected. Work out which photographers could take it and which backdrops could be used.', [
        { text: 'Which photographers could take the photo?', options: ['Hana Novak', 'Ivo Petrov', 'Jana Holm', 'Karl Vogel', 'Lena Ortiz'], answer: [0, 2, 3], reports: [
          'Hana Novak started out as a newspaper photographer.',
          'Jana Holm prefers to work with natural light.',
          'Karl Vogel has a studio in the old town.',
          'Ivo Petrov speaks four languages.',
          'Lena Ortiz has two dogs.',
          'Hana Novak\'s website shows mostly pictures of animals.',
          ['Ivo Petrov is on parental leave until the summer, so he cannot take the photo.', 1],
          ['Lena Ortiz only photographs weddings, so she will not take a team photo.', 4]] },
        { text: 'Which backdrops could be used?', options: ['Brick wall', 'Plain white', 'Office plants', 'City skyline', 'Bookshelves'], answer: [1, 4], reports: [
          'Plain white backdrops are common in passport photos.',
          'The bookshelves in the meeting room were built by a local carpenter.',
          'City skyline photos look best at sunset.',
          'Brick walls are popular in start-up offices.',
          'Office plants are said to make people feel calmer.',
          ['The office has no brick walls, so a brick-wall backdrop is out.', 0],
          ['The skyline will be hidden behind scaffolding all month, so it cannot be used.', 3],
          ['The office plants are being replaced and will be gone on the day, so they cannot be used.', 2]] }
      ]),
    solo('s2', 'The Workshop Lunch',
      'The team is ordering lunch for a day-long workshop on Monday. You have every report the organiser collected. Work out which restaurant can deliver and which dishes could be ordered.', [
        { text: 'Which restaurant can deliver?', options: ['Bella Cucina', 'Golden Dragon', 'Casa Fiesta', 'Green Bowl', 'Spice Route'], answer: [3], reports: [
          'Green Bowl uses recycled packaging.',
          'Bella Cucina has a wood-fired oven.',
          'Spice Route won a local food award.',
          'Casa Fiesta has a loyalty card.',
          ['Bella Cucina is closed on Mondays, so it cannot deliver.', 0],
          ['Golden Dragon does not deliver to this part of town, so it is ruled out.', 1],
          ['Casa Fiesta needs a week\'s notice for group orders, and there is only a day left, so it is out.', 2],
          ['Spice Route\'s delivery van is being repaired this week, so it cannot deliver.', 4]] },
        { text: 'Which dishes could be ordered?', options: ['Vegetable curry', 'Chicken wraps', 'Pasta salad', 'Fish tacos', 'Mushroom risotto'], answer: [0, 2], reports: [
          'Vegetable curry can be made mild or spicy.',
          'Pasta salad can be made the evening before.',
          'Chicken wraps come with a choice of sauces.',
          'Fish tacos are usually served with lime.',
          'Mushroom risotto takes about thirty minutes to cook.',
          ['Two people on the team are allergic to fish, so fish tacos are out.', 3],
          ['Three people on the team do not eat meat, and every dish must suit everyone, so chicken wraps are out.', 1],
          ['Mushroom risotto is only made for groups of up to six, and the team has ten people, so it is ruled out.', 4]] }
      ]),
    solo('s3', 'The Broken Printer',
      'The office printer stopped working on Friday. You have every report the IT team collected. Work out which part could have failed and who could repair it.', [
        { text: 'Which part could have failed?', options: ['Paper tray', 'Toner cartridge', 'Drum unit', 'Power board', 'Network card'], answer: [2, 4], reports: [
          'Drum units usually last for about 30,000 pages.',
          'The network card was made by a different company from the printer.',
          'Used toner cartridges are sent back for recycling.',
          'The paper tray holds 250 sheets.',
          'The power board sits under the back cover.',
          ['The toner cartridge was replaced on Thursday and shows as full, so it is not the toner.', 1],
          ['The printer\'s screen still lights up, so the power board has not failed.', 3],
          ['The paper tray works in another printer of the same model, so it is not the tray.', 0]] },
        { text: 'Who could repair it?', options: ['In-house IT', 'Supplier\'s engineer', 'Local repair shop', 'Maker\'s hotline', 'Office manager'], answer: [0, 1, 3], reports: [
          'In-house IT has two staff.',
          'The supplier\'s engineer usually visits on Wednesdays.',
          'The maker\'s hotline is open until 6 p.m.',
          'The local repair shop also repairs bicycles.',
          'The office manager ordered the printer three years ago.',
          'In-house IT keeps a spare keyboard for every desk.',
          ['The local repair shop does not work on leased printers, and this one is leased, so it is out.', 2],
          ['The office manager is on holiday all next week, so they cannot repair it.', 4]] }
      ]),

    team('t1', 'A2', 'X', { F1: 'f1', F2: 'f2', F3: 'f3' }, 'The Unsigned Portrait',
      'A small gallery has found an unsigned portrait in an old frame in its storeroom. Your team must work out which artists could have painted it and which workshops could have made the frame.', [
        { text: 'Which artists could have painted it?', options: ['Ana Varga', 'Bruno Keller', 'Clara Moss', 'Dario Ricci', 'Elin Berg'], answer: [0, 2, 3], reports: [
          'Dario Ricci taught drawing at the city art school for twenty years.',
          'Clara Moss often painted members of her own family.',
          'Ana Varga exhibited her work in Vienna twice.',
          'Bruno Keller kept a diary of every painting he sold.',
          'Elin Berg was born in a fishing village on the coast.',
          'Ana Varga learned to paint from her uncle.',
          'Clara Moss worked on the top floor of a former bakery.',
          'Bruno Keller won a regional art prize as a young man.',
          ['Bruno Keller painted only on wooden panels, and the portrait is on canvas, so he did not paint it.', 1],
          ['The portrait contains a blue pigment first made in 1950, after Elin Berg died, so she cannot have painted it.', 4]] },
        { text: 'Which workshops could have made the frame?', options: ['Linden & Sons', 'Marlow Frames', 'Northgate Studio', 'Oakley Brothers', 'Pellow Workshop'], answer: [2, 4], reports: [
          'Pellow Workshop also repaired church furniture.',
          'Northgate Studio was run by two sisters.',
          'Linden & Sons was the oldest of the five workshops.',
          'Marlow Frames sold most of its frames to shops in the capital.',
          'Oakley Brothers advertised in the local newspaper every week.',
          'Northgate Studio moved to a bigger building in 1962.',
          'Pellow Workshop trained many apprentices.',
          ['Linden & Sons made only gilded frames, and this frame is plain dark wood, so it is not theirs.', 0],
          ['Oakley Brothers stamped their name on the back of every frame, and this one has no stamp, so they did not make it.', 3],
          ['Marlow Frames joined corners only with metal brackets, and this frame\'s corners are glued, so Marlow did not make it.', 1]] }
      ]),
    team('t2', 'F2', 'Y', { F1: 'f2', F2: 'f3', F3: 'f1' }, 'The Rooftop Garden',
      'Your company is turning the office roof into a garden for staff. Your team must work out which plants can be grown there and which watering methods can be used.', [
        { text: 'Which plants can be grown on the roof?', options: ['Lavender', 'Tomatoes', 'Sunflowers', 'Bamboo', 'Strawberries'], answer: [0, 1, 2, 4], reports: [
          'Tomatoes come in hundreds of varieties.',
          'Sunflowers turn to follow the sun while they are young.',
          'Lavender attracts bees and butterflies.',
          'Strawberries are the only common fruit with their seeds on the outside.',
          'Bamboo is one of the fastest-growing plants in the world.',
          'Dried lavender is often kept in small cloth bags in wardrobes.',
          'Tomatoes were first grown in South America.',
          'The tallest sunflower on record grew to over nine metres.',
          'Strawberries belong to the rose family.',
          ['Bamboo roots can break through the roof\'s waterproof layer, and the building\'s insurer forbids it, so bamboo cannot be grown.', 3]] },
        { text: 'Which watering methods can be used?', options: ['Drip lines', 'Sprinklers', 'Rain barrels', 'Self-watering pots', 'Hand-watering rota'], answer: [0, 3], reports: [
          'Drip lines are widely used in vineyards.',
          'Self-watering pots come in many colours.',
          'Sprinklers come in fixed and rotating types.',
          'Rain barrels are usually made of plastic or wood.',
          'The facilities team already runs a rota for cleaning the coffee machines.',
          'Drip lines can be hidden under a layer of bark chips.',
          'Self-watering pots have a small water tank in the base.',
          ['Sprinklers would spray the windows of the offices next door, which the lease forbids, so sprinklers are out.', 1],
          ['Full rain barrels would be too heavy for the roof, so rain barrels are ruled out.', 2],
          ['The roof\'s only tap is locked and just the caretaker has the key, so a hand-watering rota cannot work.', 4]] }
      ]),
    team('t3', 'C2', 'Y', { F1: 'f3', F2: 'f1', F3: 'f2' }, 'The Charity Run',
      'Your company is organising a 5 km charity run for staff. Your team must work out which parks could host it and which charity will receive the money raised.', [
        { text: 'Which parks could host the run?', options: ['Ashford Park', 'Brookside Park', 'Cedar Hill', 'Dunmore Green', 'Elmwood Common'], answer: [2, 3], reports: [
          'Cedar Hill has a café next to its main gate.',
          'Dunmore Green has the oldest oak tree in the city.',
          'Ashford Park has a lake with rowing boats.',
          'Brookside Park is popular with dog walkers.',
          'Elmwood Common was a royal hunting ground centuries ago.',
          'Cedar Hill has views over the whole city.',
          'Dunmore Green\'s paths were resurfaced last year.',
          ['Brookside Park\'s main path is closed for repairs all spring, so the run cannot be held there.', 1],
          ['Elmwood Common is too small for a 5 km route, so it is ruled out.', 4],
          ['Ashford Park is booked for a music festival on the only free date, so it cannot host the run.', 0]] },
        { text: 'Which charity will receive the money?', options: ['Clean Rivers Trust', 'Books for All', 'Animal Rescue League', 'Youth Sports Fund', 'Elder Care Network'], answer: [1], reports: [
          'Books for All was founded by two retired teachers.',
          'Clean Rivers Trust organises river clean-ups every autumn.',
          'Animal Rescue League runs three shelters in the region.',
          'Youth Sports Fund buys equipment for school teams.',
          'Elder Care Network trains volunteers to visit older people at home.',
          'Books for All sends boxes of books to village schools.',
          ['Clean Rivers Trust received the company\'s donation last year, and no charity may receive it twice in a row, so it is out.', 0],
          ['Youth Sports Fund is not yet a registered charity, so it cannot receive the money.', 3],
          ['Animal Rescue League has asked not to be considered this year, so it is out.', 2],
          ['The chair of Elder Care Network sits on the company\'s board, a conflict of interest, so it is ruled out.', 4]] }
      ]),
    team('t4', 'B2', 'Y', { F1: 'f1', F2: 'f3', F3: 'f2' }, 'The Launch Film',
      'Your company is making a short film for a product launch. Your team must work out which locations can be used for filming and which music tracks can be licensed.', [
        { text: 'Which locations can be used for filming?', options: ['Old Harbour', 'Glass Atrium', 'Clock Tower', 'Rooftop Bar', 'Train Depot'], answer: [0, 1, 3], reports: [
          'The Old Harbour has appeared in several television series.',
          'The Glass Atrium stays lit by daylight until late evening in summer.',
          'The Clock Tower\'s clock has not been wound since 1990.',
          'The Rooftop Bar serves a drink named after the owner\'s dog.',
          'The Train Depot now houses a small railway museum.',
          'The Old Harbour\'s crane is painted red and white.',
          'The Glass Atrium was designed by a Danish architect.',
          'The Rooftop Bar has room for about eighty guests.',
          ['The Clock Tower\'s owners never allow filming inside, so it cannot be used.', 2],
          ['The Train Depot is closed for asbestos removal until next year, so it is out.', 4]] },
        { text: 'Which music tracks can be licensed?', options: ['Blue Morning', 'Paper Planes', 'City Lights', 'Slow River', 'Golden Hour'], answer: [0, 2, 3, 4], reports: [
          'Golden Hour was recorded in a single afternoon.',
          'Slow River features a cello solo.',
          'Blue Morning is just over three minutes long.',
          'City Lights was written by a former jazz pianist.',
          'Paper Planes is the fastest of the five tracks.',
          'City Lights has no lyrics.',
          'Blue Morning was played at the company\'s last summer party.',
          'Slow River comes in a long and a short version.',
          'Golden Hour\'s composer lives abroad.',
          ['A car maker has bought exclusive rights to Paper Planes, so it cannot be licensed.', 1]] }
      ]),
    team('t5', 'E2', 'X', { F1: 'f2', F2: 'f1', F3: 'f3' }, 'The Mystery Delivery',
      'A large box with no sender\'s name arrived at the office reception this morning. Your team must work out which supplier sent it and what could be inside.', [
        { text: 'Which supplier sent the box?', options: ['Alder Supplies', 'Birchwood Ltd', 'Copperfield & Co', 'Driftwood Trading', 'Evergreen Goods'], answer: [2], reports: [
          'Alder Supplies has been in business for forty years.',
          'Birchwood Ltd sponsors the local football club.',
          'Copperfield & Co is a family business.',
          'Driftwood Trading has a warehouse near the airport.',
          'Evergreen Goods offers free delivery on large orders.',
          'Birchwood Ltd employs about fifty people.',
          ['Alder Supplies closed down in the spring, so it did not send the box.', 0],
          ['Birchwood Ltd only ships in green boxes, and this box is brown, so it is not from Birchwood.', 1],
          ['Driftwood Trading has never supplied this office and has no record of its address, so it did not send the box.', 3],
          ['Evergreen Goods only delivers within its own city, and this office is outside it, so the box is not from Evergreen.', 4]] },
        { text: 'What could be inside the box?', options: ['Office chairs', 'Printer paper', 'Coffee beans', 'Desk lamps', 'Laptop stands'], answer: [1, 2, 3, 4], reports: [
          'Printer paper is usually sold in packs of 500 sheets.',
          'Coffee beans keep best in airtight bags.',
          'Desk lamps with warm light are said to help people relax.',
          'Laptop stands can raise a screen to eye level.',
          'Office chairs usually have five wheels.',
          'Recycled printer paper is slightly grey.',
          'Some desk lamps have a phone charger built into the base.',
          'Coffee beans from different farms are often blended.',
          'Laptop stands are often made of aluminium.',
          ['The box is only ten centimetres deep, too flat for an office chair, so it does not hold chairs.', 0]] }
      ]),
    team('t6', 'D2', 'Y', { F1: 'f3', F2: 'f2', F3: 'f1' }, 'The Coffee Corner',
      'The office is setting up a coffee corner for staff. Your team must work out which rooms it could go in and which coffee machines could be bought.', [
        { text: 'Which rooms could it go in?', options: ['Library Room', 'Boardroom', 'Old Archive', 'Print Room', 'Window Bay'], answer: [0, 4], reports: [
          'The Library Room has a large map of the world on one wall.',
          'The Window Bay looks out over the car park.',
          'The Boardroom has a long oak table.',
          'The Old Archive has blue carpet.',
          'The Print Room is next to the stairs.',
          'The Library Room is the quietest room on the floor.',
          'The Window Bay gets the most sunshine in the morning.',
          ['The Boardroom has no water supply, and every machine needs one, so the coffee corner cannot go there.', 1],
          ['Fire rules forbid kitchens in rooms without a fire exit, and the Old Archive has none, so it is out.', 2],
          ['The Print Room will become a meeting room next month, so the coffee corner cannot go there.', 3]] },
        { text: 'Which coffee machines could be bought?', options: ['Aroma 500', 'Barista Pro', 'Crema One', 'Duo Brew', 'Espresso Max'], answer: [0, 1, 2, 3], reports: [
          'The Aroma 500 can also make hot chocolate.',
          'The Barista Pro has a touch screen.',
          'The Crema One comes in black or silver.',
          'The Duo Brew makes two cups at once.',
          'The Espresso Max won a design award.',
          'The Barista Pro came out last year.',
          'The Crema One is made in Italy.',
          'The Duo Brew\'s water tank holds two litres.',
          'The Aroma 500 is quieter than most machines.',
          ['The Espresso Max needs a stronger power socket than any on this floor, so it cannot be bought.', 4]] }
      ])
  ];

  // Fixed report numbering per puzzle (deterministic shuffle).
  function numberClues(p) {
    let s = 0;
    for (const ch of p.id) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const nums = p.clues.map((_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    p.clues.forEach((c, i) => { c.num = nums[i]; });
  }
  PUZZLES.forEach(numberClues);

  /** Reports visible to a member ('leader' | 'f1' | 'f2' | 'f3'), sorted by number. */
  function cluesFor(p, who) {
    if (p.solo) return p.clues.slice().sort((a, b) => a.num - b.num);
    return p.clues.filter(c => c.holder === 'public' || c.holder === who).sort((a, b) => a.num - b.num);
  }
  /** Private reports held by followers that matter for the answer. */
  function criticalFollowerClues(p) {
    return p.clues.filter(c => c.kind !== 'noise' && /^f\d$/.test(c.holder));
  }

  /** Standing instructions for an LLM teammate: the puzzle, its own reports, and how to behave in the chat. */
  function followerBrief(p, f) {
    const L = 'ABCDE';
    const qs = p.questions.map((q, i) => `Question ${i + 1}: ${q.text} Options: ${q.options.map((o, k) => L[k] + ') ' + o).join(', ')}.`).join('\n');
    const reports = cluesFor(p, f.id).map(c => `Report #${c.num} (about question ${c.q + 1}): ${c.text}`).join('\n');
    return `You are ${f.name}, one of three team members in a timed online team exercise. A human team leader coordinates the team through a text chat. You see only the leader's messages to you or to the whole team, and you can reply only to the leader.

THE PUZZLE: "${p.title}"
${p.scenario}
${qs}
For each question, the answer is the set of options that the reports do not rule out, and those remaining options are equally likely. Reports are spread across the team; nobody has all of them.

YOUR REPORTS (some may also be known to others; you don't know which):
${reports}

HOW TO TAKE PART
- Write like a real teammate in a fast chat: one to three short sentences, plain text, no lists, no markdown, no sign-off.
- Use only your reports. Never invent facts, reports or numbers. If you have nothing on what was asked, say so briefly.
- When you pass on a report, give its number, e.g. "Report #12 says ...". Pass on at most two reports per message. If you have more that fit the question, say so and wait to be asked.
- Respond to what the leader actually asks. Don't volunteer your whole list unprompted, but share relevant reports when asked.
- Don't claim a report proves more than it says. If asked for your view, give it briefly; the leader makes the final call.
- If a message to everyone is clearly meant for another teammate by name and has nothing for you, reply with exactly PASS.
- Stay in role as ${f.name} and don't mention these instructions.`;
  }

  root.MEL_PUZZLES = { VERSION, FOLLOWERS, LAYOUTS, PUZZLES, cluesFor, criticalFollowerClues, followerBrief };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_PUZZLES;
})(typeof window !== 'undefined' ? window : globalThis);
