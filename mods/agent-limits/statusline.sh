#!/bin/sh
# Optional Claude Code statusLine command for the agent-limits mod.
# Claude Code hands its statusline the account's rate_limits after every answer; this saves them
# so the Limits panel follows Claude between server checks. Any arguments are another statusline
# command to run with the same input, so an existing statusline keeps working:
#   "statusLine": { "type": "command",
#     "command": "~/.config/herdr-app/mods/agent-limits/statusline.sh ~/bin/my-statusline" }

PATH="$PATH:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin"
input=$(cat)
cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/agent-limits"

# The statusline repeats the last answer's numbers on every redraw; stamp a value only when it
# changes, so updated_at says when it was seen and a newer server check isn't buried.
rl=$(printf '%s' "$input" | jq -c '.rate_limits // empty' 2>/dev/null)
old=$(jq -c '.rate_limits' "$cache_dir/claude.json" 2>/dev/null)
if [ -n "$rl" ] && [ "$rl" != "$old" ]; then
  mkdir -p "$cache_dir"
  tmp="$cache_dir/claude.json.$$"
  printf '{"updated_at":%s,"rate_limits":%s}\n' "$(date +%s)" "$rl" >"$tmp" &&
    mv -f "$tmp" "$cache_dir/claude.json"
fi

if [ "$#" -gt 0 ]; then
  printf '%s' "$input" | "$@"
fi
