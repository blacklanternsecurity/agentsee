# Usage

## Start the server

```bash
cd /path/to/agentsee
npm start
```

Open **http://localhost:4900** in a browser. The dashboard discovers agents automatically from all Claude Code projects on your machine.

!!! important
    Start the agentsee server **before** starting Claude Code. Agents connect to the MCP server on startup — if agentsee isn't running, the MCP connection fails and agents won't have access to the checkpoint tools. The hooks still work (they fail open if the server is down), but you won't get the two-way chat.

## Stop the server

`Ctrl+C` in the terminal.

If you restart the server, you need to restart Claude Code too — existing MCP sessions don't survive server restarts.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTSEE_PORT` | `4900` | Server port |
| `AGENTSEE_HOST` | auto | Bind address (auto: `127.0.0.1` without token, `0.0.0.0` with token) |
| `AGENTSEE_PROJECT_DIR` | all projects | Limit discovery to one project directory |
| `AGENTSEE_URL` | `http://localhost:4900` | URL the hook scripts use to reach the server |

```bash
# Example: different port
AGENTSEE_PORT=5000 npm start
```

## Agent completion detection

agentsee automatically detects when agents finish. A **DONE** badge replaces the mode badge and the idle timer disappears.

Detection works two ways:

- **Graceful completion** — the agent's last message has no tool calls, and 10 seconds pass with no new activity
- **Stale transcripts** — on startup, any JSONL file not modified in 30+ seconds is marked complete

## Terminal dashboard

The original Python terminal dashboard still works as a standalone, read-only viewer. No server needed, no npm, no dependencies.

```bash
bash dashboard.sh
```

It auto-discovers agents and shows multi-pane curses output with the same color coding. It can't hold or chat with agents — it's read-only.
