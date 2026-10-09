# Morning Huddle: notes for Claude Code

Jack's personal NFL and NBA news app (Spurs and Raiders), installed on his phone's home screen. The full spec is in `SPEC.md`; read it before making changes, and follow its Section 0 (work in phases, stop and check in, plain-English steps for Jack, Australian spelling, never print or commit the API key).

## Status
- Phase 1 (app shell with sample data) is done, then reworked to the four tabs below with colour-coded cards.
- Phases 2 to 6 (real data, AI brief, schedule, Wednesday edition, polish) are still to do. See SPEC.md Section 14.

## Layout of the app
- Tabs: **NFL · NBA · My Teams · Watch**. The app opens on the last tab used (saved in `localStorage` as `huddle:lastTab`), or My Teams the first time.
- NFL and NBA tabs share one layout (`site/js/tabs/league.js`):
  - Today's brief: Wednesday Wrap (Wednesdays), one thing, followed players, headlines with "Why it matters", results, context card. These are in `site/js/sections/brief.js`.
  - Around the league: pulse (Hot | Cold split), standings (the NBA card doubles as the playoff race), playoff picture (NFL only), award races, major injuries, transactions, season timeline. These are in `site/js/sections/league-info.js`.
- My Teams: `site/js/tabs/teams.js`, with the "Since the last edition" card at the top of each hub.
- Watch: `site/js/tabs/watch.js`.
- Shared helpers in `site/js/ui.js`: `el()` builds elements as text only (never innerHTML); `card({ type, title })` makes a section card with a coloured header strip. The card types are plain, injury, hot, cold, results, news, moves, watch and lead.
- Times are formatted in `site/js/time.js` and are always shown in Melbourne time with AEDT/AEST.

## Data
- The app reads `data/latest.json` and `settings.json`. Both are copied into `_site/` by `scripts/build-site.js`.
- Each edition has an `nfl` section and an `nba` section, and each tab reads only its own (see SPEC.md Section 10). `sample/latest.json` is the worked example and is clearly marked `"sample": true`.
- Season timeline dates come from `config/settings.json` (`seasonDates`), not from the edition.

## Styling
- All colours are CSS variables at the top of `site/css/app.css`, with a `--card-<type>-bg` and `--card-<type>-accent` pair per card type.
- Keep text at WCAG AA contrast or better on every card colour.
- Spurs and Raiders items get the `.mine` class (silver border).

## Running locally
- `npm run preview` builds `_site/` with the sample edition and serves it at http://localhost:8080.
- No dependencies yet. Node 20 or later.

## Publishing
- `.github/workflows/daily.yml` builds and publishes to GitHub Pages on every push to `main`, and can be run by hand from the Actions tab.
- Later phases add the 8am Melbourne schedule, and keep the daily data on a separate `data` branch so `main` only shows real changes.

## AI brief (Phase 3, not built yet): the rules
- One Claude API call per morning (model ID from `config/settings.json`, `claude-haiku-5-5`), returning separate `nfl` and `nba` sections.
- Keep input under `ai.maxInputTokens` (90k); the cheap rate stops at 100k. Log token usage to `data/usage.json`.
- No web search tool. Claude may only state facts that appear in the data it's given, and every story cites its source IDs. Typical injury recovery times must be labelled as typical.
- The API key only ever comes from `process.env.ANTHROPIC_API_KEY` (a GitHub secret). Never print, log or commit it, and the front end never calls the API.
