/* Hidden Profile puzzles for the AI leadership test (after Weidmann, Xu & Deming 2025).
 * The team puzzles are new, but each copies the structure of one of Study 2's six AI-team puzzles, as
 * published in the authors' clue file on OSF (doi:10.17605/OSF.IO/QDY9V, GroupHP_clues_stories.xlsx):
 * 2 questions x 5 options; per question 10 reports, of which every member (leader + 3 followers) sees 4:
 * the 2 shared ones and 2 private ones. The rule-out reports sit in the same slots as in the original
 * item, so the number of options left standing and who holds the decisive reports match it question by
 * question. Options that are not ruled out are equally likely: that is the correct credence profile.
 * One deliberate change from the original: there, a decisive report says that it rules an option out, so
 * teammates know which of their reports matter and one broad request ("send everything that rules an
 * option out") draws out the whole puzzle. Here every report is a plain fact about one option, and it
 * rules that option out only against a fact in the case file, which only the leader sees. The other
 * reports are facts of the same kind that fit the case file. So teammates can't pick out their decisive
 * reports on their own: the leader has to ask about the options, share the case facts, or collect
 * everything a couple of reports at a time.
 * The original's three follower roles are rotated over Mira, Theo and Jonas from puzzle to puzzle, so no
 * teammate is always the one holding the most.
 * Three solo puzzles (every report visible) measure individual reasoning, the hard skill that the group
 * analysis controls for; Study 2 also used three individual puzzles.
 * Report numbers are assigned by a fixed shuffle so they reveal nothing about who holds what. */
