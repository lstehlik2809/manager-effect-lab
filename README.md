# Manager Effect Lab

**[Open the app](https://lstehlik2809.github.io/manager-effect-lab/)** · **[claude.ai version](https://claude.ai/artifact/696yvnhLNTxw2zjFXYXz42)** (teammates run on your own Claude account, no API key needed)

How do you tell a good manager from a manager who was lucky with their team? Two pre-registered NBER working papers by Ben Weidmann, David Deming and colleagues borrow the answer from causal inference. Rotate managers at random through several teams, predict each team's result from the individually tested skills of its members, and treat the gap between what the team achieved and what was predicted as the manager's contribution. A good manager is one whose teams keep beating the prediction.

The app opens on a playful leadership test inspired by the second paper, in which you lead a team of AI agents. It is meant for anyone curious how they lead, for example people who find it through LinkedIn. Behind it sit the research summary and a toolkit that implements the full method for HR and research teams who want to run it with real teams.

## What's inside

- **Take the test** (landing page). Lead three AI teammates through hidden-profile puzzles. **Quick** (the default) is two team puzzles, about 10–15 minutes; **Standard** adds a solo warm-up and has four team puzzles, about 20–25 minutes; **Extended** adds two more warm-ups. Players can stop after any team puzzle and still get a result. Teammates need no key and no sign-up: live AI teammates through the optional hosted worker (see below), or scripted teammates that run in the browser. Visitors can also use their own Gemini or Anthropic key, and in the claude.ai version the teammates run on the visitor's Claude account. After each puzzle the player gets specific feedback from their own chat: which question drew out which decisive report, which reports stayed hidden, who held them and what they were worth, repeated or general requests, and where the points went (reports that stayed hidden versus how the reports in hand were used). At the end come a raw credence score, the three habits Study 2 linked to effective leaders (asking questions, back-and-forth, drawing out hidden information) with rough ratings, the strongest specific observations across puzzles, a playful leadership style, and a result card sized for a LinkedIn post with a "Share on LinkedIn" button. **Compare a group**, for teams and researchers, loads several people's results files and estimates each person's leadership net of solo reasoning skill. The test is not validated (see below).
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

The puzzles are newly written and follow the structure of Study 2; they are not the study's materials. Each team puzzle has two questions with five options. Every team member (the leader and three AI teammates) holds eight reports: for each question, two are shared with the whole team and two are private. Reports either rule options out (some only in combination with another person's report) or are irrelevant. The options left standing are equally likely, and that is the correct credence profile. Tests check that every puzzle is solvable and that no one can solve it alone.

Scores are 100 × (1 − total variation distance) between the submitted credences and the correct ones. Teammates see only the leader's messages to them or to everyone, and they cite reports by number. That lets the app count how many decisive private reports the leader drew out. The teammate prompt is in `src/puzzles.js` (`followerBrief`). The count depends on teammates citing report numbers as instructed, so it undercounts when they paraphrase.

### Feedback from the chat

`src/coach.js` reads each puzzle's chat and answer with simple rules (tested in `tests/coach.test.cjs`):

- **Questions** are sentences that end in "?" or open like a question or request ("what…", "anything on…", "tell me…"). A question is *specific* when its message names an option, a report number or a detail from the reports, *general* otherwise, and a *repeat* when it asks the same people the same thing again. The "Asking questions" habit counts specific questions fully, general ones half and repeats not at all, so sending "share all your reports" again and again earns nothing.
- **Follow-ups** pick up a report number or a detail a teammate brought up; one that reaches a teammate who had not mentioned that detail counts as *connecting* teammates. The "Back-and-forth" habit is rated on follow-ups rather than on raw turn counts.
- **Missed reports**: each decisive report that never came up is named with its holder, what it rules out, whether the leader ever asked that teammate, and the points it was worth. A right answer reached without the report is called a guess.
- **Where the points went**: the best answer possible with the reports the leader had (their own, the shared ones and those cited by teammates) splits the points lost into *reports that stayed hidden* (leading) and *using the reports in hand* (reasoning), with notes on options kept despite a report ruling them out or dropped without one.
- Praise goes to specific or direct questions that drew out decisive reports, never to a general call to everyone.

### Teammates without a key

**Scripted teammates** (`src/scripted.js`) run in the browser. They answer only messages that reach them, stay quiet when a message to everyone names someone else, match options, report numbers and details from their reports, pass on at most two reports at a time, say when they have more or nothing more, and give a view when asked. They are less lifelike than LLM teammates, and their scores are analysed separately.

**Hosted AI teammates** (`worker/`) let visitors use Gemini 3.8 Flash without a key. A Cloudflare Worker holds one Gemini key as a secret. The browser sends only the puzzle and teammate ids and the chat; the worker builds the teammate brief itself (the same `followerBrief` and request settings as the browser, via `geminiRequest` in `src/llm.js`), so it cannot be used as a general-purpose model proxy. It accepts requests only from the allowed origins, checks the chat's size and shape, caps requests per visitor IP per minute (`PER_VISITOR`, 60) and for everyone per UTC day (`DAILY_LIMIT`, 4000; set it to 0 to switch the hosted teammates off), and never passes Google's error text to visitors. When the daily cap is reached, players are offered scripted teammates.

