#!/usr/bin/env bash
# agentsee PostToolUse hook
# Fire-and-forget activity logging. Always exits 0.

INPUT=$(cat)
AGENTSEE_URL="${AGENTSEE_URL:-http://localhost:4900}"

echo "$INPUT" | curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @- \
  "$AGENTSEE_URL/hook/post" > /dev/null 2>&1 &

exit 0
