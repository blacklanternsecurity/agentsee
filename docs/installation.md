# Installation

## Requirements

- Node.js 18+
- npm
- jq (for the installer)

## Step 1: Clone and build

```bash
git clone https://github.com/blacklanternsecurity/agentsee.git
cd agentsee
npm install
cd dashboard && npm install && cd ..
npm run build
```

## Step 2: Configure Claude Code

The installer adds hooks and MCP config to your Claude Code setup:

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

The installer merges safely with your existing config — it never overwrites. Safe to run multiple times.

## Step 3: Add the prompt instruction

Add this line to your `CLAUDE.md` or wherever your agents get their system instructions:

```
If any tool call is rejected with an OPERATOR CHECKPOINT REQUIRED or OPERATOR INTERVENTION message, immediately call operator_checkpoint with a summary of your progress and intended next steps. Do not attempt other tools first.
```

This makes agents respond reliably when held. It's not strictly required — the hook denial message already tells them what to do — but it eliminates the occasional agent that tries another tool before complying.

## Step 4: Restart Claude Code

Claude Code reads hooks and MCP config on startup. Restart it to pick up the changes.

## Uninstall

```bash
bash uninstall.sh
```

Removes hooks, MCP config, and agent file patches. Follow the prompts — same system-wide vs project choice as the installer. Restart Claude Code after.
