# agentsee

> **Warning:** 100% vibe coded

Operator control plane for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agents. Watch agents in real time, hold them mid-run, chat with them, and switch between autonomous and supervised modes.

Works standalone with any Claude Code project that uses subagents. Also the intended control plane for [red-run](https://github.com/blacklanternsecurity/red-run).

![agentsee dashboard](assets/screenshot.jpeg)

🔵 Agent reasoning &nbsp;&nbsp; 🟡 Shell/Bash commands &nbsp;&nbsp; 🟢 Tool output &nbsp;&nbsp; ⚪ Other tool calls

## What it does

agentsee gives you a web dashboard where you can watch all your Claude Code agents work in real time and intervene whenever you want. You can:

- **Watch** agents think, run commands, and call tools with color-coded output
- **Hold** any agent mid-run — it stops on its next tool call
- **Chat** with held agents — tell them what to do, ask questions, redirect their work
- **Leash** agents — make them check in with you every N tool calls
- **Release** agents to run freely again

Without agentsee, you launch agents and hope for the best. With agentsee, you gain some agency over your agents.

## How it works

Claude Code writes agent transcripts as JSONL files. agentsee tails those files and streams the parsed output to the dashboard.

The control layer works through two mechanisms:

1. **Hooks** — a PreToolUse hook checks with the agentsee server before every tool call. If you've held the agent or it's used up its leash, the hook blocks the tool and tells the agent to check in.

2. **MCP tools** — the agent calls `operator_checkpoint` to check in. This blocks the agent until you respond through the dashboard. Your response arrives as a natural tool result in the agent's conversation.

## Requirements

- Node.js 18+
- npm
- jq (for the installer)
- Python 3.10+ (only if you want the terminal dashboard)

## Install

### Step 1: Clone and build

```bash
git clone https://github.com/blacklanternsecurity/agentsee.git
cd agentsee
npm install
cd dashboard && npm install && cd ..
npm run build
```

### Step 2: Configure Claude Code

The installer adds hooks and MCP config to your Claude Code setup. Run it and follow the prompts:

```bash
bash install.sh
```

It will ask:

```
Where do you want to install hooks and MCP config?

  1) System-wide (~/.claude/settings.json)
     Hooks and MCP apply to all Claude Code projects.

  2) Single project
     Hooks and MCP only apply to one project directory.
```

**Option 1 (system-wide)** is recommended for most users. It means agentsee works with every project automatically.

**Option 2 (single project)** is useful if you only want agentsee for one specific project.

The installer:
- Adds PreToolUse and PostToolUse hooks to your settings
- Adds the agentsee MCP server to your MCP config
- If you have custom agent files in `~/.claude/agents/` with explicit `mcpServers` lists, it offers to patch them (adds `- agentsee` to each file's list so agents can access the checkpoint tools)

The installer merges safely with your existing config — it never overwrites. Safe to run multiple times. Run `bash uninstall.sh` to undo everything.

### Step 3: Add the prompt instruction

Add this line to your `CLAUDE.md` or wherever your agents get their system instructions:

```
If any tool call is rejected with an OPERATOR CHECKPOINT REQUIRED or OPERATOR INTERVENTION message, immediately call operator_checkpoint with a summary of your progress and intended next steps. Do not attempt other tools first.
```

This makes agents respond reliably when held. It's not strictly required — the hook denial message already tells them what to do — but it eliminates the occasional agent that tries another tool before complying.

### Step 4: Restart Claude Code

Claude Code reads hooks and MCP config on startup. Restart it to pick up the changes.

## Usage

### Start the server

```bash
cd /path/to/agentsee
npm start
```

Open **http://localhost:4900** in a browser. The dashboard discovers agents automatically from all Claude Code projects on your machine.

**Important:** Start the agentsee server *before* starting Claude Code. Agents connect to the MCP server on startup — if agentsee isn't running, the MCP connection fails and agents won't have access to the checkpoint tools. The hooks still work (they fail open if the server is down), but you won't get the two-way chat.

### Stop the server

`Ctrl+C` in the terminal.

If you restart the server, you need to restart Claude Code too — existing MCP sessions don't survive server restarts.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTSEE_PORT` | `4900` | Server port |
| `AGENTSEE_PROJECT_DIR` | all projects | Limit discovery to one project directory |
| `AGENTSEE_URL` | `http://localhost:4900` | URL the hook scripts use to reach the server |

```bash
# Example: different port
AGENTSEE_PORT=5000 npm start
```

## Dashboard guide

### Layout

The dashboard uses a **tab + pane** layout. Tabs are workspaces. Each tab contains auto-tiling agent panes that fill the screen.

- **1 agent** = full screen
- **2 agents** = side by side
- **4 agents** = 2x2 grid
- More agents keep tiling

Create tabs to organize agents by task — group related agents together and switch between workspaces. Agents can be moved between tabs using the agent browser.

### Agent panes

Each pane shows one agent's live output with color coding:

| Color | What it shows |
|-------|---------------|
| **Cyan** | Agent reasoning and thinking |
| **Yellow** | Shell commands, bash commands |
| **Green** | Tool output and results |
| **Gray** | Other tool calls (file reads, MCP calls, etc.) |

The pane header shows:
- Agent name/description
- Mode badge (Auto, Supervised, Held, Checking In)
- Spinner + idle timer (spinner appears at 5s, disappears at 5m)
- Chat icon (if you've chatted with this agent before)
- Hold/Resume button
- Leash control
- Expand/dismiss buttons

### Modes

Every agent runs in one of two modes:

**Autonomous** — the agent runs freely. You can still hold it at any time, but it won't check in automatically. This is the default.

**Supervised (leashed)** — the agent checks in with you after a set number of tool calls. Set the leash to 1 and it checks in after every single tool. Set it to 10 and it runs 10 tools then checks in. The remaining count shows next to the leash input and counts down as tools execute.

To switch modes, use the controls in the pane header:
- Click **Auto** to go autonomous
- Type a number in the **Leash** field and press Enter to go supervised

You can change modes mid-run. No restart needed.

### Holding an agent

Click **Hold** in any pane header. The agent's next tool call will be blocked. The agent will then call `operator_checkpoint` and you'll see the chat panel open with its summary.

### Chatting with agents

When an agent checks in (either from a hold or from reaching its leash limit), a chat panel opens. It shows:

- The agent's summary of what it's done and what it wants to do
- Any specific question the agent has
- Your previous conversation with this agent

Type your response and choose:

- **Send + Release** — your message is delivered and the agent runs freely
- **Send + Keep held** (check "Request response") — your message is delivered but the agent stays held. After its next tool call, it checks in again. Use this for back-and-forth conversation.

The chat icon stays on the pane header after a conversation. Click it anytime to review the history or continue the conversation.

### Agent browser

Click **Agents** in the top right (or press `b`) to open the agent browser. It lists all discovered agents. Click to toggle an agent onto the current tab. Click **Purge** to permanently delete an agent's transcript from disk.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1-9` | Switch to tab 1-9 |
| `Ctrl+T` | New tab |
| `Tab` / `Shift+Tab` | Focus next/previous pane |
| `f` | Maximize/restore focused pane |
| `d` | Dismiss focused pane from tab |
| `b` | Toggle agent browser |
| `h` | Hold focused agent |
| `r` | Release focused agent |

### Purging agents

Agents that are no longer relevant can be purged from the agent browser. This deletes the JSONL transcript from disk — it's not recoverable.

For a bulk purge of all agents from the terminal:

```bash
bash dashboard.sh --purge
```

## Terminal dashboard

The original Python terminal dashboard still works as a standalone, read-only viewer. No server needed, no npm, no dependencies.

```bash
bash dashboard.sh
```

It auto-discovers agents and shows multi-pane curses output with the same color coding. It can't hold or chat with agents — it's read-only.

## API

All endpoints are on the same port as the dashboard. Useful for scripting or integrating with other tools.

```bash
# View all agents
curl http://localhost:4900/agent/status

# Hold an agent
curl -X POST http://localhost:4900/agent/AGENT_ID/hold

# Release an agent
curl -X POST http://localhost:4900/agent/AGENT_ID/release

# Set leash (check in every 5 tools)
curl -X POST http://localhost:4900/agent/AGENT_ID/threshold \
  -H "Content-Type: application/json" -d '{"threshold": 5}'

# Set autonomous
curl -X POST http://localhost:4900/agent/AGENT_ID/threshold \
  -H "Content-Type: application/json" -d '{"threshold": null}'

# Health check
curl http://localhost:4900/health
```

## Uninstall

```bash
bash uninstall.sh
```

Removes hooks, MCP config, and agent file patches. Follow the prompts — same system-wide vs project choice as the installer. Restart Claude Code after.

## License

GPL-3.0 — see [LICENSE](LICENSE)
