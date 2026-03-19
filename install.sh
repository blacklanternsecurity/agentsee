#!/usr/bin/env bash
# Install agentsee hooks and MCP server into Claude Code.
# Safe to run multiple times — merges with existing config, never overwrites.

set -euo pipefail

AGENTSEE_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_DIR="$HOME/.claude/agents"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install it with your package manager."
  exit 1
fi

echo "agentsee installer"
echo ""
echo "Where do you want to install hooks and MCP config?"
echo ""
echo "  1) System-wide (~/.claude/settings.json)"
echo "     Hooks and MCP apply to all Claude Code projects."
echo ""
echo "  2) Single project"
echo "     Hooks and MCP only apply to one project directory."
echo ""
printf "Choice [1]: "
read -r CHOICE
CHOICE="${CHOICE:-1}"

if [ "$CHOICE" = "2" ]; then
  printf "Project directory [%s]: " "$(pwd)"
  read -r PROJECT_DIR
  PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
  PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
  SETTINGS_DIR="$PROJECT_DIR/.claude"
  SETTINGS_FILE="$SETTINGS_DIR/settings.json"
  MCP_FILE="$PROJECT_DIR/.mcp.json"
  echo ""
  echo "Installing to project: $PROJECT_DIR"
elif [ "$CHOICE" = "1" ]; then
  SETTINGS_DIR="$HOME/.claude"
  SETTINGS_FILE="$SETTINGS_DIR/settings.json"
  MCP_FILE="$SETTINGS_DIR/mcp.json"
  echo ""
  echo "Installing system-wide: $SETTINGS_DIR"
else
  echo "Invalid choice."
  exit 1
fi

echo ""

HOOK_ENTRY_PRE=$(cat <<HOOK
{
  "matcher": "",
  "hooks": [{"type": "command", "command": "bash $AGENTSEE_DIR/hooks/agentsee-pre.sh"}]
}
HOOK
)

HOOK_ENTRY_POST=$(cat <<HOOK
{
  "matcher": "",
  "hooks": [{"type": "command", "command": "bash $AGENTSEE_DIR/hooks/agentsee-post.sh"}]
}
HOOK
)

# --- Settings (hooks) ---

mkdir -p "$SETTINGS_DIR"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

CURRENT=$(cat "$SETTINGS_FILE")
CHANGED=0

if echo "$CURRENT" | grep -q "agentsee-pre.sh"; then
  echo "[skip] PreToolUse hook already configured"
else
  CURRENT=$(echo "$CURRENT" | jq --argjson entry "$HOOK_ENTRY_PRE" '
    .hooks.PreToolUse = (.hooks.PreToolUse // []) + [$entry]
  ')
  echo "[add]  PreToolUse hook"
  CHANGED=1
fi

if echo "$CURRENT" | grep -q "agentsee-post.sh"; then
  echo "[skip] PostToolUse hook already configured"
else
  CURRENT=$(echo "$CURRENT" | jq --argjson entry "$HOOK_ENTRY_POST" '
    .hooks.PostToolUse = (.hooks.PostToolUse // []) + [$entry]
  ')
  echo "[add]  PostToolUse hook"
  CHANGED=1
fi

if [ "$CHANGED" -eq 1 ]; then
  echo "$CURRENT" | jq . > "$SETTINGS_FILE"
fi

# --- MCP server ---

MCP_CHANGED=0

if [ ! -f "$MCP_FILE" ]; then
  echo '{}' > "$MCP_FILE"
fi

MCP_CURRENT=$(cat "$MCP_FILE")

if echo "$MCP_CURRENT" | jq -e '.mcpServers.agentsee' &>/dev/null; then
  echo "[skip] MCP server already configured"
else
  MCP_CURRENT=$(echo "$MCP_CURRENT" | jq '
    .mcpServers.agentsee = {"type": "http", "url": "http://localhost:4900/mcp"}
  ')
  echo "[add]  MCP server (agentsee -> http://localhost:4900/mcp)"
  echo "$MCP_CURRENT" | jq . > "$MCP_FILE"
  MCP_CHANGED=1
fi

# --- Agent files ---

AGENT_CHANGED=0

if [ -d "$AGENTS_DIR" ]; then
  AGENT_FILES=$(grep -rl "mcpServers:" "$AGENTS_DIR"/*.md 2>/dev/null || true)
  NEEDS_PATCH=""
  for F in $AGENT_FILES; do
    if ! grep -q "agentsee" "$F"; then
      NEEDS_PATCH="$NEEDS_PATCH $F"
    fi
  done

  if [ -n "$NEEDS_PATCH" ]; then
    echo ""
    echo "Found agent files with mcpServers lists in $AGENTS_DIR:"
    for F in $NEEDS_PATCH; do
      echo "  - $(basename "$F")"
    done
    echo ""
    echo "Agents with explicit mcpServers lists won't see the agentsee MCP"
    echo "tools unless 'agentsee' is added to their list."
    echo ""
    echo "This appends the following line to each file's mcpServers block:"
    echo "    - agentsee"
    echo ""
    printf "Patch these agent files? [Y/n]: "
    read -r PATCH_AGENTS
    PATCH_AGENTS="${PATCH_AGENTS:-Y}"

    if [[ "$PATCH_AGENTS" =~ ^[Yy] ]]; then
      for AGENT_FILE in $NEEDS_PATCH; do
        AGENT_NAME=$(basename "$AGENT_FILE")
        printf "  Patch %s? [Y/n]: " "$AGENT_NAME"
        read -r PATCH_THIS
        PATCH_THIS="${PATCH_THIS:-Y}"
        if [[ ! "$PATCH_THIS" =~ ^[Yy] ]]; then
          echo "  [skip] $AGENT_NAME"
          continue
        fi
        MCP_LINE=$(grep -n "mcpServers:" "$AGENT_FILE" | head -1 | cut -d: -f1)
        if [ -n "$MCP_LINE" ]; then
          # Count consecutive "  - " lines after mcpServers:
          COUNT=0
          while IFS= read -r line; do
            if [[ "$line" =~ ^"  - " ]]; then
              COUNT=$((COUNT + 1))
            else
              break
            fi
          done < <(tail -n +"$((MCP_LINE + 1))" "$AGENT_FILE")
          if [ "$COUNT" -gt 0 ]; then
            INSERT_AT=$((MCP_LINE + COUNT))
            sed -i "${INSERT_AT}a\\  - agentsee" "$AGENT_FILE"
            echo "  [add]  $AGENT_NAME"
            AGENT_CHANGED=1
          fi
        fi
      done
    else
      echo "[skip] Agent files not modified"
    fi
  else
    echo ""
    if [ -n "$AGENT_FILES" ]; then
      echo "[skip] All agent files already have agentsee"
    fi
  fi
fi

echo ""
if [ "$CHANGED" -eq 1 ] || [ "$MCP_CHANGED" -eq 1 ] || [ "$AGENT_CHANGED" -eq 1 ]; then
  echo "Done. Restart Claude Code to pick up changes."
else
  echo "Nothing to do — already configured."
fi
