# Morning Huddle

Jack's daily NFL and NBA brief, built around the Spurs and the Raiders. It's a phone app you add to your home screen, with a fresh edition every morning by 9am Melbourne time.

**Open it:** https://harryedwards30.github.io/morning-huddle/

## The tabs

| Tab | What's on it |
|---|---|
| **NFL** | Today's NFL brief (Wednesday Wrap on Wednesdays, "If you only read one thing", headlines with "Why it matters", results, context card), then around the NFL: hot and cold, standings, playoff picture, award races, major injuries, transactions, season timeline |
| **NBA** | The same layout for the NBA. Its standings card doubles as the playoff race |
| **My Teams** | Spurs and Raiders hubs (switch at the top): since the last edition, last result and next game, injuries, player form, roster moves, playoff race |
| **Watch** | The week's best games in each league, refreshed every Wednesday, with your teams' games flagged |

The app opens on the tab you used last (My Teams the first time).

## Getting a fresh edition

Until the 8am schedule is added (Phase 4), editions are made by hand:

1. Open the repo on GitHub and click the **Actions** tab.
2. Click **Morning Huddle** in the list on the left.
3. Click **Run workflow** (on the right), then the green **Run workflow** button.
4. Wait about a minute for the run to turn green, then refresh the app.

Each edition is saved to the separate **data** branch, so your `main` history only shows real changes to the app. If a run can't get the data it needs, it turns red and the app keeps showing the last good edition.

## The written brief

Each edition makes **one** call to Claude (Haiku 5.5), which writes "If you only read one thing", "Why it matters", your teams' updates, player-form notes, typical recovery times, award races and the daily context card. Claude is only given the day's data and is told not to add anything that isn't in it. Every item it writes has to point back to the data it came from, and any item with a number that isn't in the data is dropped.

- **Edit the writing instructions** in [prompts/](prompts/): `style.md` is the voice (tone, spelling, the "facts only" rules) and `daily-brief.md` says what to write. They're plain English, so edit them like a document, then do a manual run to see the effect.
- **See what Claude was given**: open `brief-input.json` on the **data** branch.
- **Check API usage**: open `usage.json` on the **data** branch (or https://harryedwards30.github.io/morning-huddle/data/usage.json). It lists the tokens and estimated cost of every run and the total for the month. A run costs about US$0.002. You can also see usage in the Claude Console.

## If the brief doesn't appear

The app still shows the day's data, and the run on the Actions tab turns red. Click the red run, then the **Write the brief with Claude** step, to see the reason:

| Reason shown | What to do |
|---|---|
| No API key | In the repo, go to **Settings → Secrets and variables → Actions** and add a secret named `ANTHROPIC_API_KEY`. |
| The API key was rejected | The key has expired or been deleted. Create a new key in the Claude Console, then update the `ANTHROPIC_API_KEY` secret (same place as above, click the pencil). |
| Spending limit reached / out of credit | In the Claude Console, check **Billing** and **Limits**. Your limit is US$2 a month, far above what the app uses, so this usually means credit has run out. |
| Claude was busy | Nothing to fix. Run it again later. |
| The reply wasn't valid | Usually a one-off. Run it again. If it keeps happening, tell Claude Code. |

## Changing things

- **Settings** (teams, sections on or off, season dates): [config/settings.json](config/settings.json)
- **Card colours:** the top of [site/css/app.css](site/css/app.css). Each card type has two lines: `-bg` is the background tint and `-accent` is the header strip colour. For example, to change the injury cards, edit `--card-injury-bg` and `--card-injury-accent`. Keep the backgrounds dark so the text stays easy to read.
- **Spec:** [SPEC.md](SPEC.md)

The full guide (editing the writing instructions, running a manual update, fixing problems and installing on your phone) arrives in Phase 6.
