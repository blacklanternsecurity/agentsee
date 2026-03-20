import { readdir, stat, readlink, unlink } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";
import { extractLabel } from "./jsonl-parser.js";

/**
 * Delete an agent's JSONL transcript from disk.
 * Returns true if a file was deleted.
 */
export async function purgeAgent(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface DiscoveredAgent {
  label: string;
  filePath: string;
  mtime: number;
  agentId: string; // derived from filename
}

/**
 * Discover agent JSONL transcripts for a project.
 *
 * Searches:
 * 1. ~/.claude/projects/<project>/<session>/subagents/agent-*.jsonl
 * 2. /tmp/claude-<uid>/<project>/tasks/*.output (symlinks only)
 *
 * Port of Python _discover_agents() + _find_subagent_dirs().
 */
export async function discoverAgents(
  projectDir: string
): Promise<DiscoveredAgent[]> {
  const seen = new Set<string>();
  const results: DiscoveredAgent[] = [];
  const cutoff = Date.now() - 86400_000; // 24 hours

  // Source 1: subagent JSONL directories
  const subagentDirs = await findSubagentDirs(projectDir);
  for (const dir of subagentDirs) {
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        if (!entry.startsWith("agent-") || !entry.endsWith(".jsonl")) continue;
        const filePath = join(dir, entry);
        try {
          const st = await stat(filePath);
          if (st.mtimeMs < cutoff) continue;
          if (seen.has(filePath)) continue;
          seen.add(filePath);

          const agentId = basename(entry, ".jsonl");

          const label = await getLabel(filePath) ?? agentId;
          results.push({ label, filePath, mtime: st.mtimeMs, agentId });
        } catch {}
      }
    } catch {}
  }

  // Source 2: tasks directory (symlinks to JSONL)
  const tasksDir = getTasksDir(projectDir);
  try {
    const entries = await readdir(tasksDir);
    for (const entry of entries) {
      if (!entry.endsWith(".output")) continue;
      const filePath = join(tasksDir, entry);
      try {
        const target = await readlink(filePath);
        if (!target.endsWith(".jsonl")) continue;
        const st = await stat(filePath);
        if (st.mtimeMs < cutoff) continue;

        // Resolve to real path for dedup
        const { realpath } = await import("fs/promises");
        const resolved = await realpath(filePath);
        if (seen.has(resolved)) continue;
        seen.add(resolved);

        const targetBase = basename(target, ".jsonl");
        // Skip non-subagent files (parent sessions have UUID names, not agent-* names)
        if (!targetBase.startsWith("agent-")) continue;

        const agentId = targetBase || basename(entry, ".output");

        const label = await getLabel(filePath) ?? agentId;
        results.push({ label, filePath, mtime: st.mtimeMs, agentId });
      } catch {}
    }
  } catch {}

  results.sort((a, b) => b.mtime - a.mtime);
  return results;
}

function getTasksDir(projectDir: string): string {
  const encoded = projectDir.replace(/\//g, "-");
  return `/tmp/claude-${process.getuid?.() ?? 1000}/${encoded}/tasks`;
}

async function findSubagentDirs(projectDir: string): Promise<string[]> {
  const projectsRoot = join(homedir(), ".claude", "projects");
  const results: { mtime: number; path: string }[] = [];

  // If a specific project dir is set, search only that project
  if (projectDir) {
    const encoded = projectDir.replace(/\//g, "-");
    const projectBase = join(projectsRoot, encoded);
    try {
      await stat(projectBase);
      await scanProjectBase(projectBase, results);
      if (results.length > 0) {
        results.sort((a, b) => b.mtime - a.mtime);
        return results.map((r) => r.path);
      }
    } catch {}
  }

  // Default: scan ALL projects under ~/.claude/projects/
  try {
    const entries = await readdir(projectsRoot);
    for (const entry of entries) {
      if (!entry.startsWith("-")) continue;
      const projectBase = join(projectsRoot, entry);
      try {
        const st = await stat(projectBase);
        if (st.isDirectory()) {
          await scanProjectBase(projectBase, results);
        }
      } catch {}
    }
  } catch {}

  results.sort((a, b) => b.mtime - a.mtime);
  return results.map((r) => r.path);
}

async function scanProjectBase(
  projectBase: string,
  results: { mtime: number; path: string }[]
): Promise<void> {
  try {
    const sessions = await readdir(projectBase);
    for (const session of sessions) {
      const subagentsDir = join(projectBase, session, "subagents");
      try {
        const st = await stat(subagentsDir);
        if (st.isDirectory()) {
          results.push({ mtime: st.mtimeMs, path: subagentsDir });
        }
      } catch {}
    }
  } catch {}
}

async function getLabel(filePath: string): Promise<string | null> {
  try {
    const fh = await import("fs/promises").then((m) => m.open(filePath, "r"));
    const buf = Buffer.alloc(4096);
    const { bytesRead } = await fh.read(buf, 0, 4096, 0);
    await fh.close();
    if (bytesRead === 0) return null;
    const text = buf.toString("utf-8", 0, bytesRead);
    const firstLine = text.split("\n")[0];
    return extractLabel(firstLine);
  } catch {
    return null;
  }
}
