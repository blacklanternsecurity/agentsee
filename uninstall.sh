#!/usr/bin/env bash
# Remove agentsee hooks, MCP config, and agent file patches.
# Safe to run multiple times.

set -euo pipefail

AGENTS_DIR="$HOME/.claude/agents"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install it with your package manager."
  exit 1
fi

echo "agentsee uninstaller"
echo ""
echo "Where was agentsee installed?"
echo ""
echo "  1) System-wide (~/.claude/settings.json)"
echo "  2) Single project"
echo ""
printf "Choice [1]: "
read -r CHOICE
CHOICE="${CHOICE:-1}"

if [ "$CHOICE" = "2" ]; then
  printf "Project directory [%s]: " "$(pwd)"
  read -r PROJECT_DIR
  PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
  PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
  SETTINGS_FILE="$PROJECT_DIR/.claude/settings.json"
  MCP_FILE="$PROJECT_DIR/.mcp.json"
  echo ""
  echo "Removing from project: $PROJECT_DIR"
elif [ "$CHOICE" = "1" ]; then
  SETTINGS_FILE="$HOME/.claude/settings.json"
  MCP_FILE="$HOME/.claude/mcp.json"
  echo ""
  echo "Removing system-wide"
else
  echo "Invalid choice."
  exit 1
fi

echo ""
CHANGED=0

# --- Hooks ---

if [ -f "$SETTINGS_FILE" ]; then
  CURRENT=$(cat "$SETTINGS_FILE")

  if echo "$CURRENT" | grep -q "agentsee"; then
    CURRENT=$(echo "$CURRENT" | jq '
      .hooks.PreToolUse = [.hooks.PreToolUse[]? | select(.hooks[0].command | contains("agentsee") | not)] |
      .hooks.PostToolUse = [.hooks.PostToolUse[]? | select(.hooks[0].command | contains("agentsee") | not)] |
      if .hooks.PreToolUse == [] then del(.hooks.PreToolUse) else . end |
      if .hooks.PostToolUse == [] then del(.hooks.PostToolUse) else . end |
      if .hooks == {} then del(.hooks) else . end
    ')
    echo "$CURRENT" | jq . > "$SETTINGS_FILE"
    echo "[removed] agentsee hooks from settings.json"
    CHANGED=1
  else
    echo "[skip]    No agentsee hooks in settings.json"
  fi
else
  echo "[skip]    $SETTINGS_FILE not found"
fi

# --- MCP server ---

if [ -f "$MCP_FILE" ]; then
  MCP_CURRENT=$(cat "$MCP_FILE")

  if echo "$MCP_CURRENT" | jq -e '.mcpServers.agentsee' &>/dev/null; then
    MCP_CURRENT=$(echo "$MCP_CURRENT" | jq 'del(.mcpServers.agentsee)')
    echo "$MCP_CURRENT" | jq . > "$MCP_FILE"
    echo "[removed] agentsee MCP server from $(basename "$MCP_FILE")"
    CHANGED=1
  else
    echo "[skip]    No agentsee MCP server in $(basename "$MCP_FILE")"
  fi
else
  echo "[skip]    $MCP_FILE not found"
fi

# --- Agent files ---

if [ -d "$AGENTS_DIR" ]; then
  PATCHED=$(grep -rl "agentsee" "$AGENTS_DIR"/*.md 2>/dev/null || true)
  if [ -n "$PATCHED" ]; then
    echo ""
    echo "Found agent files with agentsee in mcpServers:"
    for F in $PATCHED; do
      echo "  - $(basename "$F")"
    done
    echo ""
    echo "This removes the following line from each file's mcpServers block:"
    echo "    - agentsee"
    echo ""
    printf "Unpatch these agent files? [Y/n]: "
    read -r UNPATCH
    UNPATCH="${UNPATCH:-Y}"

    if [[ "$UNPATCH" =~ ^[Yy] ]]; then
      for F in $PATCHED; do
        sed -i '/^  - agentsee$/d' "$F"
        echo "[removed] $(basename "$F")"
        CHANGED=1
      done
    else
      echo "[skip]    Agent files not modified"
    fi
  fi
fi

echo ""
if [ "$CHANGED" -eq 1 ]; then
  echo "Done. Restart Claude Code to pick up changes."
else
  echo "Nothing to do — agentsee not found in config."
fi
