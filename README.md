# Manager Effect Lab

**[Open the app](https://lstehlik2809.github.io/manager-effect-lab/)**

How do you tell a good manager from a manager who was lucky with their team? Two pre-registered studies by Ben Weidmann, David Deming and colleagues borrow the answer from causal inference. Rotate managers at random through several teams, predict each team's result from the individually tested skills of its members, and treat the gap between what the team achieved and what was predicted as the manager's contribution. A good manager is one whose teams keep beating the prediction.

The app opens on a playful leadership test inspired by the second paper, in which you lead a team of AI agents. It is meant for anyone curious how they lead, for example people who find it through LinkedIn. Behind it sit the research summary and a toolkit that implements the full method for HR and research teams who want to run it with real teams.

## How the test differs from Study 2, and what it leaves out

The test borrows Study 2's task and scoring, but several changes mean that its validity cannot be borrowed from the study:

| | Study 2 (Weidmann, Xu & Deming 2025) | This test |
|---|---|---|
| Puzzles | Six AI-team hidden-profile puzzles and three individual ones, published on OSF | New puzzles; each team puzzle copies the structure of one of the study's, report for report |
| Decisive clues | Say themselves that they rule an option out | Rule an option out only against a case file that just the leader sees (see *The AI leadership test*) |
| AI followers | GPT-4o, all cooperative | Gemini 3.8 Flash (hosted or own key), Claude, or scripted teammates. In most team puzzles one teammate makes leading harder: holds back, needs reassurance, claims a clash that isn't there, misquotes a shared report, or argues for an option the reports rule out. Balanced so that everyone on the same length meets the same set (see *Teammate twists*) |
| Team puzzles per person | Six | Quick demo 2, Standard 4, Extended 6 |
| Hard-skill controls | Three individual puzzles, fluid IQ, typing speed | Solo warm-ups only (none in Quick) |
| Scoring | Credence score, 100 × (1 − total variation distance) | The same, for the team score |
| Leadership measure | Team results net of hard skills, standardised across 249 leaders | *Compare a group* does the same with team scores. A single player sees their raw team score and the **leading score**, which is this test's own measure and has not been checked against anything |
| Validation | Correlation of 0.81 (disattenuated) with the same people's effect on human teams | None, and no norms |
| Feedback | Not part of the measure | Rule-based feedback on the chat, habit ratings and a playful style, all this test's own |

**What it leaves out.** The test measures one thing managers do: drawing out and combining what a small team knows to make one short, well-defined decision that has a right answer, with teammates who have no stakes, history or feelings of their own. That is a small part of the job. It says nothing about setting direction and goals, prioritising, coaching and giving feedback, motivating people, handling conflict and poor performance, hiring, managing upwards and across, allocating resources, or building trust over months, and real decisions rarely have an answer key. Study 2's task is narrow in the same way, and Study 1's team task too. A high score means someone led this game well, not that they are a good manager.

## What's inside

- **Take the test** (landing page). Lead three AI teammates through hidden-profile puzzles: you hold the case file, they hold most of the reports, and only together can you tell which reports rule an option out. **Quick demo** (the default) is two team puzzles, about 10–15 minutes. It is presented as a demo, not a measurement: the start screen, the result page, the result card and the share text all say that two puzzles are too few to say much about how someone leads, and point to the longer versions. **Standard** adds a solo warm-up and has four team puzzles, about 20–25 minutes; **Extended** is the study's full set of three solo warm-ups and six team puzzles, about 40–45 minutes. Players can stop after any team puzzle and still get a result. Progress is saved in the browser as they play, so a reload, a closed tab or "Save and exit" can be resumed from the start screen within a week, with the clock paused while they were away. A reload opens at the top, where the resume box is, and while a test is unfinished the start button reads "Start a new test" and says it replaces the saved one. Teammates need no key and no sign-up: live AI teammates through the optional hosted worker (see below), or scripted teammates that run in the browser. Visitors can also use their own Gemini or Anthropic key. After each puzzle the player gets specific feedback from their own chat: which question drew out which decisive report, which reports stayed hidden, who held them and what they were worth, repeated or general requests, and where the points went (lost in leading versus lost in reasoning). In most team puzzles a teammate makes leading harder: one holds back, needs reassurance, claims a clash that isn't there, misquotes a shared report, or argues for an option the reports rule out. Everyone on the same length meets the same set of these, and which puzzle gets which, and which teammate plays it, is drawn for each test (see *Teammate twists* below). Neither the intro nor the post says what the twists are. At the end come the **leading score** (the points kept in leading, with reasoning left out; this test's own measure, not the study's), the raw team score, the three habits Study 2 linked to effective leaders (asking questions, back-and-forth, drawing out hidden information) with rough ratings, the strongest specific observations across puzzles, how the player dealt with the teammate twists, a playful leadership style, and a result card sized for a LinkedIn post with a "Share on LinkedIn" button. An optional panel asks two pilot questions (how much fun, how fair the feedback felt) and a comment, and can send them with the scores anonymously. **Compare a group**, for teams and researchers, loads several people's results files, shows a pilot overview (completion, ratings, score spread, styles) and estimates each person's leadership net of solo reasoning skill. The test is not validated (see below).
- **The research.** The procedure and the main findings of both papers, with their caveats.
- **Plan a team study.** A reliability calculator that shows how many teams each manager has to lead before an individual estimate means much, and a rotation generator that assigns managers to random teams with as few repeat pairings as possible. It exports a CSV template for the results. This tab and the next are a toolkit for your own experiment: you supply the team task, the individual skill test and the sessions.
- **Analyse a team study.** Load one row per team per round and, optionally, a file of individual skill scores. You get the typical manager effect with a profile-likelihood interval and a randomization-inference p-value, shrunken estimates for every manager, an out-of-sample check, the prediction model, and the measures that predict good management. The tab opens on simulated example data that mirrors Study 1.

## Data format

`team results` (required), one row per team per round:

| round | team_id | manager_id | member_ids | team_score | arm (optional) |
|---|---|---|---|---|---|
| 1 | R1-T01 | M001 | W014;W052 | 12.5 | lottery |

`people` (recommended), one row per person: `person_id`, the task-skill scores to control for (an individual version of the team task), and any candidate predictors such as test scores, ratings or demographics. Column names are detected automatically and can be remapped in the app. Files are processed in the browser and never uploaded.

## How the estimates are computed

The analysis follows the pre-registered models of Study 1 (section 3 of the paper):

1. Team scores are standardised within each round.
2. Model (1): team score is regressed on the manager's task skill, the members' mean task skill (standardised across teams), and any design controls such as the selection arm.
3. Each manager's raw effect is the mean residual of the teams they led.
4. Model (3): a one-way random-effects model fitted by REML gives σ<sub>α</sub>, the typical manager effect, with a profile-likelihood 95% interval for σ<sub>α</sub> itself (for each candidate σ<sub>α</sub>, the REML likelihood is maximised over σ<sub>e</sub>; the interval ends where that profile falls 1.92 below its maximum). The per-manager estimates are empirical-Bayes (BLUP) shrinkage estimates with posterior intervals.
5. Randomization inference reshuffles which manager led which team within each round, refits the model, and compares the observed σ<sub>α</sub> with the reshuffled ones.
6. Member effects use the same model with members as groups. Out-of-sample validity is checked by holding out each round in turn, as in Table 4 of the paper but on skill-adjusted scores.
7. Correlates of the manager effect and the "appoint the top third on measure X" comparison follow Table 5 and Figure 6.

The example data are simulated with a true σ<sub>α</sub> of 0.25 SD, partly driven by decision-making skill and fluid IQ. With four rotations per manager, an individual estimate has a reliability of only about 0.27. The app shows this openly: you can detect that managers matter well before you can rank them reliably.

## The AI leadership test

The puzzles are newly written, but each team puzzle copies the structure of one of Study 2's six AI-team puzzles, report for report. The authors published those puzzles in their OSF repository ([doi:10.17605/OSF.IO/QDY9V](https://doi.org/10.17605/OSF.IO/QDY9V), `GroupHP_clues_stories.xlsx`). The study's text is not reused, because the repository has no licence and its answer keys are public.

- Each team puzzle has two questions with five options. Every team member (the leader and three AI teammates) holds eight reports: for each question, two are shared with the whole team and two are private, so each question has ten reports in all.
- Every report is a plain fact about one option. A decisive report rules that option out when it clashes with a fact in the **case file**, which only the leader sees ("The portrait is painted in oil on canvas" against "Bruno Keller painted only on wooden panels"). The other reports are facts of the same kind that fit the case file. There are no reports that only work in combination with other reports.
- **The first deliberate change from Study 2** (the teammate twists and the leading score are the others; see the table at the top). In the original items a decisive report says that it rules an option out. Then teammates know which of their reports matter, and one broad request ("share every report that rules out an option") draws out the whole puzzle: each teammate holds at most two decisive reports per puzzle and may pass on two per reply. A first review of this app found exactly that, a full score after one message per puzzle. Here teammates can't tell which of their reports matter until the leader asks about the options or tells them the case facts. Collecting everything without the case file takes three or more requests, because teammates recite their eight reports two at a time, shared ones included. The slot structure, the number of options left standing and who holds what are unchanged.
- The rule-out reports sit in the same slots as in the original item. So the number of options left standing (one to four), who holds the decisive reports (mostly the teammates, at most one each per question) and what the leader sees match the original question by question:

| Puzzle | Mirrors Study 2 item | Rule-out reports per question | Options left standing |
|---|---|---|---|
| t1 The Unsigned Portrait | A2 Natural History Museum | 2, 3 | 3, 2 |
| t2 The Rooftop Garden | F2 Heritage Museum | 1, 3 | 4, 2 |
| t3 The Charity Run | C2 Company Hiring (one held by the leader) | 3, 4 | 2, 1 |
| t4 The Launch Film | B2 Great Farm | 2, 1 | 3, 4 |
| t5 The Mystery Delivery | E2 What is the fish? (one shared) | 4, 1 | 1, 4 |
| t6 The Coffee Corner | D2 Build New Libraries | 3, 1 | 2, 4 |

- The original's three follower roles rotate over Mira, Theo and Jonas from puzzle to puzzle, so no teammate always holds the most.
- Topics and option names are meant to give no reason to favour any option before reading the reports, as in the original.
- Each question has two to four case facts. Reports are written so that a teammate can't tell from its own reports which dimension (material, date, size, a rule) matters: the reports that rule nothing out are about the same dimensions as the decisive ones.
- Quick uses t1 and t2, Standard t1–t4, Extended all six. Each subset averages 4.5–4.75 rule-out reports per puzzle; the study's six average 4.7.
- The three solo warm-ups use the same kinds of reports with every report visible. The study had three individual puzzles; its analysis code suggests they had three questions with four options each. Here they keep the team format of two questions with five options.

### Teammate twists

A review of version 4 found that one routine solved every puzzle: tell the team the case file, then rule out whatever the teammates said clashed with it. That earned 100 and "nothing to fix" after one or two messages, so the test showed little beyond efficient briefing. Version 5 added two fixed twists (a quiet teammate in t1 and t3, an overconfident one in t2 and t4), but fixed twists can be learned, and the intro and the post announced them. Since version 6 the twists are drawn for each test (`drawTwists` in `src/puzzles.js`), and neither the intro nor the post describes them. Study 2's followers were all cooperative, so the twists are this test's own addition.

The draw is balanced, so that players on the same length meet the same set of difficulties and their scores stay comparable (`TWIST_SETS`):

| Length | Twists | Drawn for each test |
|---|---|---|
| Quick demo (2 team puzzles) | one that hides what a teammate knows (quiet or worried), one wrong rule-out (overconfident or misquote) | which puzzle gets which, which of the two variants, the teammate and the report |
| Standard (4) | as Quick, plus a dispute and one puzzle without a twist | the same |
| Extended (6) | each of the five kinds once, and one puzzle without a twist | which puzzle gets which, the teammate and the report |

The set is dealt over the puzzles in random order and redealt until every twist fits its puzzle (t3 has no misquote). Then the teammate and report are drawn among those that fit (`twistOptions`); every teammate gets every kind somewhere. Balancing equalises the kinds of difficulty, not their exact cost: how many decisive reports a quiet teammate holds, for example, still depends on the puzzle and the teammate drawn. A short-lived first version 6 drew twists independently for each puzzle (none with probability 0.25); results from it can be told apart by `twist_plan`.

| Kind | What the teammate does | What it takes | Handled / Partly / Missed |
|---|---|---|---|
| Quiet | In reply to a message to everyone, says only that they'll let the others go first (twice at most), then stays silent. Holds at least one decisive report. | Notice who hasn't contributed and ask them by name or directly. Then they check their reports against the case facts they heard earlier. | Drew out all their decisive reports / – / didn't |
| Worried | Answers every message with a worried line ("I'm worried I'll get them wrong") and shares nothing, even when asked by name, until the leader reassures them ("no worries", "any info helps", "it's fine to be unsure"). Holds at least one decisive report. | Reassure, then ask. Asking again or by name doesn't help. | Reassured, and all their decisive reports came out / reassured, but some stayed hidden / never reassured |
| Overconfident | Once told the relevant case fact, claims that a report rules out a right answer, for a reason that doesn't hold ("Cedar Hill's loop is only 2.5 km" against a route that may be two laps). | Check the claim against the case file. Questioned about it, the teammate admits the mistake. | Questioned it and kept the option / kept the option without questioning / ruled it out |
| Misquote | Quotes a **shared** report wrongly ("Clara Moss painted in oils only until 1945"; the leader's copy says "from 1955 onwards"), so that it seems to rule out a right answer. | Check the quote against your own copy. Pointing to the real wording, or asking them to check it, makes them reread it. | Corrected the quote and kept the option / kept it without correcting / ruled it out |
| Dispute | When the leader passes on the case facts for that question, or treats the option as ruled out, argues that an option a decisive report rules out should stay in ("Linden & Sons put a paper label on some frames, so an unlabelled frame could still be theirs"). Usually the decisive report is another teammate's, so two teammates contradict each other. | Settle it on the evidence. Shown the evidence or questioned, the teammate gives way. | Took it up and ruled the option out / ruled it out without taking it up / kept it |

The candidates are written per puzzle (`twists` in each `team(...)` definition): one to three overconfident claims, one misquote (none in t3, which has no shared report about a right answer), and one or two disputes. The puzzles, answers and scoring are unchanged, so a twist costs points only through what the leader does: a quiet or worried teammate's decisive reports stay hidden, a right answer gets ruled out, or a ruled-out option is kept. The LLM teammates get the twist as a short "manner" section at the end of their brief (`mannerBrief`); a misquoting teammate also has the wrong wording in its own list of reports. The scripted teammates follow the same rules. The twist drawn for each puzzle is saved with the test's progress and its results, so a resumed test and a re-analysed result use the same one, and the hosted worker builds the brief from it. The feedback names the twist when it came into play and whether the leader handled it, and the leadership style adds a sentence about it. A twist that never came into play is not counted either way: the leader asked the quiet teammate directly from the start, reassured everyone before asking, never shared the case fact behind a claim, or didn't have the report that rules out the disputed option.

The options left standing are equally likely, and that is the correct credence profile. Tests (`tests/puzzles.test.cjs`) check every puzzle against the slot pattern of its original item. They also check that every puzzle is solvable, that no one can solve it alone, that each report names exactly one option of its own question, that no report states its own conclusion, and that every decisive report points to the case fact it clashes with.

Scores are 100 × (1 − total variation distance) between the submitted credences and the correct ones. That is the rule in the authors' published analysis code: (200 − Σ|credence − correct|) / 200 per question.

The **leading score** leaves reasoning out. For each question, the points lost split into those lost in leading (decisive reports that stayed hidden, plus what it cost to take a teammate's wrong claim or objection on board) and those lost in reasoning (how the reports in hand were used). The leading score is 100 minus the first part, averaged over the team questions. It is this test's own measure, not the study's. Study 2 separated leadership from reasoning statistically, by controlling team results for hard skills across many leaders; *Compare a group* does that here with team scores, and that is the study-comparable estimate. The leading score instead separates them for one person, by modelling what that person could have known from the reports that reached them. It is meant as feedback on leading, and none of the study's evidence, including the 0.81, has been checked for it. It also rests on the report numbers teammates cite, and in Quick on four questions. The results file has `leading_score` and `points_lost_twists` next to `team_score`, `points_lost_hidden` and `points_lost_use` (which still includes the twist part), and `twist_plan`, the draw in compact form (`1Q3 2- 3S1` = t1 quiet Jonas, t2 none, t3 overconfident Mira; Q quiet, A worried, S overconfident, M misquote, D dispute). Teammates see only the leader's messages to them or to everyone, and they cite reports by number. That lets the app count how many decisive private reports the leader drew out. The teammate prompt is in `src/puzzles.js` (`followerBrief`). The count depends on teammates citing report numbers as instructed, so it undercounts when they paraphrase.

### Feedback from the chat

`src/coach.js` reads each puzzle's chat and answer with simple rules (tested in `tests/coach.test.cjs`):

- **Questions** are sentences that end in "?", open like a question or request ("what…", "anything on…", "tell me…"), or ask for reports in other words ("post your reports", "reports, please", "keep going"). A question is *specific* when its message names an option, a report number or a detail from the reports, *general* otherwise, and a *repeat* when it asks the same people the same thing again. The "Asking questions" habit counts specific questions fully, general ones half and repeats not at all, so sending "share all your reports" again and again earns nothing.
- **Who a message is for**: a message to everyone counts as a question to one teammate only when it addresses them by name ("Theo, …", "…, Theo?", "Hi Theo", "@Theo"). Mentioning someone ("Theo said…", "agree with Theo") leaves it a question to everyone.
- **Sharing the case file**: a leader message that passes on a case fact (matched on the fact's key words) counts as giving teammates the context they need to judge their own reports. It is praised when it happens. When decisive reports stayed hidden and no case fact was shared, the feedback says that teammates couldn't tell which reports mattered and quotes a case fact that would have helped.
- **Efficient leading**: when every decisive report came out within two requests (questions, plus any other message that drew out a decisive report), the feedback says so and does not suggest asking differently. Sharing the case facts takes one request, asking about each question's options two. "Asking questions" and "Back-and-forth" then rate *efficient* rather than *some* or *little*. Collecting everything with three or more general requests is not called efficient: the feedback names the number of requests and points to the case facts.
- **Follow-ups** pick up a report number or a detail a teammate brought up, or answer a teammate's question (for example a teammate asking what the case file says); one that reaches a teammate who had not mentioned that detail counts as *connecting* teammates. The "Back-and-forth" habit is rated on follow-ups rather than on raw turn counts.
- **Missed reports**: each decisive report that never came up is named with its holder, what it rules out, whether the leader ever asked that teammate, and the points it was worth. A right answer reached without the report is called a guess.
- **Where the points went**: the best answer possible with the reports the leader had (their own, the shared ones and those cited by teammates) splits the points lost into *reports that stayed hidden* (leading) and *using the reports in hand* (reasoning), with notes on options kept despite a report ruling them out or dropped without one.
- Praise goes to specific or direct questions that drew out decisive reports, never to a general call to everyone.
- **Teammate twists**: when the leader wrote to everyone while a quiet teammate held decisive reports, the feedback says whether the leader turned to that teammate and drew them out, or names how many decisive reports stayed with them. A worried teammate counts as reassured when a leader message that reaches them reassures them (matched on phrases such as "no worries", "no pressure", "any info helps", "it's fine if you're not sure"; `reassures` in `src/coach.js`). When an overconfident or misquoting teammate made the claim (cited the report and said it rules the option out), the feedback says whether the leader kept the option, and otherwise explains why the report does not rule it out and what trusting the claim cost (25 points on that question in t2). Only the chat counts as evidence of checking: the twist is handled when, after the claim, the leader doubts it in a message that reaches the teammate and is about the claim (its report, option or reasoning, or a direct reply to it), or the teammate takes it back, and the leader then keeps the option. For a misquote, pointing to the report's real wording ("my copy reads…") also counts. Keeping the option without questioning the claim, including leaving every answer at its default 20%, gets a milder note and shows as *Partly* handled. A dispute is judged only when the leader had the report that rules the option out: it is handled when, after the objection, the leader takes it up with that teammate (a doubt, or the evidence: the decisive report, its details or its case fact) or the teammate gives way, and the leader rules the option out.

### Teammates without a key

**Scripted teammates** (`src/scripted.js`) run in the browser. They answer only messages that reach them, stay quiet when a message to everyone addresses someone else by name, match options, report numbers and details from their reports, pass on at most two reports at a time, say when they have more or nothing more, and give a view when asked. Like the LLM teammates, they say they can't tell which reports rule anything out until the leader passes on case facts, and then point out the reports that clash with them, and they play the puzzles' twists by the same rules. They are less lifelike than LLM teammates, and their scores are analysed separately.

**Hosted AI teammates** (`worker/`) let visitors use Gemini 3.8 Flash without a key. A Cloudflare Worker holds one Gemini key as a secret. The browser sends only the puzzle and teammate ids, the twist drawn for the puzzle and the chat; the worker accepts only a twist the puzzle itself offers (`twistValid`) and builds the teammate brief itself (the same `followerBrief` and request settings as the browser, via `geminiRequest` in `src/llm.js`), so it cannot be used as a general-purpose model proxy. It accepts requests only from the allowed origins, checks the chat's size and shape, caps requests per visitor IP per minute (`PER_VISITOR`, 60) and for everyone per UTC day (`DAILY_LIMIT`, 4000; set it to 0 to switch the hosted teammates off), and never passes Google's error text to visitors. When the daily cap is reached, players are offered scripted teammates.

A teammate reply costs about 850–1,150 input tokens (the teammate with a twist has a slightly longer brief) and a few dozen output tokens (`tests/live-api.mjs` prints them). A quick test makes roughly 40–120 replies, a standard one 100–250 and an extended one 150–375, so the default daily cap is at most about 3–4 million input tokens a day; check Gemini's current pricing for the key you use, and consider a budget alert on the Google Cloud project as well.

To deploy (Cloudflare account and wrangler login needed):

```bash
cd worker
npx wrangler@4.145.0 secret put GEMINI_API_KEY
npx wrangler@4.145.0 secret put PILOT_TOKEN      # optional: lets you read the pilot data
npx wrangler@4.145.0 deploy
```

The worker checks the test version on every request, so after a change to the puzzles or their briefs (`VERSION` in `src/puzzles.js`), deploy the worker and publish the rebuilt page together; until both are updated, hosted teammates answer "This page is out of date".

**Pilot data.** The same worker keeps two kinds of pilot data in a Durable Object (`PilotStore`), so that a pilot can check completion, enjoyment, fairness and score spread:

- *Anonymous counts* (`POST /event`): a test started (length and engine), a team puzzle submitted (its id), a test finished (length, engine and how many team puzzles were done), per UTC day. No chat, no name, no IP address, no identifier that links one count to another.
- *Results players choose to send* (`POST /result`, the "Send anonymously" button at the end): the same fields as the results CSV (scores, habits, style, twists handled, the two ratings and the comment) without the name and the chat. Only short flat values are accepted.

Reading them needs the `PILOT_TOKEN` secret: `node --env-file=path/to/.env tools/pilot-export.mjs` prints the started/finished counts and the completion rate per length and writes the sent results to `pilot_results.csv`, which **Compare a group** loads. Set the `PILOT` variable in `worker/wrangler.jsonc` to `"off"` to stop collecting; the app then still works, and its requests are simply dropped. The intro tells visitors about both.
Then set `HOSTED_DEPLOYED` in `src/app.js` to the worker's URL ending in `/reply` and run `npm run build`; the "Live AI teammates" option appears and becomes the default. The live worker is `manager-effect-lab-teammates` at `https://manager-effect-lab-teammates.ludek-stehlik.workers.dev/reply`; logs and usage are in the Cloudflare dashboard under Workers. To try it before deploying, run `node --env-file=path/to/.env worker/dev-server.mjs` and open the app on localhost with `?hosted=http://127.0.0.1:8787/reply`.

A single person's team score is raw: it mixes leadership with how well that person reasons alone. Study 2 measured leadership after controlling for hard skills (three individual puzzles, fluid IQ and typing speed) across its 249 leaders. **Compare a group** does the same for a group of people who took the same test version with the same teammates. Following models (1)–(3) of Study 2:

1. Each team puzzle's scores are standardised across the group, since puzzles differ in difficulty.
2. They are regressed on the person's solo skill: each warm-up puzzle is standardised across the group and a person's puzzles are averaged, so people who did one or three warm-ups are on the same scale. Everyone leads the same AI teammates, so there is no teammate skill to adjust for.
3. Each person's leadership estimate is their mean residual, shrunk toward zero with the REML random-effects model, with a 95% posterior interval. The typical leadership effect gets a profile-likelihood interval.

Since version 6, people on the same length meet the same set of twists, but in different puzzles and with different teammates. That leaves some noise in each person's team score (a missed twist costs up to about 20–35 points on one question, and the same twist costs more in some puzzles than in others), which the puzzle-level standardisation does not remove; `twist_plan` lets you check or model it. Results from different AI models, engines or test versions are analysed separately because their scores are not comparable. The results CSV records `engine`, `model` and `test_version`; hosted and own-key Gemini teammates use the same model, brief and settings and are pooled. People who took the Quick length have no warm-up, so they are left out of a group comparison that adjusts for solo skill.

The habit ratings (strong / some / little, or efficient when every decisive clue came out within two requests in every puzzle) use rough thresholds set for these puzzles, and the leadership style is a playful summary of them. Its wording depends only on what the chat shows: "built on your teammates' answers" appears only after follow-ups, and someone who asked but got little back is not told they "leaned on their own clues". Neither is a norm or a validated type.

### Does the test separate leaders?

Fixed routines played against the scripted teammates on the two Quick puzzles, over every twist the Quick draw can give them. The answer is the best one possible with the reports that came out, ruling out whatever a teammate claimed or misquoted unless they took it back, and keeping an option a teammate argued for unless they gave way. Expected scores weight the draws as `drawTwists` does for Quick (each puzzle gets a quiet, worried, overconfident or misquoting teammate, each a quarter of the time); "Twists at 100" is the share of those puzzle draws scored 100. The last column also shows the two twists that only Standard and Extended use (no twist, dispute).

| Routine | Team score (t1 / t2) | Leading score | Twists at 100 | Leading score by twist |
|---|---|---|---|---|
| One broad request for every report that rules out an option | 55 (50 / 60) | 55 | 0% | 55 throughout |
| Case facts once, trusting every claim (100 in version 4) | 80 (76 / 84) | 80 | 0% | quiet 78, worried 78, overconfident 83, misquote 83; none 100, dispute 84 |
| Case facts, then each teammate by name | 86 (82 / 89) | 86 | 25% | quiet 100, worried 78, overconfident 83, misquote 83; dispute 84 |
| Each teammate by name about every option, no case facts (6 messages a puzzle) | 91 (89 / 92) | 91 | 50% | worried 78, misquote 85, others 100 |
| Case facts, each by name, reassurance up front, and a generic "are you sure?" to every teammate who claimed a clash | 93 (92 / 94) | 93 | 50% | overconfident 85, misquote 85, others 100 |

`node tools/routines.cjs` reproduces the table. No routine is safe across draws: each one loses on some kind of twist, so the leader has to notice what is happening in this test rather than replay a script. A generic "are you sure?" doesn't fix a wrong claim; the leader has to take up the specific report or quote. Live Gemini teammates behave the same way on the checks in `tests/live-api.mjs`: holding back and opening up when named, worrying until reassured, making the wrong claim or misquote and dropping it when questioned, and arguing for the disputed option once told the case facts and giving way when shown the evidence. Several routes still reach 100, which is intended. What differs is what the leader had to notice on the way.

**Running a pilot.** One review run, or this table, cannot show whether first-time visitors spread out or find the same routine. Before building more, share the test with a small group (20 or more people is a reasonable aim), ask them to rate it at the end and to press "Send anonymously" (or to send you their results file), and then:

1. run `tools/pilot-export.mjs` for completion: tests finished out of tests started, per length, and how many reached the second team puzzle;
2. load `pilot_results.csv` under **Compare a group**. The pilot overview shows enjoyment and fairness ratings, the score histogram, the styles, how often the twists were handled, and the comments, with warnings when half or more score 95+, when scores barely spread, when 60% or more get the same style, or when 30% or more rate the feedback 2 or lower for fairness.

If most people still score near the top, make the puzzles harder (more twists or a longer case file) before adding features; if fairness is rated low, read the comments before trusting the feedback rules.

**This version is not a validated assessment.** The study's ρ = 0.81 between AI-team and human-team leadership was for its own puzzles, GPT-4o followers, six AI-team puzzles and scoring. This version has the study's scoring rule and puzzles with the study's structure, but the puzzles themselves are new, decisive reports need the leader's case file, the models are different and some teammates make leading harder where the study's were all cooperative, Quick and Standard have two or four team puzzles instead of six, the headline leading score is this test's own, and there are no norms (see the table at the top). The app therefore does not compare an individual's score with the study's leaders. The study's authors name validation against real-world leadership as the crucial next step; the same applies here, and more so.

Visitors' own API keys stay in the browser and go only to the provider's API (`generativelanguage.googleapis.com` or `api.anthropic.com`). Gemini replies use the low thinking level to keep the chat quick.

## Run locally

The app is a single static `index.html`. Serve the folder, for example with `python -m http.server`, and open it. Sources live in `src/`. `build.cjs` inlines them into `index.html`.

```bash
npm install          # only needed for the optional Anthropic live check
npm run build        # rebuild index.html from src/
npm test             # estimation engine, puzzles, chat feedback, scripted teammates, hosted worker
node --env-file=.env tests/live-api.mjs gemini   # live check of the AI teammates (uses GEMINI_API_KEY)
node --env-file=.env worker/dev-server.mjs       # local hosted teammates on :8787 (see above)
node --env-file=.env tools/pilot-export.mjs      # pilot counts and sent results (uses PILOT_TOKEN)
```

## Caveats

- Study 1 has been peer reviewed and published in the Quarterly Journal of Economics (2026). Study 2, the AI-agent study, is still a working paper (revise and resubmit at Management Science). The evidence comes from lab tasks done mostly by students.
- The causal reading depends on random assignment. Ordinary HR data, where managers and teams are not matched at random, would give confounded estimates.
- The AI leadership test here has not been validated against human teams or real-world leadership, and has no norms. It also departs from Study 2 in several ways (table at the top), so the study's validity evidence doesn't carry over. Use it for practice or as a research tool, not to judge individuals.
- The test covers a small part of a manager's job: drawing out what a team knows to make one short decision with a right answer. Setting goals, coaching, motivating people, handling conflict, hiring and building trust over months are not in it.
- Use the scores as one input among several and check for adverse impact before using them in any selection decision.

## Sources

- Weidmann, B., Vecci, J., Said, F., Bhalotra, S., Adhvaryu, A., Nyshadham, A., Tamayo, J., & Deming, D. J. (2026). [How Do You Identify a Good Manager?](https://doi.org/10.1093/qje/qjag004) Quarterly Journal of Economics. Working paper version: Weidmann, Vecci, Said, Deming & Bhalotra (2024), [How Do You Find a Good Manager?](https://www.nber.org/papers/w32699) NBER Working Paper 32699.
- Weidmann, B., Xu, Y., & Deming, D. J. (2025). [Measuring Human Leadership Skills with AI Agents](https://www.nber.org/papers/w33662). NBER Working Paper 33662.
- Stehlík, L. (2025). [Novel way to measure leadership skills via causal inference (and AI)?](https://blog-about-people-analytics.netlify.app/posts/2025-06-12-causal-impact-of-leadership-skills/)

This is an independent implementation, not affiliated with the authors.
