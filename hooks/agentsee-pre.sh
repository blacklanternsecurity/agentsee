#!/usr/bin/env bash
# agentsee PreToolUse hook
# Reads tool call JSON from stdin, checks with agentsee server, blocks if denied.
# Exit 0 = allow, Exit 2 = deny (reason printed to stderr)

INPUT=$(cat)
AGENTSEE_URL="${AGENTSEE_URL:-http://localhost:4900}"

RESPONSE=$(echo "$INPUT" | curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @- \
  "$AGENTSEE_URL/hook/pre" 2>/dev/null)

# If agentsee is unreachable, allow (fail open)
if [ -z "$RESPONSE" ]; then
  exit 0
fi

ALLOWED=$(echo "$RESPONSE" | jq -r '.allow' 2>/dev/null)

if [ "$ALLOWED" = "true" ]; then
  exit 0
else
  REASON=$(echo "$RESPONSE" | jq -r '.reason // "Blocked by operator"' 2>/dev/null)
  echo "$REASON" >&2
  exit 2
fi
