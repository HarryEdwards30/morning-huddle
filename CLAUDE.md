# Morning Huddle: notes for Claude Code

Jack's personal NFL and NBA news app (Spurs and Raiders), installed on his phone's home screen. The full spec is in `SPEC.md`; read it before making changes, and follow its Section 0 (work in phases, stop and check in, plain-English steps for Jack, Australian spelling, never print or commit the API key).

## Status
- Phase 1 (app shell with sample data) is done, then reworked to the four tabs below with colour-coded cards.
- Phase 2 (real data, no AI) is done: the pipeline in `pipeline/` builds an edition from ESPN, CBS and Yahoo and saves it to the `data` branch.
- Phase 3 (the Claude-written brief) is done: `pipeline/write-brief.js`.
- Phase 4 (the 8am schedule and the error banner) is done.
- Phase 5 (the Wednesday Wrap, the ranked watch guide and the edition archive) is done.
- Phase 6 (offline use, the icon, install steps, off-season mode, followed players, final docs) is done. All of SPEC.md Section 14 is built; changes from here are Jack's requests.

## Layout of the app
- Tabs: **NFL · NBA · My Teams · Watch**. The app opens on the last tab used (saved in `localStorage` as `huddle:lastTab`), or My Teams the first time.
- NFL and NBA tabs share one layout (`site/js/tabs/league.js`):
  - Today's brief: Wednesday Wrap (Wednesdays), one thing, followed players, headlines with "Why it matters", results, context card. These are in `site/js/sections/brief.js`.
  - Around the league: pulse (Hot | Cold split), standings (the NBA card doubles as the playoff race), playoff picture (NFL only), award races, major injuries, transactions, season timeline. These are in `site/js/sections/league-info.js`.
  - Past Wednesday Wraps at the bottom (`site/js/sections/archive.js`), read from `data/editions/index.json`; each Wrap's edition is only fetched when opened.
- My Teams: `site/js/tabs/teams.js`, with the "Since the last edition" card at the top of each hub.
- Watch: `site/js/tabs/watch.js`. Games more than four hours past their start are marked "Played".
- Past editions: the info button lists the last 14 (from `data/editions/index.json`); opening one swaps `ctx.edition` and shows a "Past edition" banner with "Back to today".
- Shared helpers in `site/js/ui.js`: `el()` builds elements as text only (never innerHTML); `card({ type, title })` makes a section card with a coloured header strip. The card types are plain, injury, hot, cold, results, news, moves, watch and lead.
- Times are formatted in `site/js/time.js` and are always shown in Melbourne time with AEDT/AEST.
- Offline: `site/sw.js` (network first, falling back to the copy on the phone after 6 seconds or when offline; fonts cache first). `scripts/build-site.js` fills in its version and file list on every build, so a deploy replaces the old copy. `app.js` registers it, shows an "Offline" banner, and reloads when the app comes back to the front and a newer edition is out.
- Install steps for iPhone and Android are in the info dialog (hidden when opened from the home screen) and the README.
- Icons: `site/icons/icon.svg` (rounded) plus PNGs rendered from it (square for 192, 512 and apple-touch-icon; `icon-maskable-512.png` is scaled into the safe zone).
- Off-season (`edition.<league>.offSeason`): the league tab shows an off-season card (next key date from `seasonDates`), "Trades, signings and coaching", major injuries, the timeline and last season's final standings, instead of pulse, playoff picture and award races. The team hub drops player form and the playoff race; Watch says there are no games.
- Players you follow: `settings.followedPlayers` (`[{ "name", "league" }]`). `pipeline/shape/followed.js` gathers their lines in the latest games, stat-leader ranks, injury status and news naming them; Claude writes `followedNotes` (checked like everything else), and the card falls back to the facts.

