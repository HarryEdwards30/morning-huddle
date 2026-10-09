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

## Changing things

- **Settings** (teams, sections on or off, season dates): [config/settings.json](config/settings.json)
- **Card colours:** the top of [site/css/app.css](site/css/app.css). Each card type has two lines: `-bg` is the background tint and `-accent` is the header strip colour. For example, to change the injury cards, edit `--card-injury-bg` and `--card-injury-accent`. Keep the backgrounds dark so the text stays easy to read.
- **Spec:** [SPEC.md](SPEC.md)

The full guide (editing the writing instructions, running a manual update, fixing problems and installing on your phone) arrives in Phase 6.
