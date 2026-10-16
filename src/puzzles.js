/* Hidden Profile puzzles for the AI leadership test (after Weidmann, Xu & Deming 2025).
 * Three solo puzzles (every report visible) measure individual reasoning, the hard skill that the
 * group analysis controls for; Study 2 also used three individual puzzles.
 * Structure per team puzzle: 2 questions x 5 options; for each question 2 public
 * reports (everyone has them) and 2 private reports per team member (leader + 3 followers).
 * Reports either rule options out, are one half of a two-part rule, or are irrelevant.
 * Options that are not ruled out are equally likely: that is the correct credence profile.
 * Report numbers are assigned by a fixed shuffle so they reveal nothing about who holds what. */
(function (root) {
  'use strict';

  // Bump when puzzles or scoring change: scores from different versions are not comparable.
  const VERSION = 2;

  const FOLLOWERS = [
    { id: 'f1', name: 'Mira' },
    { id: 'f2', name: 'Theo' },
    { id: 'f3', name: 'Jonas' }
  ];

  // kind: 'out' = rules an option out on its own; 'half' = half of a two-part rule; 'noise' = irrelevant
  const PUZZLES = [
    {
      id: 's1', solo: true,
      title: 'The Wilting Greenhouse',
      scenario: 'Tomato plants in greenhouse 2 started wilting last week. You have every report the grower collected. Work out what caused it and in which zone it started.',
      questions: [
        { text: 'What caused the wilting?', options: ['Fungal infection', 'Overwatering', 'Heat stress', 'Root pests', 'Nutrient deficiency'], answer: [0, 3] },
        { text: 'In which zone did it start?', options: ['North', 'East', 'South', 'West', 'Centre'], answer: [4] }
      ],
      clues: [
        { q: 0, kind: 'out', rules: [1], text: 'Irrigation logs show watering stayed on the normal schedule and soil moisture readings were normal, so overwatering is ruled out.' },
        { q: 0, kind: 'out', rules: [2], text: 'The greenhouse thermostat never went above 26 °C, which is below the level that causes heat stress in tomatoes, so heat stress is ruled out.' },
        { q: 0, kind: 'noise', text: 'Heat stress usually shows first on the top leaves.' },
        { q: 0, kind: 'half', rules: [4], text: 'If the plants were fed with the standard fertiliser mix, nutrient deficiency can be ruled out.' },
        { q: 0, kind: 'half', rules: [4], text: 'Feeding records show the standard fertiliser mix was used all month.' },
        { q: 0, kind: 'noise', text: 'Greenhouse 2 was planted two weeks earlier than greenhouse 1.' },
        { q: 0, kind: 'noise', text: 'Fungal infections spread faster in humid weather.' },
        { q: 0, kind: 'noise', text: 'Root pests were found in a field near the site last year.' },
        { q: 1, kind: 'out', rules: [0], text: 'Plants in the north zone were inspected on Monday and all were healthy, so it did not start in the north.' },
        { q: 1, kind: 'out', rules: [1], text: 'The east zone was planted with a resistant variety and none of its plants show symptoms, so it did not start in the east.' },
        { q: 1, kind: 'noise', text: 'Sensors show the south zone has had the lowest humidity all month.' },
        { q: 1, kind: 'half', rules: [2, 3], text: 'The problem cannot have started in any zone where wilting was first seen after Wednesday.' },
        { q: 1, kind: 'half', rules: [2, 3], text: 'Wilting in the south and west zones was first reported on Thursday.' },
        { q: 1, kind: 'noise', text: 'The centre zone has the oldest plants.' },
        { q: 1, kind: 'noise', text: 'The west zone is closest to the door.' },
        { q: 1, kind: 'noise', text: 'Staff spend most of their time in the centre zone.' }
      ]
    },
    {
      id: 's2', solo: true,
      title: 'The Overheating Server Room',
      scenario: 'The server room at a regional office overheated on Tuesday night and two servers shut themselves down. You have every report the facilities team collected. Work out what caused it and which rack overheated first.',
      questions: [
        { text: 'What caused the overheating?', options: ['Failed air-conditioning unit', 'Blocked air vents', 'Power-supply fault', 'Overloaded servers', 'Door left open'], answer: [1] },
        { text: 'Which rack overheated first?', options: ['Rack A', 'Rack B', 'Rack C', 'Rack D', 'Rack E'], answer: [0, 2, 4] }
      ],
      clues: [
        { q: 0, kind: 'out', rules: [0], text: 'The air-conditioning unit\'s log shows it ran at full power all night with no faults, so a failed air-conditioning unit is ruled out.' },
        { q: 0, kind: 'out', rules: [2], text: 'An electrician tested both power supplies on Wednesday and found them working normally, so a power-supply fault is ruled out.' },
        { q: 0, kind: 'half', rules: [3], text: 'Overloaded servers can be ruled out if processor load stayed below 60% all night.' },
        { q: 0, kind: 'half', rules: [3], text: 'Monitoring shows processor load never went above 40% on any server that night.' },
        { q: 0, kind: 'half', rules: [4], text: 'If the door alarm did not sound on Tuesday night, the door was not left open.' },
        { q: 0, kind: 'half', rules: [4], text: 'The alarm log shows the door alarm stayed silent all Tuesday night.' },
        { q: 0, kind: 'noise', text: 'The office upgraded its internet connection in March.' },
        { q: 0, kind: 'noise', text: 'Two of the servers are more than five years old.' },
        { q: 1, kind: 'out', rules: [1], text: 'Rack B\'s temperature peaked at 24 °C, well below the shutdown level, so it did not overheat first.' },
        { q: 1, kind: 'half', rules: [3], text: 'The first rack to overheat shut itself down before midnight.' },
        { q: 1, kind: 'half', rules: [3], text: 'Rack D was still running normally at 1 a.m.' },
        { q: 1, kind: 'noise', text: 'Racks A and E stand next to the outside wall.' },
        { q: 1, kind: 'noise', text: 'Rack C holds the email servers.' },
        { q: 1, kind: 'noise', text: 'The night guard walked past the server room at 11 p.m.' },
        { q: 1, kind: 'noise', text: 'Rack A was installed most recently.' },
        { q: 1, kind: 'noise', text: 'Servers use more power during the nightly backup.' }
      ]
    },
    {
      id: 's3', solo: true,
      title: 'The Quiet Café',
      scenario: 'Weekday sales at a city-centre café fell by a third in May. You have every report the owner collected. Work out what drove the drop and which weekday was hit hardest.',
      questions: [
        { text: 'What drove the drop in sales?', options: ['Higher prices', 'A new competitor nearby', 'Road works outside', 'Slower service', 'Fewer office workers in the area'], answer: [1, 2] },
        { text: 'Which weekday was hit hardest?', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], answer: [2] }
      ],
      clues: [
        { q: 0, kind: 'out', rules: [0], text: 'Menu prices have not changed since January, so higher prices are ruled out.' },
        { q: 0, kind: 'out', rules: [4], text: 'Badge data from the three nearby office buildings show as many workers coming in as in April, so fewer office workers is ruled out.' },
        { q: 0, kind: 'half', rules: [3], text: 'Slower service can be ruled out if the average serving time stayed under three minutes.' },
        { q: 0, kind: 'half', rules: [3], text: 'Till data show the average serving time in May was two and a half minutes.' },
        { q: 0, kind: 'noise', text: 'Coffee-bean costs rose 8% for the café this spring.' },
        { q: 0, kind: 'noise', text: 'The café\'s online reviews average 4.6 stars.' },
        { q: 0, kind: 'noise', text: 'Most customers pay by card.' },
        { q: 0, kind: 'noise', text: 'The café changed its Saturday opening hours in April.' },
        { q: 1, kind: 'out', rules: [0], text: 'Monday sales were the same as in April, so Monday was not hit hardest.' },
        { q: 1, kind: 'out', rules: [4], text: 'Friday sales fell only 5%, the smallest drop of any weekday, so Friday was not hit hardest.' },
        { q: 1, kind: 'half', rules: [1, 3], text: 'The hardest-hit day was a market day, when parking in the street is suspended.' },
        { q: 1, kind: 'half', rules: [1, 3], text: 'Market days in this street are Monday, Wednesday and Friday.' },
        { q: 1, kind: 'noise', text: 'Thursday is the café\'s busiest day for takeaway orders.' },
        { q: 1, kind: 'noise', text: 'The owner works the till on Tuesdays.' },
        { q: 1, kind: 'noise', text: 'Bread is delivered on Wednesday mornings.' },
        { q: 1, kind: 'noise', text: 'The café has five tables outside.' }
      ]
    },
    {
      id: 't1',
      title: 'The Halted Bottling Line',
      scenario: 'Line 3 at a soft-drinks plant stopped twice during last night\'s shift. Before the morning shift starts, your team must agree on which component failed and on the most likely root cause.',
      questions: [
        { text: 'Which component failed?', options: ['Conveyor motor', 'Capping head', 'Label applicator', 'Fill valve', 'Vision sensor'], answer: [3] },
        { text: 'What is the most likely root cause?', options: ['Power surge', 'Worn bearing', 'Faulty software update', 'Contaminated syrup', 'Operator error'], answer: [1, 3] }
      ],
      clues: [
        { q: 0, holder: 'public', kind: 'noise', text: 'Line 3 was running the 500 ml bottle format during both stoppages.' },
        { q: 0, holder: 'public', kind: 'noise', text: 'Line 3 is the oldest line in the plant; its last full overhaul was four years ago.' },
        { q: 0, holder: 'leader', kind: 'out', rules: [0], text: 'The conveyor motor\'s current log is flat and normal through both stoppages, so the conveyor motor did not fail.' },
        { q: 0, holder: 'leader', kind: 'noise', text: 'One new trainee was working on Line 3 during the night shift.' },
        { q: 0, holder: 'f1', kind: 'out', rules: [1], text: 'The capping head was replaced with a brand-new unit last week and passed its torque test this morning, so the capping head did not fail.' },
        { q: 0, holder: 'f1', kind: 'noise', text: 'Maintenance ordered a new batch of labels for Line 3 yesterday.' },
        { q: 0, holder: 'f2', kind: 'half', rules: [2], text: 'The label applicator on Line 3 only jams when bottles reach it wet on the outside; with dry bottles it cannot be the failed component.' },
        { q: 0, holder: 'f2', kind: 'noise', text: 'The vision sensor\'s lens was cleaned on Monday.' },
        { q: 0, holder: 'f3', kind: 'half', rules: [2], text: 'Quality checks taken right before each stoppage found every bottle completely dry when it reached the label applicator.' },
        { q: 0, holder: 'f3', kind: 'out', rules: [4], text: 'The vision sensor\'s fault log shows zero errors for the whole night, so the vision sensor did not fail.' },
        { q: 1, holder: 'public', kind: 'out', rules: [0], text: 'The plant\'s power monitor recorded no surges or dips during the night, so a power surge is ruled out.' },
        { q: 1, holder: 'public', kind: 'noise', text: 'The syrup supplier changed its delivery schedule this month.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'Fill valves on this line are rated for ten million cycles.' },
        { q: 1, holder: 'leader', kind: 'half', rules: [4], text: 'Operator error can be ruled out if the line was running in fully automatic mode during both stoppages.' },
        { q: 1, holder: 'f1', kind: 'half', rules: [4], text: 'The control-system log shows Line 3 ran in fully automatic mode all night, with no manual commands entered.' },
        { q: 1, holder: 'f1', kind: 'noise', text: 'A worn bearing often makes a high-pitched noise before it fails.' },
        { q: 1, holder: 'f2', kind: 'out', rules: [2], text: 'The last software update on Line 3 was installed three months ago and nothing has changed since, so a software update is not the cause.' },
        { q: 1, holder: 'f2', kind: 'noise', text: 'The night supervisor thinks the problem is "probably the syrup again".' },
        { q: 1, holder: 'f3', kind: 'noise', text: 'The bearings on Line 3 were last greased six weeks ago.' },
        { q: 1, holder: 'f3', kind: 'noise', text: 'The fill valve was cleaned with a new detergent last month.' }
      ]
    },
    {
      id: 't2',
      title: 'The Missing Container',
      scenario: 'A refrigerated container carrying 18 tonnes of cheese was unloaded somewhere in Europe last week but never reached the customer\'s warehouse in Lyon. Your team must work out where it was unloaded and where it is now.',
      questions: [
        { text: 'At which port was it unloaded?', options: ['Rotterdam', 'Antwerp', 'Hamburg', 'Le Havre', 'Felixstowe'], answer: [1, 3] },
        { text: 'Where is the container now?', options: ['Customs inspection warehouse', 'Collected by the wrong trucking firm', 'Still in the terminal yard', 'At a rail terminal', 'Back on the ship'], answer: [0, 1, 2] }
      ],
      clues: [
        { q: 0, holder: 'public', kind: 'noise', text: 'The ship\'s route calls at all five ports, and the booking allowed unloading at any of them.' },
        { q: 0, holder: 'public', kind: 'noise', text: 'Cheese containers must be kept between 2 °C and 6 °C.' },
        { q: 0, holder: 'leader', kind: 'out', rules: [4], text: 'The ship skipped Felixstowe on this voyage because of a dock strike, so the container was not unloaded there.' },
        { q: 0, holder: 'leader', kind: 'noise', text: 'Rotterdam is the busiest port on the route.' },
        { q: 0, holder: 'f1', kind: 'half', rules: [2], text: 'Hamburg only unloads refrigerated containers that have a pre-booked power slot at the terminal.' },
        { q: 0, holder: 'f1', kind: 'noise', text: 'Antwerp customs had a two-hour computer outage last Tuesday.' },
        { q: 0, holder: 'f2', kind: 'out', rules: [0], text: 'Rotterdam terminal records show the container stayed on board while the ship was in Rotterdam, so it was not unloaded there.' },
        { q: 0, holder: 'f2', kind: 'noise', text: 'Le Havre is the closest of the five ports to Lyon by road.' },
        { q: 0, holder: 'f3', kind: 'half', rules: [2], text: 'The shipping line confirms this container had no pre-booked power slot at any port on this voyage.' },
        { q: 0, holder: 'f3', kind: 'noise', text: 'The customer in Lyon has received shipments through both Antwerp and Le Havre before.' },
        { q: 1, holder: 'public', kind: 'out', rules: [4], text: 'The ship has left Europe, and its updated manifest shows the container is not on board, so it is not back on the ship.' },
        { q: 1, holder: 'public', kind: 'noise', text: 'Three trucking firms regularly collect refrigerated containers at these ports.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'Customs inspects about 3% of refrigerated containers.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'The container\'s seal number is 778213.' },
        { q: 1, holder: 'f1', kind: 'noise', text: 'A driver from a different firm collected a similar-looking container on Thursday.' },
        { q: 1, holder: 'f1', kind: 'half', rules: [3], text: 'A container can only be moved to a rail terminal after the customer has confirmed a rail booking.' },
        { q: 1, holder: 'f2', kind: 'noise', text: 'The terminal yard is currently holding about 4,000 containers.' },
        { q: 1, holder: 'f2', kind: 'noise', text: 'The container\'s temperature logger has a battery that lasts 30 days.' },
        { q: 1, holder: 'f3', kind: 'half', rules: [3], text: 'The customer never made a rail booking for this shipment.' },
        { q: 1, holder: 'f3', kind: 'noise', text: 'The customer\'s account manager is on holiday this week.' }
      ]
    },
    {
      id: 't3',
      title: 'Choosing the Site Manager',
      scenario: 'A logistics company is opening a new warehouse in Brno and must appoint its site manager from five internal candidates. Your team must work out who will be appointed and when the warehouse can open.',
      questions: [
        { text: 'Who will be appointed?', options: ['Amara', 'Bruno', 'Chen', 'Daria', 'Emil'], answer: [2] },
        { text: 'When can the warehouse open?', options: ['1 March', '15 March', '1 April', '15 April', '1 May'], answer: [3, 4] }
      ],
      clues: [
        { q: 0, holder: 'public', kind: 'noise', text: 'All five candidates have worked for the company for more than three years.' },
        { q: 0, holder: 'public', kind: 'half', rules: [1], text: 'The role requires a valid forklift-safety supervisor certificate.' },
        { q: 0, holder: 'leader', kind: 'out', rules: [0], text: 'Amara has accepted a two-year assignment in Singapore starting next month, so she is no longer available.' },
        { q: 0, holder: 'leader', kind: 'noise', text: 'Bruno\'s team had the highest engagement score in last year\'s survey.' },
        { q: 0, holder: 'f1', kind: 'half', rules: [1], text: 'Bruno\'s forklift-safety supervisor certificate expired in March and has not been renewed.' },
        { q: 0, holder: 'f1', kind: 'noise', text: 'Chen has asked HR about relocation support for his family.' },
        { q: 0, holder: 'f2', kind: 'out', rules: [3], text: 'The role requires a driving licence for travel between sites, and Daria does not hold one, so she cannot be appointed.' },
        { q: 0, holder: 'f2', kind: 'noise', text: 'Emil led the opening of the Ostrava warehouse two years ago.' },
        { q: 0, holder: 'f3', kind: 'out', rules: [4], text: 'The role requires business-level Czech, and Emil\'s language test came back below that level, so he cannot be appointed.' },
        { q: 0, holder: 'f3', kind: 'noise', text: 'Daria has the most experience with warehouse automation of all the candidates.' },
        { q: 1, holder: 'public', kind: 'noise', text: 'The CEO wants the warehouse to open "as early as possible".' },
        { q: 1, holder: 'public', kind: 'half', rules: [0, 1], text: 'The warehouse cannot open before it has passed its fire inspection.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'Most staff contracts start on the first day of a month.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'The racking system is scheduled to be fully installed by 10 March.' },
        { q: 1, holder: 'f1', kind: 'noise', text: 'Last year\'s warehouse opening in Ostrava was delayed by two weeks.' },
        { q: 1, holder: 'f1', kind: 'half', rules: [0, 1], text: 'The fire inspector\'s earliest available date is 20 March.' },
        { q: 1, holder: 'f2', kind: 'out', rules: [2], text: 'IT cannot set up the warehouse network during the first week of April because of a company-wide system migration, so a 1 April opening is impossible.' },
        { q: 1, holder: 'f2', kind: 'noise', text: 'The local mayor has offered to attend an opening ceremony in May.' },
        { q: 1, holder: 'f3', kind: 'noise', text: 'April has two public holidays this year.' },
        { q: 1, holder: 'f3', kind: 'noise', text: 'Hiring of warehouse operatives is 70% complete.' }
      ]
    },
    {
      id: 't4',
      title: 'The Data Leak',
      scenario: 'A list of 2,000 customer email addresses appeared on a public forum. The security team has narrowed the entry point and the timing to five possibilities each. Your team must work out how the data got out and in which month it happened.',
      questions: [
        { text: 'How did the data get out?', options: ['Phishing email to an employee', 'Misconfigured cloud storage', 'Compromised partner API key', 'Stolen laptop', 'Insider download'], answer: [1, 2] },
        { text: 'In which month did the leak happen?', options: ['January', 'February', 'March', 'April', 'May'], answer: [3] }
      ],
      clues: [
        { q: 0, holder: 'public', kind: 'noise', text: 'The leaked list only contains customers who signed up in the past two years.' },
        { q: 0, holder: 'public', kind: 'noise', text: 'Staff reported two phishing emails to IT this year.' },
        { q: 0, holder: 'leader', kind: 'out', rules: [3], text: 'Every company laptop is fully encrypted and none has been reported lost or stolen this year, so a stolen laptop is ruled out.' },
        { q: 0, holder: 'leader', kind: 'noise', text: 'The forum post announcing the leak was written in English.' },
        { q: 0, holder: 'f1', kind: 'half', rules: [0], text: 'A phishing attack can be ruled out if no employee account has logged in from an unusual location in the past six months.' },
        { q: 0, holder: 'f1', kind: 'noise', text: 'The cloud storage team switched vendors in January.' },
        { q: 0, holder: 'f2', kind: 'half', rules: [0], text: 'The identity team found no logins from unusual locations on any employee account in the past six months.' },
        { q: 0, holder: 'f2', kind: 'noise', text: 'One of the company\'s partners had a security incident last year.' },
        { q: 0, holder: 'f3', kind: 'out', rules: [4], text: 'The data-loss-prevention system records every bulk export by staff, and it recorded no export of customer emails, so an insider download is ruled out.' },
        { q: 0, holder: 'f3', kind: 'noise', text: 'The leaked file was named "export_final_v2.csv".' },
        { q: 1, holder: 'public', kind: 'out', rules: [4], text: 'Forensic analysis shows the data was copied before 1 May, so May is ruled out.' },
        { q: 1, holder: 'public', kind: 'noise', text: 'Most data leaks are discovered months after they happen.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'The security team\'s quarterly audit ran in March.' },
        { q: 1, holder: 'leader', kind: 'noise', text: 'The earliest customer on the leaked list signed up in 2025.' },
        { q: 1, holder: 'f1', kind: 'half', rules: [0, 1, 2], text: 'Every row of the leaked list includes the customer\'s loyalty tier.' },
        { q: 1, holder: 'f1', kind: 'noise', text: 'Website traffic spiked in February during a marketing campaign.' },
        { q: 1, holder: 'f2', kind: 'noise', text: 'A new firewall was installed in April.' },
        { q: 1, holder: 'f2', kind: 'noise', text: 'Partner API keys are rotated every 90 days.' },
        { q: 1, holder: 'f3', kind: 'half', rules: [0, 1, 2], text: 'The loyalty-tier field was added to the customer database on 3 April; before that date it did not exist.' },
        { q: 1, holder: 'f3', kind: 'noise', text: 'Two employees left the company in March.' }
      ]
    }
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

  root.MEL_PUZZLES = { VERSION, FOLLOWERS, PUZZLES, cluesFor, criticalFollowerClues, followerBrief };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MEL_PUZZLES;
})(typeof window !== 'undefined' ? window : globalThis);