## Data pipeline (`pipeline/`)
- `build-edition.js --out <folder>` fetches everything, shapes it and writes `latest.json`, `editions/YYYY-MM-DD.json` (kept 60 days) and `status.json` into the folder (normally the checked-out `data` branch).
- `sources/espn.js` and `sources/rss.js` are the only files that know URLs. Each call goes through `lib/http.js`, which never throws: a failed source is logged in `status.json` and the run carries on. The run only fails (keeping the last edition) if standings are missing for a league.
- Off-season: `settings.offSeason.<league>` is `"auto"` (ESPN's scoreboard season type 4), `true` or `false`. Off-season leagues skip hot and cold, player form and the playoff race, show a week of transactions (up to 20), and don't fail the run if standings are missing. Claude gets `offSeason: true` in that league's input (see `prompts/daily-brief.md`).
- `shape/*.js` turn raw responses into the edition: teams (Jack's team uses the settings abbreviation, e.g. SAS not ESPN's SA), games, standings and playoff picture, injuries, news and transactions, player form.
- ESPN quirks: its firewall rejects some user agents (keep `MorningHuddle/1.0 (personal news app)`); its RSS feeds return nothing to scripts, so ESPN news comes from the JSON news endpoint; NBA standings need `seasontype=2` or preseason games are counted.
- `npm run check-sources` prints what every endpoint returns. The development workspace can't reach these sites, so test on GitHub (Actions).
- `scripts/data-branch.sh checkout|save <folder>` gets and saves the `data` branch.
- `build-edition.js` also writes `facts.json` (league stat leaders for the award races; not shown in the app).

## The Wednesday edition
- `build-edition.js` makes a Wednesday edition (`edition.type: 'wednesday'`) when the Melbourne weekday is `schedule.wrapDay`, or when `PRETEND_WEDNESDAY=true` (the "Pretend it's Wednesday" box on a manual run; the edition gets `pretendWednesday: true`).
- It also fetches the last eight US scoreboard dates (the week's results) and the next eight (the games ahead), and puts the week in `facts.json` under `week.<league>`: `label` ("Week 6" for the NFL, "7 to 13 Oct" for the NBA), `results`, `standouts`, `headlines` (today's plus the week's daily editions, with sources re-added), `moves` and `games` (candidates, scored in `shape/week.js`).
- The watch guide is ranked in `shape/week.js` first (records, standings, US national TV or NFL prime time, division games), with factual reasons, so it's never empty. On other days the last ranked guide is kept until its `weekEnd`; with none, the guide falls back to your teams' games.
- `write-brief.js` adds `prompts/wednesday-wrap.md` and `prompts/watch-guide.md` and uses `WEDNESDAY_SCHEMA`: each league gets `wrap` (summary, storylines with refs, `biggestResults` as week-result ids that become real game rows, standouts) and `watch.picks` (candidate ids with reasons). Claude's ranking replaces the pipeline's only if it picked at least three valid games.
- `pipeline/lib/archive.js` rewrites `editions/index.json` (date, type, written, Wrap labels) after every build and brief.

## The written brief (`pipeline/write-brief.js`, `pipeline/brief/`, `prompts/`)
- One Claude call per edition, including Wednesdays (model and token limit from `config/settings.json`, effort `low`). The JSON shape is given in the instructions (`DAILY_BRIEF_SCHEMA`), not as structured output: the API rejects that schema with "The compiled grammar is too large". `brief/input.js` builds a compact input (about 5k tokens) with an id on every item and trims it if it's over budget; `brief/schema.js` holds the output schema and the checks.
- Checks on the reply: items must cite real input ids (headlines must cite a headline, whose sources become the story's "Read more" links); any number in the text that isn't in the input is dropped (small numbers 0 to 10 are allowed); award contenders must appear in the input; at most one context card a day. Typical recovery times are general knowledge and labelled "Typical recovery".
- If the API rejects the request (HTTP 400), it retries without the effort setting; the API's message is logged and kept in `status.json` (`brief.rejectedRequests` or `brief.detail`). Retries once if a reply can't be used. On failure the edition keeps its data without the written parts (`edition.written: false`, "Live data" notice) and `status.json` gets `brief: { ok: false, error }` in plain English; the script exits 2 so the run shows red.
- Writes `brief-input.json` (exactly what Claude saw) and `usage.json` (tokens and cost per run, month total) to the data folder.
- Test without a key by pointing `ANTHROPIC_BASE_URL` at a local fake server; the real API is only called on GitHub (the key is a repo secret).

## Data
- The app reads `data/latest.json` and `settings.json`. Both are copied into `_site/` by `scripts/build-site.js`, which uses the `data` branch's edition, or the sample only if there is no real edition.
- Each edition has an `nfl` section and an `nba` section, and each tab reads only its own (see SPEC.md Section 10). `sample/latest.json` is the worked example and is clearly marked `"sample": true`.
- Season timeline dates come from `config/settings.json` (`seasonDates`), not from the edition.

## Styling
- All colours are CSS variables at the top of `site/css/app.css`, with a `--card-<type>-bg` and `--card-<type>-accent` pair per card type.
- Keep text at WCAG AA contrast or better on every card colour.
- Spurs and Raiders items get the `.mine` class (silver border).

## Running locally
- `npm run preview` builds `_site/` with the sample edition and serves it at http://localhost:8080.
- One dependency: `@anthropic-ai/sdk` (`npm ci`). Node 20 or later.

## Publishing and the schedule
- `.github/workflows/daily.yml` runs on a schedule (cron 21:00 and 22:00 UTC), on a manual run, and on pushes to `main`.
- `scripts/should-run.js` decides whether to build: manual runs always build; scheduled runs build only if it's at or after `schedule.runLocalHour` (8) in Melbourne and today's edition isn't on the data branch yet (so exactly one build a day across AEDT/AEST, and a late cron still builds); pushes only republish. A skipped scheduled run doesn't publish.
- Daily data lives on the `data` branch so `main` only shows real changes.
- The app reads `data/status.json` for the banner: run failed (`ok: false`), no edition for today after 10am Melbourne, or brief failed (`brief.ok: false`).

## AI brief: the rules
- One Claude API call per morning (model ID from `config/settings.json`, `claude-haiku-5-5`), returning separate `nfl` and `nba` sections.
- Keep input under `ai.maxInputTokens` (90k); the cheap rate stops at 100k. Log token usage to `data/usage.json`.
- No web search tool. Claude may only state facts that appear in the data it's given, and every story cites its source IDs. Typical injury recovery times must be labelled as typical.
- The API key only ever comes from `process.env.ANTHROPIC_API_KEY` (a GitHub secret). Never print, log or commit it, and the front end never calls the API.
