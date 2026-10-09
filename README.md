# Morning Huddle

Jack's daily NFL and NBA brief, built around the Spurs and the Raiders. It's a phone app you add to your home screen, with a fresh edition every morning by 9am Melbourne time.

**Open it:** https://harryedwards30.github.io/morning-huddle/

## Put it on your phone

**iPhone (Safari):**
1. Open https://harryedwards30.github.io/morning-huddle/ in **Safari** (other browsers on iPhone can't add apps).
2. Tap the **Share** button (the square with an arrow pointing up) at the bottom of the screen.
3. Scroll down and tap **Add to Home Screen**, then **Add**.

**Android (Chrome):**
1. Open the link in **Chrome**.
2. Tap the **⋮** menu at the top right.
3. Tap **Add to Home screen** (or **Install app**), then **Install**.

It then opens full screen like any other app, with the MH icon. The same steps are in the app: tap the **i** button at the top right.

**Offline:** the app keeps a copy of itself and the latest edition on your phone, so it opens straight away and still works with no signal (a blue **Offline** banner shows). **New editions:** when you come back to the app and a newer edition is out, it reloads by itself.

## The tabs

| Tab | What's on it |
|---|---|
| **NFL** | Today's NFL brief (Wednesday Wrap on Wednesdays, "If you only read one thing", headlines with "Why it matters", results, context card), then around the NFL: hot and cold, standings, playoff picture, award races, major injuries, transactions, season timeline |
| **NBA** | The same layout for the NBA. Its standings card doubles as the playoff race |
| **My Teams** | Spurs and Raiders hubs (switch at the top): since the last edition, last result and next game, injuries, player form, roster moves, playoff race |
| **Watch** | The week's best games in each league (Wednesday to Tuesday), ranked with a reason for each and refreshed every Wednesday. Your teams' games are always listed. Games already played are marked "Played" |

The app opens on the tab you used last (My Teams the first time).

**Wednesdays** bring the Wednesday Wrap: a look back at each league's week (main storylines, biggest results, who stood out) at the top of the NFL and NBA tabs. Older Wraps are listed at the bottom of each league tab under **Past Wednesday Wraps**; tap one to open it.

**Past editions:** tap the **i** button at the top right, then a date under **Past editions**. A banner shows you're reading an old edition, with a **Back to today** button. Editions are kept for 60 days.

**Off-season:** when a league's season is over (the NFL from about February to August, the NBA from about June to October), its tab switches to off-season mode: the draft, free agency, trades, signings and coaching changes, the next key date, and last season's final standings. Hot and cold, the playoff picture, award races and player form are left out until the new season. The other league carries on as normal. The app works this out from ESPN each morning; see "Off-season" under "Changing things" to switch it yourself.

## When it updates

A new edition is built automatically **every morning at 8am Melbourne time**, ready well before 9am. It works all year: GitHub runs at 21:00 and 22:00 UTC, and whichever of those is 8am in Melbourne (AEDT in summer, AEST in winter) builds the edition while the other one skips. If GitHub starts a little late, the edition is still built as long as it hasn't been already.

**To get a fresh edition at any other time** (for testing, or after changing settings or prompts):

1. Open the repo on GitHub and click the **Actions** tab.
2. Click **Morning Huddle** in the list on the left.
3. Click **Run workflow** (on the right), then the green **Run workflow** button.
4. Wait about a minute for the run to turn green, then refresh the app.

**To see the Wednesday edition on another day** (for testing): in step 3, tick **Pretend it's Wednesday** before clicking the green button. The app then shows the Wrap and a freshly ranked watch guide. The next morning's normal edition goes back to a daily brief, and the watch guide stays until the real Wednesday.

Each edition is saved to the separate **data** branch, so your `main` history only shows real changes to the app. On the Actions tab you'll see two scheduled runs each morning: one builds the edition, the other finishes in seconds having skipped. Both are green.

## The banner at the top of the app

| Banner | What it means |
|---|---|
| **Today's brief didn't update.** Reason: Couldn't get … from ESPN | A data source was down. The app shows the last good edition. Usually fixes itself the next morning, or do a manual run later. |
| **Today's brief didn't update.** Reason: The 8am update didn't run | It's after 10am and there's no edition for today. Check the Actions tab: GitHub may be running very late, or the schedule may have been switched off (see below). A manual run fixes it for today. |
| **Today's written brief didn't update.** | The scores and news are current, but Claude couldn't write the brief. The reason is shown; see "If the brief doesn't appear" below. |
| **Offline** (blue) | Your phone has no connection. You're seeing the last edition saved on the phone. |
| **Past edition** (blue) | You opened an old edition from the **i** button. Tap **Back to today**. |

