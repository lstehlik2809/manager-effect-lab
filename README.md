# Manager Effect Lab

**[Open the app](https://lstehlik2809.github.io/manager-effect-lab/)**

How do you tell a good manager from a manager who was lucky with their team? Two pre-registered NBER working papers by Ben Weidmann, David Deming and colleagues borrow the answer from causal inference. Rotate managers at random through several teams, predict each team's result from the individually tested skills of its members, and treat the gap between what the team achieved and what was predicted as the manager's contribution. A good manager is one whose teams keep beating the prediction.

This app implements that method in the browser, from planning the rotations to estimating each manager's effect. It also recreates the AI version of the test from the second paper, in which a leader directs a team of AI agents.

## What's inside

- **How it works.** The procedure and the main findings of both papers, with their caveats.
- **Plan the rotations.** A reliability calculator that shows how many teams each manager has to lead before an individual estimate means much, and a rotation generator that assigns managers to random teams with as few repeat pairings as possible. It exports a CSV template for the results.
- **Estimate manager effects.** Load one row per team per round and, optionally, a file of individual skill scores. You get the typical manager effect with a profile-likelihood interval and a randomization-inference p-value, shrunken estimates for every manager, an out-of-sample check, the prediction model, and the measures that predict good management. The tab opens on simulated example data that mirrors Study 1.
- **AI leadership test.** Lead three AI teammates through hidden-profile puzzles: one solo warm-up and four team puzzles. Teammates run on Gemini 3.8 Flash (default) or Claude with your own API key. Offline scripted teammates are available for a dry run. You get credence scores plus the behaviours Study 2 linked to good leadership: questions asked, conversational turn-taking, and how much hidden information you surfaced.

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
4. Model (3): a one-way random-effects model fitted by REML gives σ<sub>α</sub>, the typical manager effect, with a profile-likelihood 95% interval. The per-manager estimates are empirical-Bayes (BLUP) shrinkage estimates with posterior intervals.
5. Randomization inference reshuffles which manager led which team within each round, refits the model, and compares the observed σ<sub>α</sub> with the reshuffled ones.
6. Member effects use the same model with members as groups. Out-of-sample validity is checked by holding out each round in turn, as in Table 4 of the paper but on skill-adjusted scores.
7. Correlates of the manager effect and the "appoint the top third on measure X" comparison follow Table 5 and Figure 6.

The example data are simulated with a true σ<sub>α</sub> of 0.25 SD, partly driven by decision-making skill and fluid IQ. With four rotations per manager, an individual estimate has a reliability of only about 0.27. The app shows this openly: you can detect that managers matter well before you can rank them reliably.

## The AI leadership test

The puzzles are newly written and follow the structure of Study 2; they are not the study's materials. Each team puzzle has two questions with five options. Every team member (the leader and three AI teammates) holds eight reports: for each question, two are shared with the whole team and two are private. Reports either rule options out (some only in combination with another person's report) or are irrelevant. The options left standing are equally likely, and that is the correct credence profile. Tests check that every puzzle is solvable and that no one can solve it alone.

Scores are 100 × (1 − total variation distance) between the submitted credences and the correct ones. Teammates see only the leader's messages to them or to everyone, and they cite reports by number. That lets the app count how many decisive private reports the leader drew out. The teammate prompt is in `src/puzzles.js` (`followerBrief`).

API keys stay in the browser and go only to the provider's API (`generativelanguage.googleapis.com` or `api.anthropic.com`). Gemini replies use the low thinking level to keep the chat quick.

## Run locally

The app is a single static `index.html`. Serve the folder, for example with `python -m http.server`, and open it. Sources live in `src/`. `build.cjs` inlines them into `index.html`.

```bash
npm install          # only needed for the optional Anthropic live check
npm run build        # rebuild index.html from src/
npm test             # estimation engine and puzzle checks
node --env-file=.env tests/live-api.mjs gemini   # live check of the AI teammates (uses GEMINI_API_KEY)
```

## Caveats

- Both papers are working papers and have not been peer reviewed. The evidence comes from lab tasks done mostly by students.
- The causal reading depends on random assignment. Ordinary HR data, where managers and teams are not matched at random, would give confounded estimates.
- Use the scores as one input among several and check for adverse impact before using them in any selection decision.

## Sources

- Weidmann, B., Vecci, J., Said, F., Deming, D. J., & Bhalotra, S. R. (2024). [How Do You Find a Good Manager?](https://www.nber.org/papers/w32699) NBER Working Paper 32699.
- Weidmann, B., Xu, Y., & Deming, D. J. (2025). [Measuring Human Leadership Skills with AI Agents](https://www.nber.org/papers/w33662). NBER Working Paper 33662.
- Stehlík, L. (2025). [Novel way to measure leadership skills via causal inference (and AI)?](https://blog-about-people-analytics.netlify.app/posts/2025-06-12-causal-impact-of-leadership-skills/)

This is an independent implementation, not affiliated with the authors.
