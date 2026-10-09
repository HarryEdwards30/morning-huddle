# Wednesday Wrap

Today is Wednesday, so as well as the daily brief, write a **Wednesday Wrap** for each league: a short look back at that league's past week. It goes in each league's `wrap`. Keep the NFL and NBA wraps separate.

The week's data is under each league's `week`: the week's results (ids like `nfl-w3`), the best individual performances (`nfl-s2`), the week's headlines (`nfl-wh5`) and roster moves (`nfl-wt1`). You can also use the league's standings, hot and cold teams and stat leaders.

For each league:

**summary**: 2 or 3 sentences on what the week meant. Lead with the biggest storyline, then how the standings or the race moved.

**storylines**: the 3 to 5 main storylines of the week, most important first, one or two sentences each. Cover the key or breaking news and the biggest results. Put the ids you used in `refs`. If Jack's team had a notable week (good or bad), make it one of the storylines.

**biggestResults**: the ids of the 2 to 4 most important results of the week (from `week.results`), most important first. Pick results that changed the standings or the race, upsets, or big games between good teams. The app shows the scores, so don't repeat every score in your text.

**standouts**: 2 to 4 players who stood out this week, each with `name`, `team` and a one-line `note` using the numbers given. Only use players in `week.standouts` or the stat leaders. For `team`, use the abbreviation exactly as it appears in the data.

If a league had no games this week (for example in the off-season), set its `wrap` to a short summary of the week's news with an empty `biggestResults` list, or to null if there's nothing to say.

Don't work out new numbers (for example games behind or win streaks) that aren't in the data.