A teammate reply costs about 700–800 input tokens and a few dozen output tokens (`tests/live-api.mjs` prints them). A quick test makes roughly 40–120 replies and a standard one 100–250, so the default daily cap is at most about 3–4 million input tokens a day; check Gemini's current pricing for the key you use, and consider a budget alert on the Google Cloud project as well.

To deploy (Cloudflare account and wrangler login needed):

```bash
cd worker
npx wrangler@4.145.0 secret put GEMINI_API_KEY
npx wrangler@4.145.0 deploy
```

Then set `HOSTED_DEPLOYED` in `src/app.js` to the worker's URL ending in `/reply` and run `npm run build`; the "Live AI teammates" option appears and becomes the default. The live worker is `manager-effect-lab-teammates` at `https://manager-effect-lab-teammates.ludek-stehlik.workers.dev/reply`; logs and usage are in the Cloudflare dashboard under Workers. To try it before deploying, run `node --env-file=path/to/.env worker/dev-server.mjs` and open the app on localhost with `?hosted=http://127.0.0.1:8787/reply`.

A single person's team score is raw: it mixes leadership with how well that person reasons alone. Study 2 measured leadership after controlling for hard skills (three individual puzzles, fluid IQ and typing speed) across its 249 leaders. **Compare a group** does the same for a group of people who took the same test version with the same teammates. Following models (1)–(3) of Study 2:

1. Each team puzzle's scores are standardised across the group, since puzzles differ in difficulty.
2. They are regressed on the person's solo skill: each warm-up puzzle is standardised across the group and a person's puzzles are averaged, so people who did one or three warm-ups are on the same scale. Everyone leads the same AI teammates, so there is no teammate skill to adjust for.
3. Each person's leadership estimate is their mean residual, shrunk toward zero with the REML random-effects model, with a 95% posterior interval. The typical leadership effect gets a profile-likelihood interval.

Results from different AI models, engines or test versions are analysed separately because their scores are not comparable. The results CSV records `engine`, `model` and `test_version`; hosted and own-key Gemini teammates use the same model, brief and settings and are pooled. People who took the Quick length have no warm-up, so they are left out of a group comparison that adjusts for solo skill.

The habit ratings (strong / some / little) use rough thresholds set for these puzzles, and the leadership style is a playful summary of them. Neither is a norm or a validated type.

**This version is not a validated assessment.** The study's ρ = 0.81 between AI-team and human-team leadership was for its own puzzles, GPT-4o followers, six AI-team puzzles and scoring. This version has new puzzles, different models, two or four team puzzles and an independently reconstructed scoring rule, and there are no norms. The app therefore does not compare an individual's score with the study's leaders. The study's authors name validation against real-world leadership as the crucial next step; the same applies here, and more so.

Visitors' own API keys stay in the browser and go only to the provider's API (`generativelanguage.googleapis.com` or `api.anthropic.com`). Gemini replies use the low thinking level to keep the chat quick.

## Run locally

The app is a single static `index.html`. Serve the folder, for example with `python -m http.server`, and open it. Sources live in `src/`. `build.cjs` inlines them into `index.html`.

```bash
npm install          # only needed for the optional Anthropic live check
npm run build        # rebuild index.html from src/
npm test             # estimation engine, puzzles, chat feedback, scripted teammates, hosted worker
node --env-file=.env tests/live-api.mjs gemini   # live check of the AI teammates (uses GEMINI_API_KEY)
node --env-file=.env worker/dev-server.mjs       # local hosted teammates on :8787 (see above)
```

## Caveats

- Both papers are working papers and have not been peer reviewed. The evidence comes from lab tasks done mostly by students.
- The causal reading depends on random assignment. Ordinary HR data, where managers and teams are not matched at random, would give confounded estimates.
- The AI leadership test here has not been validated against human teams or real-world leadership, and has no norms. Use it for practice or as a research tool, not to judge individuals.
- Use the scores as one input among several and check for adverse impact before using them in any selection decision.

## Sources

- Weidmann, B., Vecci, J., Said, F., Deming, D. J., & Bhalotra, S. R. (2024). [How Do You Find a Good Manager?](https://www.nber.org/papers/w32699) NBER Working Paper 32699.
- Weidmann, B., Xu, Y., & Deming, D. J. (2025). [Measuring Human Leadership Skills with AI Agents](https://www.nber.org/papers/w33662). NBER Working Paper 33662.
- Stehlík, L. (2025). [Novel way to measure leadership skills via causal inference (and AI)?](https://blog-about-people-analytics.netlify.app/posts/2025-06-12-causal-impact-of-leadership-skills/)

This is an independent implementation, not affiliated with the authors.
