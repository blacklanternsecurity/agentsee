# agentsee

Live multi-pane terminal dashboard for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agents. Watch your agents think, execute commands, and call tools in real time.

**Zero dependencies** — pure Python 3.10+ stdlib (`curses`, `json`, `threading`).

![agentsee dashboard](screenshot.jpeg)

🔵 Agent reasoning &nbsp;&nbsp; 🟡 Shell/Bash commands &nbsp;&nbsp; 🟢 Tool output &nbsp;&nbsp; ⚪ Other tool calls

## Features

- **Auto-discovery** — automatically detects new agents as they spawn, no configuration needed
- **Multi-pane split view** — see multiple agents side by side in a single terminal
- **Color-coded output** — agent reasoning (cyan), shell commands (yellow), tool calls (dim), tool results (green)
- **Live follow** — auto-scrolls with new output, scroll up to pause, jump to bottom to resume
- **Idle detection** — pane headers show how long since last activity with escalating color warnings (gold → orange → red)
- **Agent browser** — press `b` to browse all agents from the current session, add completed agents back to the dashboard
- **Single-agent modes** — one-shot print, live tail (`-f`), or pipe from stdin
- **Purge history** — `--purge` to wipe all agent transcripts for a clean slate

## Install

Clone or download — there's nothing to install:

```bash
git clone https://github.com/blacklanternsecurity/agentsee.git
```

## Quick start

Run from your Claude Code project directory:

```bash
# Auto-discover agents (recommended)
bash agentsee/agentsee.sh

# Or run the Python script directly
python3 agentsee/agentsee.py --dashboard --project-dir .
```

The dashboard starts with "Waiting for agents..." and picks up new agents automatically as they spawn. It discovers agents from two sources:

1. **Subagent JSONL transcripts** in `~/.claude/projects/<project>/*/subagents/`
2. **Task output symlinks** in `/tmp/claude-<uid>/<project>/tasks/`

## Usage

### Dashboard mode (multi-agent)

```bash
# Auto-discover from project directory
bash agentsee.sh

# Explicit label:path pairs
python3 agentsee.py --dashboard web:path1 recon:path2

# With project directory hint (when running from a different cwd)
python3 agentsee.py --dashboard --project-dir /path/to/project
```

### Single-agent modes

```bash
# One-shot: print formatted output and exit
python3 agentsee.py <output_file>

# Follow: live-tail like tail -f (Ctrl-C to stop)
python3 agentsee.py -f <output_file>

# Pipe: read from stdin
tail -f <output_file> | python3 agentsee.py
```

### Purge agent history

Delete all agent transcripts for the current project:

```bash
bash agentsee.sh --purge
```

Prompts for confirmation before deleting.

## Keybindings

### Dashboard

| Key | Action |
|-----|--------|
| `Tab` | Switch to next pane |
| `Shift-Tab` | Switch to previous pane |
| `j` / `Down` | Scroll down |
| `k` / `Up` | Scroll up |
| `PgDn` | Page down |
| `PgUp` | Page up |
| `G` / `End` | Jump to bottom (resume live follow) |
| `g` / `Home` | Jump to top |
| `d` | Dismiss focused pane (double-tap within 2s to confirm) |
| `b` | Open agent browser |
| `q` / `Ctrl-C` | Quit |

### Agent browser

| Key | Action |
|-----|--------|
| `j` / `Down` | Move cursor down |
| `k` / `Up` | Move cursor up |
| `Space` / `Enter` | Toggle agent on/off dashboard |
| `b` / `Escape` | Close browser |

## Color coding

| Color | Category | Examples |
|-------|----------|----------|
| **Cyan** | Agent reasoning | Thinking, analysis, planning text |
| **Yellow** (bold, `▶`) | Commands | `SHELL[sid] whoami`, `BASH ls -la`, `PROC evil-winrm` |
| **Green** | Tool results | Command output, server responses |
| **Dim** | Other tool calls | `SKILL get_skill(name)`, `STATE get_summary`, `READ path`, `BROWSER navigate(url)` |

### Pane header indicators

| Indicator | Meaning |
|-----------|---------|
| Spinner + time (e.g., `⠋ 12s`) | Agent is idle but recent |
| Gold elapsed (≥30s) | Agent idle for a while |
| Orange elapsed (≥60s) | Agent may be stalled |
| Red `idle 2m` (≥120s) | Agent likely finished or dead |

## Output format

The dashboard parses JSONL lines with `"type":"assistant"` and formats tool calls as compact one-liners:

| Format | Source |
|--------|--------|
| `SHELL[sid] command` | Shell send_command |
| `LISTEN port=N label=X` | Shell start_listener |
| `PROC command` | Shell start_process |
| `BASH (description) command` | Bash tool |
| `SKILL get_skill(name)` | Skill router |
| `STATE get_summary` | State server |
| `BROWSER navigate(url=...)` | Browser automation |
| `READ` / `WRITE` / `EDIT` / `GREP` / `GLOB` | Built-in file tools |

## How it works

Claude Code stores agent transcripts as JSONL files under `~/.claude/projects/`. Each line is a JSON object representing a conversation turn — user messages, assistant responses with text and tool calls, and tool results.

agentsee polls these directories for new files, parses the JSONL in real time, and renders a formatted view. It extracts labels from agent prompts (skill names, agent types) and tracks file modification times to detect idle/completed agents.

## License

GPL-3.0 — see [LICENSE](LICENSE)
