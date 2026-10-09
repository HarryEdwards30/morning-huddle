#!/usr/bin/env bash
# The daily editions live on a separate "data" branch, so main only shows real changes to the app.
#
#   bash scripts/data-branch.sh checkout <folder>   put the data branch in <folder> (creates the branch the first time)
#   bash scripts/data-branch.sh save <folder>       commit and push whatever changed in <folder>
set -euo pipefail

action="${1:?checkout or save}"
dir="${2:?folder}"
branch="${DATA_BRANCH:-data}"   # only changed for testing

case "$action" in
  checkout)
    if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
      git fetch --quiet --depth=1 origin "$branch"
      git worktree add --quiet -B "$branch" "$dir" FETCH_HEAD
      echo "Checked out the data branch into $dir"
    else
      git worktree add --quiet --detach "$dir"
      git -C "$dir" checkout --quiet --orphan "$branch"
      git -C "$dir" rm -rfq . >/dev/null 2>&1 || true
      cat > "$dir/README.md" <<'README'
# Morning Huddle data

This branch is written by the "Morning Huddle" workflow. Don't edit it by hand.

- `latest.json`: the edition the app shows
- `editions/`: one file per day, kept for 60 days
- `status.json`: whether the last run worked, and how each data source went
README
      echo "Created a new data branch in $dir"
    fi
    ;;
  save)
    git -C "$dir" add -A
    if git -C "$dir" diff --cached --quiet; then
      echo "No changes to save."
      exit 0
    fi
    git -C "$dir" -c user.name="Morning Huddle" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
      commit --quiet -m "Edition $(TZ=Australia/Melbourne date '+%Y-%m-%d %H:%M %Z')"
    git -C "$dir" push --quiet origin "$branch"
    echo "Saved the edition to the data branch."
    ;;
  *)
    echo "Unknown action: $action" >&2
    exit 1
    ;;
esac