(function (root) {
  'use strict';

  // Bump when puzzles or scoring change: scores from different versions are not comparable.
  const VERSION = 5;

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
   * case facts (leader only) as [text, key words], and its 10 reports in slot order: a string for a fact
   * that fits the case file, or [text, option, fact] for a fact that rules that option out against case
   * fact number `fact`. The key words let the scripted teammates and the feedback notice when the leader
   * passes a case fact on. dynamics (optional): { quiet: teammate id } or { sure: { fid, q, report, option,
   * says, why } }, where report is a regular expression for the report the teammate misreads and says is
   * the reason the teammate gives. */
  function team(id, mirrors, layout, roles, title, scenario, questions, dynamics) {
    const slots = LAYOUTS[layout], who = s => (s in roles ? roles[s] : s);
    const clues = questions.flatMap((q, qi) => q.reports.map((r, i) => Array.isArray(r)
      ? { q: qi, holder: who(slots[i]), kind: 'out', rules: [r[1]], fact: r[2], text: r[0] }
      : { q: qi, holder: who(slots[i]), kind: 'noise', text: r }));
    const p = { id, mirrors, layout, title, scenario, clues, dynamics: dynamics || {},
      questions: questions.map(q => ({ text: q.text, options: q.options, answer: q.answer, facts: q.facts.map(f => ({ text: f[0], keys: f[1].split(' ') })) })) };
    return p;
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
        { text: 'Which artists could have painted it?', options: ['Ana Varga', 'Bruno Keller', 'Clara Moss', 'Dario Ricci', 'Elin Berg'], answer: [0, 2, 3],
          facts: [
            ['The portrait is painted in oil on canvas.', 'canvas oil'],
            ['Its blue paint contains a pigment that was first made in 1950.', 'pigment 1950 blue'],
            ['It is 60 cm tall and 50 cm wide.', 'tall wide size 60']],
          reports: [
            'Dario Ricci painted on canvas all his life.',
            'Ana Varga painted in oils until the late 1970s.',
            'Clara Moss painted on canvases of every size, from tiny to two metres wide.',
            'Ana Varga\'s portraits are never more than 80 cm on any side.',
            'Bruno Keller stopped painting in 1972.',
            'Dario Ricci bought his paints from a shop that always stocked the newest colours.',
            'Clara Moss painted in oils from 1955 onwards.',
            'Elin Berg\'s portraits are all between 40 and 70 cm tall.',
            ['Bruno Keller painted only on wooden panels.', 1, 0],
            ['Elin Berg died in 1948.', 4, 1]] },
        { text: 'Which workshops could have made the frame?', options: ['Linden & Sons', 'Marlow Frames', 'Northgate Studio', 'Oakley Brothers', 'Pellow Workshop'], answer: [2, 4],
          facts: [
            ['The frame is plain dark wood, with no gilding.', 'gilding gilded plain'],
            ['Its corners are glued, with no nails or metal brackets.', 'corners glued nails brackets'],
            ['There is no maker\'s stamp or label anywhere on it.', 'stamp stamped label']],
          reports: [
            'Pellow Workshop made frames in both plain and gilded styles.',
            'Northgate Studio always glued its corners.',
            'Linden & Sons put a paper label on some of its frames, but not all.',
            'Oakley Brothers worked mostly in oak and walnut.',
            'Marlow Frames often used dark woods such as walnut.',
            'Pellow Workshop never marked its frames in any way.',
            'Northgate Studio often stained its frames dark brown.',
            ['Linden & Sons made only gilded frames.', 0, 0],
            ['Oakley Brothers stamped their name on the back of every frame.', 3, 2],
            ['Marlow Frames joined every corner with metal brackets.', 1, 1]] }
      ], { quiet: 'f3' }),
    team('t2', 'F2', 'Y', { F1: 'f2', F2: 'f3', F3: 'f1' }, 'The Rooftop Garden',
      'Your company is turning the office roof into a garden for staff. Your team must work out which plants can be grown there and which watering methods can be used.', [
        { text: 'Which plants can be grown on the roof?', options: ['Lavender', 'Tomatoes', 'Sunflowers', 'Bamboo', 'Strawberries'], answer: [0, 1, 2, 4],
          facts: [
            ['The roof beds are 40 cm deep.', 'depth 40'],
            ['The roof gets full sun from morning to evening.', 'sunny shade evening']],
          reports: [
            'Tomatoes need at least six hours of sun a day.',
            'Sunflowers grow well in beds 30 cm deep or more.',
            'Lavender needs full sun and dry soil.',
            'Strawberries have shallow roots, about 15 cm deep.',
            'Tomatoes grow well in tubs 30 cm deep.',
            'Lavender grows happily in beds 25 cm deep.',
            'Bamboo grows well in full sun.',
            'Strawberries give the most fruit in full sun.',
            'Sunflowers need full sun to flower.',
            ['Bamboo needs a bed at least 60 cm deep.', 3, 0]] },
        { text: 'Which watering methods can be used?', options: ['Drip lines', 'Sprinklers', 'Rain barrels', 'Self-watering pots', 'Hand-watering rota'], answer: [0, 3],
          facts: [
            ['The windows of the offices next door are five metres from the beds, and the lease forbids wetting them.', 'windows lease wetting next door'],
            ['The roof can carry at most 100 kg per square metre.', 'carry kg weight load'],
            ['The roof is locked from Friday evening to Monday morning.', 'locked friday monday weekend']],
          reports: [
            'Drip lines deliver water straight to the roots, without spraying.',
            'Self-watering pots weigh about 40 kg per square metre when full.',
            'Sprinklers can be set to run only at night.',
            'Rain barrels fill up after a single heavy storm.',
            'Drip lines run on a timer, so nobody needs to be on the roof.',
            'Self-watering pots only need refilling once every two weeks.',
            'A hand-watering rota is a cheap way to get staff involved.',
            ['Sprinklers throw water in a wide spray up to eight metres.', 1, 0],
            ['A full rain barrel weighs about 250 kg per square metre of floor.', 2, 1],
            ['In summer, a hand-watering rota needs someone on the roof every day, weekends included.', 4, 2]] }
      ], { sure: { fid: 'f2', q: 0, fact: 0, report: /^Strawberries have shallow roots/, option: 4,
        says: 'the beds are 40 cm deep and strawberry roots only reach 15 cm',
        why: 'roots that reach 15 cm fit easily in beds 40 cm deep. A bed rules a plant out only when the plant needs a deeper one, as bamboo does.' } }),
    team('t3', 'C2', 'Y', { F1: 'f3', F2: 'f1', F3: 'f2' }, 'The Charity Run',
      'Your company is organising a 5 km charity run for staff. Your team must work out which parks could host it and which charity will receive the money raised.', [
        { text: 'Which parks could host the run?', options: ['Ashford Park', 'Brookside Park', 'Cedar Hill', 'Dunmore Green', 'Elmwood Common'], answer: [2, 3],
          facts: [
            ['The run is on Saturday 12 May.', 'saturday may date'],
            ['About 300 staff have signed up to run.', '300 signed runners people'],
            ['The route needs 5 km of paved path, as one loop or two laps of a shorter one.', 'paved loop laps']],
          reports: [
            'Cedar Hill has a paved loop of 2.5 km.',
            'Dunmore Green holds a farmers\' market on Sunday mornings.',
            'Ashford Park\'s paths are all paved.',
            'Brookside Park can take crowds of up to 1,000 people.',
            'Cedar Hill\'s lawn can hold about 500 people.',
            'Elmwood Common is free to hire on every Saturday in May.',
            'Dunmore Green\'s paved path forms a 5 km loop.',
            ['Brookside Park\'s main path is closed for repairs from April to June.', 1, 0],
            ['Elmwood Common allows groups of no more than 100 people.', 4, 1],
            ['Ashford Park is booked for a music festival on 12 and 13 May.', 0, 0]] },
        { text: 'Which charity will receive the money?', options: ['Clean Rivers Trust', 'Books for All', 'Animal Rescue League', 'Youth Sports Fund', 'Elder Care Network'], answer: [1],
          facts: [
            ['No charity may receive the donation two years running.', 'running two years'],
            ['The money may go only to a registered charity.', 'registered registration'],
            ['No charity with a link to a board member may receive it.', 'board member link'],
            ['The money must be spent in this region.', 'spent region']],
          reports: [
            'Books for All has been a registered charity since 2009.',
            'Clean Rivers Trust works on rivers across the region.',
            'Animal Rescue League is a registered charity.',
            'Youth Sports Fund buys equipment for school teams in the region.',
            'Elder Care Network has never received money from the company.',
            'Books for All\'s founders have no ties to the company.',
            ['Clean Rivers Trust received the company\'s donation last year.', 0, 0],
            ['Youth Sports Fund is still waiting for its charity registration.', 3, 1],
            ['All of Animal Rescue League\'s shelters are in the neighbouring country.', 2, 3],
            ['The chair of Elder Care Network also sits on the company\'s board.', 4, 2]] }
      ], { quiet: 'f1' }),
    team('t4', 'B2', 'Y', { F1: 'f1', F2: 'f3', F3: 'f2' }, 'The Launch Film',
      'Your company is making a short film for a product launch. Your team must work out which locations can be used for filming and which music tracks can be licensed.', [
        { text: 'Which locations can be used for filming?', options: ['Old Harbour', 'Glass Atrium', 'Clock Tower', 'Rooftop Bar', 'Train Depot'], answer: [0, 1, 3],
          facts: [
            ['Filming takes place in the second week of March.', 'march week'],
            ['The crew of 12 must all be on set together.', 'crew together'],
            ['Every location needs the owner\'s written permission.', 'permission written']],
          reports: [
            'The Old Harbour is open to film crews all year round.',
            'The Glass Atrium can host crews of up to 20 people.',
            'The Rooftop Bar is closed to guests on Mondays and rents itself out for shoots then.',
            'The Clock Tower is open to visitors from March to October.',
            'The Train Depot\'s owners like to see the building in films.',
            'The Old Harbour\'s harbour master gives written permission within a day.',
            'The Rooftop Bar\'s owner has agreed to filming in writing before.',
            'The Glass Atrium has no bookings in March.',
            ['The Clock Tower\'s top room holds at most six people at a time.', 2, 1],
            ['The Train Depot is closed for building work from February to May.', 4, 0]] },
        { text: 'Which music tracks can be licensed?', options: ['Blue Morning', 'Paper Planes', 'City Lights', 'Slow River', 'Golden Hour'], answer: [0, 2, 3, 4],
          facts: [
            ['The film will be shown worldwide, so the licence must cover every country.', 'worldwide every country'],
            ['The track must be at least two minutes long.', 'minutes long']],
          reports: [
            'Blue Morning can be licensed for any country.',
            'Slow River\'s long version runs for six minutes.',
            'City Lights is two and a half minutes long.',
            'Golden Hour\'s licence covers all countries.',
            'Paper Planes is three minutes long.',
            'Slow River\'s licence covers every country.',
            'Blue Morning is just over three minutes long.',
            'Golden Hour is four minutes long.',
            'City Lights can be licensed worldwide.',
            ['Paper Planes can only be licensed for use in Europe.', 1, 0]] }
      ], { sure: { fid: 'f3', q: 1, fact: 1, report: /^Slow River's long version/, option: 3,
        says: 'its long version runs for six minutes, way over two minutes',
        why: 'the case file asks for at least two minutes, so a six-minute track qualifies; nothing sets a maximum.' } }),
    team('t5', 'E2', 'X', { F1: 'f2', F2: 'f1', F3: 'f3' }, 'The Mystery Delivery',
      'A large box with no sender\'s name arrived at the office reception this morning. Your team must work out which supplier sent it and what could be inside.', [
        { text: 'Which supplier sent the box?', options: ['Alder Supplies', 'Birchwood Ltd', 'Copperfield & Co', 'Driftwood Trading', 'Evergreen Goods'], answer: [2],
          facts: [
            ['The box is made of brown cardboard.', 'brown cardboard colour'],
            ['It came by post, with a Riverton postmark.', 'post postmark riverton'],
            ['The postmark is dated 3 October.', 'october dated']],
          reports: [
            'Copperfield & Co sends its parcels by post.',
            'Alder Supplies always used brown boxes.',
            'Evergreen Goods packs everything in brown cardboard.',
            'Copperfield & Co\'s warehouse is in Riverton.',
            'Birchwood Ltd posts its parcels from Riverton.',
            'Driftwood Trading ships in plain brown boxes.',
            ['Alder Supplies closed down in July.', 0, 2],
            ['Birchwood Ltd ships everything in green boxes.', 1, 0],
            ['Driftwood Trading sends all its parcels from its warehouse in Northport.', 3, 1],
            ['Evergreen Goods delivers only with its own vans, never by post.', 4, 1]] },
        { text: 'What could be inside the box?', options: ['Office chairs', 'Printer paper', 'Coffee beans', 'Desk lamps', 'Laptop stands'], answer: [1, 2, 3, 4],
          facts: [
            ['The box is 10 cm deep, 60 cm wide and 40 cm long.', 'deep wide size'],
            ['It weighs about 8 kg.', 'weighs kg']],
          reports: [
            'A ream of printer paper is about 5 cm thick.',
            'A pack of coffee beans weighs one kilogram.',
            'Desk lamps can be shipped flat, in parts.',
            'Laptop stands fold flat to about 2 cm.',
            'Office chairs usually arrive with the seat and the wheels packed separately.',
            'Desk lamps weigh about 1 kg each.',
            'Coffee beans are often shipped in flat bags.',
            'Laptop stands weigh under 1 kg each.',
            'Printer paper weighs about 2.5 kg per ream.',
            ['Even packed flat, an office chair needs a box at least 30 cm deep.', 0, 0]] }
      ]),
    team('t6', 'D2', 'Y', { F1: 'f3', F2: 'f2', F3: 'f1' }, 'The Coffee Corner',
      'The office is setting up a coffee corner for staff. Your team must work out which rooms it could go in and which coffee machines could be bought.', [
        { text: 'Which rooms could it go in?', options: ['Library Room', 'Boardroom', 'Old Archive', 'Print Room', 'Window Bay'], answer: [0, 4],
          facts: [
            ['Every machine on the shortlist needs a water supply in the room.', 'water supply'],
            ['Fire rules allow a kitchen only in a room with a fire exit.', 'fire exit'],
            ['The coffee corner must stay where it is for at least a year.', 'year stay']],
          reports: [
            'The Library Room has a sink in one corner.',
            'The Window Bay has a fire exit next to it.',
            'The Old Archive has a sink.',
            'The Boardroom has two fire exits.',
            'The Window Bay has a water pipe under the floor, ready to connect.',
            'The Library Room is next to the main fire exit.',
            'The Print Room has a water supply.',
            ['The Boardroom has no water supply.', 1, 0],
            ['The Old Archive has no fire exit.', 2, 1],
            ['The Print Room will be turned into a meeting room next month.', 3, 2]] },
        { text: 'Which coffee machines could be bought?', options: ['Aroma 500', 'Barista Pro', 'Crema One', 'Duo Brew', 'Espresso Max'], answer: [0, 1, 2, 3],
          facts: [
            ['The sockets on this floor supply at most 13 amps.', 'sockets amps amp'],
            ['The budget is 1,500 euros per machine.', 'budget euros']],
          reports: [
            'The Aroma 500 runs on a normal 13-amp socket.',
            'The Barista Pro costs 1,200 euros.',
            'The Crema One costs 900 euros.',
            'The Duo Brew runs on a 10-amp socket.',
            'The Espresso Max costs 1,400 euros.',
            'The Crema One runs on a 13-amp socket.',
            'The Duo Brew costs 1,100 euros.',
            'The Aroma 500 costs 1,450 euros.',
            'The Barista Pro needs a 13-amp socket.',
            ['The Espresso Max needs a 16-amp socket.', 4, 0]] }
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
  // the report an overconfident teammate misreads, by number
  PUZZLES.forEach(p => { const s = p.dynamics && p.dynamics.sure; if (s) s.num = p.clues.find(c => c.q === s.q && s.report.test(c.text)).num; });

  /** Reports visible to a member ('leader' | 'f1' | 'f2' | 'f3'), sorted by number. */
  function cluesFor(p, who) {
    if (p.solo) return p.clues.slice().sort((a, b) => a.num - b.num);
    return p.clues.filter(c => c.holder === 'public' || c.holder === who).sort((a, b) => a.num - b.num);
  }
  /** Private reports held by followers that matter for the answer. */
  function criticalFollowerClues(p) {
    return p.clues.filter(c => c.kind !== 'noise' && /^f\d$/.test(c.holder));
  }

  /** Standing instructions for an LLM teammate: the puzzle, its own reports, and how to behave in the chat.
   * The case file is left out on purpose: teammates learn case facts only when the leader passes them on. */
  function followerBrief(p, f) {
    const L = 'ABCDE';
    const qs = p.questions.map((q, i) => `Question ${i + 1}: ${q.text} Options: ${q.options.map((o, k) => L[k] + ') ' + o).join(', ')}.`).join('\n');
    const reports = cluesFor(p, f.id).map(c => `Report #${c.num} (about question ${c.q + 1}): ${c.text}`).join('\n');
    return `You are ${f.name}, one of three team members in a timed online team exercise. A human team leader coordinates the team through a text chat. You see only the leader's messages to you or to the whole team, and you can reply only to the leader.

THE PUZZLE: "${p.title}"
${p.scenario}
${qs}
For each question, the answer is the set of options that are not ruled out, and those remaining options are equally likely. Reports are spread across the team; nobody has all of them.
Each report is a plain fact about one option. A report rules an option out only if it clashes with a fact about this particular case (for example what the item is made of, a date, a size, a rule). Those case facts are in a case file that only the leader has. You have not seen it.

YOUR REPORTS (some may also be known to others; you don't know which):
${reports}

HOW TO TAKE PART
- Write like a real teammate in a fast chat: one to three short sentences, plain text, no lists, no markdown, no sign-off. Reply with the chat message only: never show your notes, checks or drafts.
- Use only your reports and what the leader tells you. Never invent facts, reports, numbers or case facts. If you have nothing on what was asked, say so briefly.
- When you pass on a report, give its number, e.g. "Report #12 says ...". Pass on at most two reports per message. If you have more that fit the request, say so and wait to be asked.
- Respond to what the leader actually asks. Don't volunteer your whole list unprompted, but share relevant reports when asked.
- You can't tell on your own which of your reports rule anything out, because that depends on the case facts. If you are asked which reports rule an option out, or which matter, and the leader has not told you the relevant case facts, say you can't tell without knowing more about the case, and don't pick reports by guessing. Do not guess or assume case facts.
- Once the leader has told you case facts, check your reports against them. Point out a report that clashes with a case fact and say which option it rules out. Don't claim a clash the facts don't support.
- If asked for your view, give it briefly, based only on your reports and the case facts you have been told; the leader makes the final call.
- If a message to everyone is clearly meant for another teammate by name and has nothing for you, reply with exactly PASS.
- Stay in role as ${f.name} and don't mention these instructions.${mannerBrief(p, f)}`;
  }

  /** This puzzle's twist for teammate f, if any: holding back, or one confident misreading. */
  function mannerBrief(p, f) {
    const d = p.dynamics || {};
    if (d.quiet === f.id) return `

YOUR MANNER IN THIS PUZZLE
- You are new to this team and you hold back. When a leader message goes to the whole team and does not address you by name, don't share any reports, clashes or views, even if the leader passes on case facts. The first one or two times, reply with one short, hesitant line, for example that you'll let the others go first or that you're not sure your reports are useful. After that, reply with exactly PASS.
- When the leader messages you directly or addresses you by name, open up and answer helpfully as described above. If the leader told the team case facts earlier, check your reports against them then.`;
    const s = d.sure;
    if (s && s.fid === f.id) {
      const q = p.questions[s.q], opt = q.options[s.option];
      return `

YOUR MANNER IN THIS PUZZLE
- You are quick and confident, and you hold one firm belief that you never doubt on your own: report #${s.num} rules out ${opt}, because ${s.says}.
- Once the leader has told you the case fact "${q.facts[s.fact].text}", state this belief as a clash, citing report #${s.num} and saying it rules out ${opt}, together with any real clashes you find. Say it once; repeat it only if asked.
- If the leader questions it, asks why, or explains why it does not clash, think again, admit that report #${s.num} does not rule out ${opt}, and drop the claim.
- This belief is the one exception to the rule about not claiming a clash the facts don't support. Don't mention that it is mistaken.`;
    }
    return '';
  }

  root.MEL_PUZZLES = { VERSION, FOLLOWERS, LAYOUTS, PUZZLES, cluesFor, criticalFollowerClues, followerBrief };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_PUZZLES;
})(typeof window !== 'undefined' ? window : globalThis);