**If the schedule ever stops:** GitHub switches off scheduled runs in a repo that has had no activity for 60 days, and emails you when it does. To switch it back on: **Actions → Morning Huddle → Enable workflow**.

## The written brief

Each edition makes **one** call to Claude (Haiku 5.5), which writes "If you only read one thing", "Why it matters", your teams' updates, player-form notes, typical recovery times, award races and the daily context card, and on Wednesdays the Wrap and the watch guide's ranking and reasons. Claude is only given the day's data and is told not to add anything that isn't in it. Every item it writes has to point back to the data it came from, and any item with a number that isn't in the data is dropped.

- **Edit the writing instructions** in [prompts/](prompts/): `style.md` is the voice (tone, spelling, the "facts only" rules), `daily-brief.md` says what to write each day, and `wednesday-wrap.md` and `watch-guide.md` cover the Wednesday Wrap and the watch guide. They're plain English, so edit them like a document, then do a manual run to see the effect.
- **See what Claude was given**: open `brief-input.json` on the **data** branch.
- **Check API usage**: open `usage.json` on the **data** branch (or https://harryedwards30.github.io/morning-huddle/data/usage.json). It lists the tokens and estimated cost of every run and the total for the month. A daily run costs about US$0.004 and a Wednesday run about US$0.009, so a month comes to roughly US$0.15 (about A$0.25). You can also see usage in the Claude Console.

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

### How to edit a file on GitHub
1. Open the repo on GitHub and click the file (for example `config` → `settings.json`).
2. Click the **pencil** icon (Edit this file) at the top right of the file.
3. Make your change. Keep the quote marks, commas and brackets exactly as they are around it.
4. Click **Commit changes…**, then **Commit changes** again.

The app republishes by itself in about a minute. Changes to what goes **into** the edition (teams, followed players, off-season, prompts) show from the next morning's edition, or do a manual run (see "When it updates") to see them straight away. If a run turns red straight after an edit, the edit probably broke the file's layout (a missing comma or quote): open the file's **History**, compare, and fix it, or ask Claude Code.

### Settings ([config/settings.json](config/settings.json))

| To… | Change |
|---|---|
| **Follow a player** | `"followedPlayers"`. Add each player's full name as ESPN writes it, and their league: `"followedPlayers": [{ "name": "Victor Wembanyama", "league": "nba" }, { "name": "Maxx Crosby", "league": "nfl" }]`. A **Players you follow** card then appears in that league's tab with their latest game, stat rankings, injury status and news. Set it back to `[]` to turn it off. |
| **Change a team** | Under `"teams"`: `"name"` must match ESPN's full team name exactly (for example `"Golden State Warriors"`); `"shortName"` is the button label; `"abbr"` is the chip (for example `"GSW"`); `"accent"` is the hub colour. |
| **Turn a section off or on** | Under `"sections"`: `"contextCard"`, `"awardRaces"` and `"seasonTimeline"` can each be `true` or `false`. |
| **Fix or add a season date** | Under `"seasonDates"`, each league has a list of `{ "label": "...", "date": "YYYY-MM-DD" }` (add `"endDate"` for a range). Use US dates. These drive the season timeline and the off-season's "Next up". Add next season's dates (the draft, free agency, opening night) once they're announced. |
| **Off-season** | `"offSeason": { "nba": "auto", "nfl": "auto" }`. `"auto"` follows ESPN. Use `true` to force a league into off-season mode, or `false` to keep it in season mode. |
| **Wednesday edition day** | `"schedule"` → `"wrapDay"` (for example `"Thursday"`). |
| **The Claude model** | `"ai"` → `"model"`. Leave it as `"claude-haiku-5-5"` unless you want to try another model (others cost more). |

Leave `"runLocalHour"` at 8: GitHub only starts the run between 7am and 9am Melbourne time.

### Other things
- **Writing instructions:** [prompts/](prompts/), described under "The written brief" above.
- **Card colours:** the top of [site/css/app.css](site/css/app.css). Each card type has two lines: `-bg` is the background tint and `-accent` is the header strip colour. For example, to change the injury cards, edit `--card-injury-bg` and `--card-injury-accent`. Keep the backgrounds dark so the text stays easy to read.
- **Undoing a change:** every change is kept in the repo's history. Open the file, click **History**, and you can see (and copy back) any earlier version.
- **Bigger changes** (a new section, a new data source): ask Claude Code. It reads [CLAUDE.md](CLAUDE.md) and [SPEC.md](SPEC.md) first.
