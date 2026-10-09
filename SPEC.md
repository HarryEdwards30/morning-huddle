# Morning Huddle: Build Spec

A personal NFL and NBA news app for Jack. Phone-first, installed on the home screen, with a fresh brief every morning at 9am Melbourne time.

---

## 0. Instructions for Claude Code

- Read this whole file before doing anything. Then reply with a short build plan and any questions before writing code.
- Build in the phases in Section 14. **Stop at the end of each phase**, show Jack what changed, and wait for his OK before moving on.
- Jack understands the sports well but is not a professional developer. Explain any step he has to do himself (clicks in GitHub, merging changes, installing on his phone) in plain, numbered steps.
- Use Australian spelling in all app text.
- Keep the stack simple and easy to change later (see Section 13). Prefer plain, readable code over clever code.
- Never print, log or commit the API key.

---

## 1. What the app is

Morning Huddle is Jack's personal sports outlet for the **NFL and NBA**. It centres on his teams, the **San Antonio Spurs (NBA)** and the **Las Vegas Raiders (NFL)**, and keeps him across the wider season: news, injuries, player form, who's doing well, standings and the games worth watching.

The goal is to grow Jack's interest in both leagues by giving him a quick, well-written daily read and enough context to follow the season's storylines.

## 2. The user

- Lives in **Melbourne, Australia**. All times are shown in Melbourne time (`Australia/Melbourne`, which switches between AEDT and AEST), with the zone labelled.
- Reads on his **phone**, from an icon on his home screen (an installable PWA).
- Knows how both sports are played. **No rules explainers.** He wants season information: players, teams, form, news, injuries and who's performing.
- Reads it at **9am Melbourne time** each morning.

## 3. Decisions already made

| Topic | Decision |
|---|---|
| App name | **Morning Huddle** (home-screen short name: "Huddle") |
| Teams | Spurs (NBA), Raiders (NFL) |
| Daily brief | Ready by **9:00am Melbourne time**, every day |
| Brief length | Flexible: whatever is needed to cover what's important since the last edition. Reasonable, not long. |
| Weekly wrap and watch guide | One combined **Wednesday 9am** edition covering both leagues (the NFL week finishes Tuesday afternoon Melbourne time) |
| Hosting | **GitHub Pages** (free, public repo) |
| Scheduler | **GitHub Actions** cron |
| AI writer | **Claude Haiku 5.5** via the Claude API. No web search tool; Claude only writes from data we give it. |
| API key | Already stored as the GitHub Actions secret **`ANTHROPIC_API_KEY`** |
| Look | Dark, simple, easy to read, sporty |
| Cost target | About A$0.30 to A$0.60 a month in API usage |

## 4. Features (version 1)

The app has four tabs: **NFL · NBA · My Teams · Watch** (changed in October 2026 from Today · My Teams · League · Watch). It opens on the tab Jack used last, or **My Teams** the first time.

### 4.1 NFL and NBA tabs
The two league tabs share one layout. Each shows only its own league, in two parts with a clear label strip between them.

**Today's brief** (built each morning from the overnight data):
1. **Wednesday Wrap** for this league (Wednesdays only, see 4.5).
2. **"If you only read one thing"**: one sentence with this league's single most important story.
3. **Players you follow** in this league (only if `followedPlayers` has any, see 4.6).
4. **Headlines**: the key stories, each with a 1 to 2 sentence summary plus a **"Why it matters"** line about its effect on the season (standings, playoff race, awards, a team's direction). "Why it matters" is shown as a highlighted callout inside each story.
5. **Results**: compact scoreboard of completed games since the last edition, with Spurs and Raiders games highlighted.
6. **Context card** (can be turned off in settings): one short card a day on league mechanics or season context, for example how the trade deadline works or how playoff tiebreakers work. **Not** game rules. It appears in the tab of the league it's about.
7. Edition date and "updated at" time, in Melbourne time.

**Around the league:**
- **League pulse**: a split layout with a **Hot** column (teams and players in form, warm colour, up arrow) and a **Cold** column (out of form, cool colour, down arrow).
- **Standings** (NBA by conference; NFL by division, with an AFC/NFC switch). For the NBA, this card is titled **Standings and playoff race** and marks the top-6 and play-in (7 to 10) lines.
- **Playoff picture** (NFL only): the 7 seeds in each conference and the first teams out, with games back.
- **Award races**: short lists for the main awards (NBA: MVP, Rookie of the Year, DPOY and so on; NFL: MVP, Offensive and Defensive Player of the Year, rookies). Based only on data and news in the feeds; label them as "current contenders".
- **Major injuries** around the league (stars and starters only).
- **Transactions**: notable trades, signings and coaching changes.
- **Season timeline**: countdowns to key dates for the league (for example the NBA Cup, trade deadlines, All-Star, playoffs, the drafts, the Super Bowl). Dates live in the settings file so they're easy to fix (see Section 16).

### 4.2 My Teams tab (Spurs, Raiders)
One hub per team, switchable at the top.

- **Since the last edition**: the team's news since the previous edition (result, injuries, roster moves, notable performances). If nothing happened, say so in one line.
- **Last result** and **next game** (date and time in Melbourne time, opponent, home or away).
- **Record and standing** (conference or division position).
- **Injury report**: each player with a status chip (Out / Doubtful / Questionable / Probable / Day-to-day), **what the injury is**, and the **expected return timeline**. Keep it to what and when, no deep medical detail. Clearly label whether a timeline was reported by the team or media, or is a typical recovery time for that injury.
- **Player form**: key players' last 5 games against their season averages, with a simple trending up / steady / trending down marker and a one-line note from the AI.
- **Roster moves and news**: signings, trades, releases, coach comments, rotation or depth chart changes.
- **Playoff race**: where the team sits, the teams around them, games back, and their next few key games.

### 4.3 (Removed) League tab
The League tab's content now lives in the "Around the league" part of the NFL and NBA tabs (4.1).

### 4.4 Watch tab: the watch guide
- Refreshed **every Wednesday** at 9am Melbourne time, covering the coming week (Wednesday to Tuesday).
- The **3 to 5 games most worth watching** in each league, ranked, each with a one-line reason (for example "top two in the West" or "the league's best offence against its best defence").
- **Spurs and Raiders games are always listed**, flagged as "Your team".
- Times shown in Melbourne time with the day, for example "Thu 12:30pm AEDT".
- No streaming links needed.

### 4.5 Wednesday Wrap
- Part of the Wednesday edition, **split by league**: the NFL wrap sits at the top of the NFL tab and the NBA wrap at the top of the NBA tab on Wednesdays. Both are kept in an archive.
- Each is a short summary of that league's past week: the main storylines, key or breaking news, the biggest results and who stood out.

### 4.6 Follow players (optional, off by default)
- Jack can add players he wants to follow in the settings file (`followedPlayers`).
- When the list has players, their recent form and news are added to the brief in their league's tab.
- Empty by default.

### 4.7 Off-season mode
- When a league is in its off-season, its sections switch to off-season content: the draft, free agency, trades, coaching changes and next season's schedule. The other league keeps running normally.
- Detect this from the data (no games scheduled) and from the season dates in settings.

### 4.8 Status and errors
- If a morning run fails (expired API key, data source down, spending limit reached), the app still shows the last good edition, with a clear banner: "Today's brief didn't update. Last updated [date]. Reason: [plain-English reason]."
- Include a short checklist in the README for each failure reason (for example "API key expired: create a new key and update the GitHub secret").

## 5. Not included (decided against)

- Highlight links (Jack gets these from social media)
- An Australians-in-the-NBA/NFL section
- A picks or prediction game
- Push notifications (maybe in version 2)
- Spoiler hiding
- League leaders tables, coaching hot-seat tracker, schedule-difficulty ratings
- Rules explainers
- Team logos (use team abbreviations and colour chips instead)

## 6. Architecture

```
GitHub Actions (cron, ~8am Melbourne)
   │
   ├─ 1. Fetch data  ── ESPN public JSON + news RSS  ──► raw data
   ├─ 2. Shape data  ── trim to what the brief needs (<100k tokens) ──► input.json
   ├─ 3. Write brief ── Claude Haiku 5.5 + prompts/*.md ──► edition JSON
   ├─ 4. Validate    ── schema check; on failure keep last edition + error status
   ├─ 5. Commit      ── data/latest.json, data/editions/YYYY-MM-DD.json, data/status.json
   └─ 6. Deploy      ── build static site → GitHub Pages (same workflow)

Phone (PWA) ──► loads static site + data/latest.json ──► caches for offline
```

Notes:
- **Deploy in the same workflow** that commits data. Commits made with the default `GITHUB_TOKEN` don't trigger other workflows.
- Workflow permissions needed: `contents: write`, `pages: write`, `id-token: write`.
- Jack must set **Settings → Pages → Source: GitHub Actions** once. Walk him through it.
- Add `workflow_dispatch` so Jack can run a fresh edition manually from the Actions tab (useful for testing).
- The front end is a **static site**. Plain HTML, CSS and JavaScript (or Vite with vanilla JS if a build step helps). No heavy framework.
- The pipeline is a **Node.js (v20+)** script using the official `@anthropic-ai/sdk`.

### Suggested repo structure
```
/                     README.md, CLAUDE.md
/config/settings.json     ← Jack's settings (teams, toggles, model, dates)
/prompts/                 ← plain-English writing instructions for Claude
    daily-brief.md
    wednesday-wrap.md
    watch-guide.md
    style.md
/pipeline/                ← data fetching + AI generation (Node)
    sources/              ← one adapter file per data source
    build-edition.js
    schema.js
/site/                    ← the app (HTML/CSS/JS, manifest, service worker, icons)
/data/                    ← generated output (latest.json, editions/, status.json, usage.json)
/.github/workflows/       ← daily.yml (generate + deploy)
```

## 7. Scheduling and time zones

- GitHub cron runs in UTC, and Melbourne switches between AEDT (UTC+11) and AEST (UTC+10). Schedule **two cron times, 21:00 and 22:00 UTC**. The script checks the Melbourne local time and only runs when it's **8am Melbourne**, so the edition is ready by 9am all year round.
- GitHub cron can be delayed at busy times. The 8am start leaves a buffer before 9am.
- Make the run **idempotent**: if today's edition already exists, skip unless the run was started manually.
- On **Wednesdays** (Melbourne date), the same run also builds the Wednesday Wrap and the watch guide.
- Display every time in Melbourne time with the zone label (AEDT/AEST). Use the `Intl` API with `timeZone: 'Australia/Melbourne'`.

Useful context on game timing (Melbourne time):
- NBA night games in the US finish around 12 to 2pm Melbourne time, so the 8am run covers the previous US night completely.
- The NFL Sunday early games finish around 7 to 8am Monday; later games, Sunday Night Football and Monday Night Football finish on Monday and Tuesday afternoons. Monday's and Tuesday's briefs will include whatever has finished. The Wednesday edition covers the full NFL week.

## 8. Data sources

Use free sources with no account needed. **These ESPN endpoints are unofficial and undocumented**, so:
- **Verify every endpoint at build time** before relying on it.
- Put each source behind its own **adapter** in `/pipeline/sources/`, so a broken source can be swapped without touching the rest.
- Never let a failed source crash the run: skip it, note it in `status.json`, and carry on.

Starting points to verify (sport paths: `basketball/nba`, `football/nfl`):
- Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/{sport}/scoreboard?dates=YYYYMMDD`
- News: `https://site.api.espn.com/apis/site/v2/sports/{sport}/news`
- Teams: `https://site.api.espn.com/apis/site/v2/sports/{sport}/teams` (look up the Spurs' and Raiders' IDs here rather than hardcoding guesses)
- Team detail, schedule, roster and injuries: under `.../teams/{id}` (check which sub-resources exist)
- Standings: `https://site.api.espn.com/apis/v2/sports/{sport}/standings` (note `/apis/v2`, not `/apis/site/v2`)
- Player stats and game logs: check the ESPN athlete endpoints, or use box scores from the scoreboard and summary endpoints
- News RSS (verify): ESPN, CBS Sports and Yahoo Sports NBA and NFL feeds

Optional fallbacks if ESPN breaks: balldontlie (has free tiers, needs a free key) or TheSportsDB.

Always keep the **source URL** for each news item so the app can link "Read more".

## 9. AI generation (Claude API)

- **Model:** Claude Haiku 5.5. Put the model ID in `config/settings.json` (expected `claude-haiku-5-5`; check the exact ID on the Claude models docs page). Switching to Sonnet later should be a one-line change.
- **Cost guard:** keep each request's input **under 100,000 tokens**, because Haiku 5.5's cheap rate only applies below that. Target about 40k tokens for the daily brief. If the shaped input is too large, trim lower-priority items first (older news, non-notable games). Log input and output tokens per run to `data/usage.json`.
- **No web search tool.** Claude only uses the data provided.
- **Grounding rules (put these in the prompts):**
  - Only state facts that appear in the provided data. Never invent stats, scores, quotes, injuries or trades.
  - If something is unclear or missing, leave it out.
  - Every story references the source item ID(s) it came from.
  - For injuries, Claude may give a plain-English description of what the injury is and a *typical* recovery range from general knowledge, but it must label that as typical and keep it separate from reported timelines.
- **One call per morning, split by league:** the daily brief comes from **one** Claude API call that returns separate `nfl` and `nba` sections (each with its own "one thing", headlines with "Why it matters", context card if relevant, and Spurs or Raiders "since the last edition" notes), not one combined summary. Splitting the output doesn't add a call, so the cost and the token limits stay as above. On Wednesdays the same rule applies to the wrap (an NFL wrap and an NBA wrap).
- **Structured output:** Claude returns JSON matching a defined schema (one schema each for the daily brief, the wrap and the watch guide, each with `nfl` and `nba` sections). Validate it; if it fails, retry once; if it fails again, keep the last edition and set the error status.
- **Prompts live in `/prompts/*.md`** as plain English so Jack can edit the tone, length and focus without touching code. `style.md` holds the shared voice rules:
  - Clear, conversational, confident. Written for a fan who knows the game.
  - Short paragraphs. Lead with what happened, then why it matters.
  - Australian spelling.
  - No hype or clickbait.

## 10. Data shape (suggested)

`data/latest.json`, roughly. Each league has its own section, and the NFL and NBA tabs each read only their own:
```json
{
  "edition": { "date": "2026-10-21", "generatedAt": "2026-10-21T08:04:00+11:00", "type": "daily | wednesday" },
  "nfl": {
    "oneThing": "…",
    "wrap": { "weekLabel": "Week 11", "summary": "…", "storylines": [ … ], "standouts": [ … ] },
    "headlines": [ { "title": "…", "summary": "…", "whyItMatters": "…", "teams": ["PHI", "DAL"], "sources": ["…"] } ],
    "results": [ … ],
    "contextCard": { "title": "…", "body": "…" },
    "followedPlayers": [ … ],
    "pulse": { "hot": { "teams": [ … ], "players": [ … ] }, "cold": { "teams": [ … ], "players": [ … ] } },
    "standings": { "groups": [ … ] },
    "playoffPicture": { "conferences": [ { "name": "AFC", "seeds": [ … ], "outside": [ … ] } ] },
    "awardRaces": [ … ],
    "majorInjuries": [ … ],
    "transactions": [ … ]
  },
  "nba": { "…same as nfl, without playoffPicture…" },
  "myTeams": { "nba": { "sinceLast": [ … ], "…": "…" }, "nfl": { … } },
  "watchGuide": { "weekOf": "…", "weekEnd": "…", "nba": { "picks": [ … ], "yourTeam": [ … ] }, "nfl": { … } },
  "sources": { "source-id": { "publisher": "…", "url": "…", "title": "…" } }
}
```
`contextCard` and `wrap` are `null` in a league that doesn't have one that day. The season timeline is read straight from `config/settings.json`. `sample/latest.json` is a complete worked example.

`data/status.json`: `{ "ok": true, "lastSuccess": "…", "error": null }`

Keep daily editions in `data/editions/` and delete ones older than 60 days so the repo stays small.

## 11. Design

**Feel:** simple, easy to read and sporty. Like a clean sports broadcast graphic, not a cluttered sports site.

- **Theme:** dark background (deep charcoal, not pure black), crisp off-white text, **silver** as the main accent. This nods to both teams' silver and black.
- **Type:**
  - Bold, condensed display face for headings and scores (for example Barlow Condensed or Oswald from Google Fonts).
  - Highly readable body face at 17 to 18px on mobile (for example Source Sans 3 or IBM Plex Sans).
  - Tabular numbers for scores, records and countdowns.
- **Layout:** one card per section, generous spacing, short paragraphs. Readable one-handed on a phone.
- **Section breaks:** every card starts with a coloured header strip (bold uppercase heading and a small icon), and cards have generous space between them. In the league tabs, a label strip separates "Today's brief" from "Around the league".
- **Colour-coded cards:** each card type has its own dark background tint and accent colour, all defined as CSS variables at the top of `site/css/app.css`:
  - Injuries: red
  - Hot (in form): warm amber
  - Cold (out of form): cool blue
  - Results, scores, standings and playoff tables: neutral silver-grey
  - Headlines, news and the Wednesday Wrap: slate blue-grey
  - Transactions and roster moves: purple
  - Watch guide games: green
  - Everything else (awards, timeline, player form, context): plain charcoal
  - Text must stay easy to read on every tint (at least WCAG AA contrast, 4.5:1).
- **Your teams:** Spurs and Raiders items (games, rows, stories, moves, injuries) get a silver highlight border so they always stand out, plus a "Your team" label where it fits.
- **"Why it matters":** a small highlighted callout inside each story, with its own background, accent bar and label.
- **League pulse:** a split layout, Hot on the left and Cold on the right, each with its own coloured header and an up or down arrow.
- **Navigation:** fixed bottom tab bar: **NFL · NBA · My Teams · Watch**. The app opens on the last tab used (My Teams the first time). A small info button in the header.
- **Status chips:** Out = red, Doubtful = orange, Questionable = amber, Probable or Day-to-day = green-ish. Always include the text label too, not only the colour.
- **Team identity:** team abbreviation in a small chip (SAS, LV). Use the team's silver/black accent in their hub header. No logos.
- **Scores:** scoreboard style, with the winner in bold and Jack's team highlighted.
- **Accessibility:** good contrast, tap targets at least 44px, respect reduced-motion settings.
- **Light mode:** not needed in v1 (dark only), but keep colours as CSS variables so a light theme is easy later.

### PWA
- `manifest.json`: name "Morning Huddle", short_name "Huddle", dark theme colour, standalone display.
- An original, simple icon (for example a bold "MH" monogram or a minimal huddle-circle mark in silver on charcoal). **Do not use team or league logos.** Provide sizes for iOS and Android.
- A service worker that caches the app and the latest edition, so it opens instantly and works offline with the last brief.
- Give Jack step-by-step instructions to add it to his home screen (iPhone: Safari → Share → Add to Home Screen; Android: Chrome menu → Install app).

## 12. Settings file

`config/settings.json`, the one place Jack edits most often:
```json
{
  "appName": "Morning Huddle",
  "timezone": "Australia/Melbourne",
  "teams": {
    "nba": { "name": "San Antonio Spurs", "abbr": "SAS" },
    "nfl": { "name": "Las Vegas Raiders", "abbr": "LV" }
  },
  "followedPlayers": [],
  "sections": {
    "contextCard": true,
    "awardRaces": true,
    "seasonTimeline": true
  },
  "schedule": { "dailyBriefLocalTime": "09:00", "runLocalHour": 8, "wrapDay": "Wednesday" },
  "ai": { "model": "claude-haiku-5-5", "maxInputTokens": 90000 },
  "seasonDates": { "nba": [], "nfl": [] }
}
```

## 13. Making changes later

Jack wants to change and adapt the app over time. Build for that:

- **Settings in one file** (Section 12): change a team, follow a player, or turn a section on or off with a one-line edit.
- **Writing instructions in plain English** (`/prompts`): change the tone, length or focus without code.
- **Separate sections:** each tab or section is its own component or module and reads its own part of the JSON. Adding, removing or reworking one shouldn't break the others.
- **Write a `CLAUDE.md`** at the repo root for future Claude Code sessions. It should cover:
  - what the app does
  - the architecture
  - where each feature lives
  - how to run the pipeline locally
  - how to trigger a manual run
  - the cost and token guardrails
  - the "only use provided data" rule
- **Write a `README.md`** for Jack (non-technical). It should cover:
  - how to change settings
  - how to edit the prompts
  - how to run a manual update
  - how to fix common failures
  - how to install on his phone
  - where to check API usage
- Every change is tracked in git history, so anything can be rolled back.

## 14. Build phases

Stop after each phase and check in with Jack.

**Phase 0: Check setup**
- Confirm the repo, the `ANTHROPIC_API_KEY` secret and GitHub Pages. Walk Jack through setting Pages' source to "GitHub Actions".
- Confirm the plan and stack.

**Phase 1: App shell with sample data**
- Build the four tabs, the design system and the PWA basics using a realistic, clearly marked **sample** `latest.json`. (Done. The tabs were then reworked to NFL · NBA · My Teams · Watch, with colour-coded cards.)
- Done when: Jack can open the site on his phone and see the layout.

**Phase 2: Real data (no AI yet)**
- Build the source adapters and data shaping.
- Fill results, schedules, standings, injuries, the season timeline and news headlines from real data.
- Done when: the app shows real, current data, with times correct in Melbourne time.

**Phase 3: AI-written brief**
- Add the Claude Haiku generation, prompts, schema validation, the cost guard and usage logging. The prompts and schema produce separate NFL and NBA sections from one call (see Section 9).
- Done when: a manual run produces a sensible daily brief, the logged token counts are within budget, and nothing is invented.

**Phase 4: Schedule and deploy**
- Add the daily GitHub Actions workflow (cron + manual run), commit-and-deploy in one workflow, the idempotency check, and the error status and banner.
- Done when: it runs on schedule and the app updates by itself.

**Phase 5: Wednesday edition**
- Build the Wednesday Wrap and the watch guide, plus the edition archive.
- Done when: a manual "pretend it's Wednesday" run produces both.

**Phase 6: Polish and handover**
- Offline caching, the icon, home-screen install instructions, off-season mode, and the `CLAUDE.md` and `README.md`.
- Test on a phone-sized screen.
- Done when: Jack has it on his home screen and knows how to change things.

## 15. Guardrails

- The API key only ever comes from `process.env.ANTHROPIC_API_KEY` (the GitHub secret). Never commit it, log it, or expose it to the front end. The front end never calls the Claude API.
- The repo is public: no personal information beyond Jack's team choices.
- Use Haiku 5.5 by default and never the web search tool. Stay under 100k input tokens per request. (Jack has also set a US$2/month spend limit in the Claude Console.)
- Fail gracefully: a broken source or API error must never wipe the last good edition.
- Be polite to data sources: fetch once per run, no hammering.

## 16. Season context for testing (as at 9 October 2026, verify before relying on it)

**NBA 2026-27**
- The regular season starts **Tuesday 20 Oct 2026 (US)**, which is Wednesday 21 Oct in Melbourne.
- The opening night includes **OKC Thunder at San Antonio Spurs**, 9:30pm ET, which is about **12:30pm AEDT Wed 21 Oct**.
- The **Knicks** are the defending champions. The **Spurs beat the Thunder** in the 2026 Western Conference Finals. Victor Wembanyama is the MVP betting favourite.
- NBA Cup group stage: 30 Oct to 11 Dec 2026. All-Star Game: 21 Feb 2027 (Phoenix). Regular season ends 11 Apr 2027. Play-in: 13 to 16 Apr 2027.
- Big offseason moves: Giannis Antetokounmpo to the Heat, LeBron James to the 76ers, and Jaylen Brown to the 76ers (Paul George to the Celtics).

**NFL 2026**
- The regular season is underway (around Week 6 as of early October).
- Get the remaining key dates (trade deadline, end of the regular season, playoffs, Super Bowl, draft) from the data or a reliable source and put them in `seasonDates`.
