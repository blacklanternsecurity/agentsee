import { StreamEntry } from "./types.js";

/** Tool names whose results we render (Bash, shell commands). */
const SHOW_RESULT_TOOLS = new Set([
  "Bash",
  "mcp__shell-server__send_command",
  "mcp__shell-server__read_output",
  "mcp__shell-server__start_process",
  "mcp__shell-server__stabilize_shell",
]);

const ANSI_RE = /\x1b\[[\x20-\x3f]*[\x40-\x7e]|\x1b[()][0-9A-B]|\x01|\x02/g;

/** Track tool_use_id -> tool_name for result rendering across lines. */
export type PendingTools = Map<string, string>;

/**
 * Format a tool_use call into (category, compact one-liner).
 * Port of Python format_tool().
 */
function formatTool(
  name: string,
  inp: Record<string, any>
): { category: StreamEntry["category"]; formatted: string } {
  // Shell server tools
  if (name === "mcp__shell-server__send_command") {
    const sid = String(inp.session_id ?? "").slice(0, 8);
    return { category: "command", formatted: `SHELL[${sid}] ${inp.command ?? ""}` };
  }
  if (name === "mcp__shell-server__start_listener") {
    return {
      category: "command",
      formatted: `LISTEN port=${inp.port ?? ""} label=${inp.label ?? ""}`,
    };
  }
  if (name === "mcp__shell-server__start_process") {
    return { category: "command", formatted: `PROC ${inp.command ?? ""}` };
  }
  if (name === "mcp__shell-server__read_output") {
    return {
      category: "tool_call",
      formatted: `READ[${String(inp.session_id ?? "").slice(0, 8)}]`,
    };
  }
  if (name === "mcp__shell-server__stabilize_shell") {
    return {
      category: "tool_call",
      formatted: `STABILIZE[${String(inp.session_id ?? "").slice(0, 8)}]`,
    };
  }

  // Skill router
  if (name.includes("skill-router")) {
    const tool = name.split("__").pop() ?? name;
    const args = Object.values(inp).map(String).join(", ");
    return { category: "tool_call", formatted: `SKILL ${tool}(${args})` };
  }

  // State server
  if (name.includes("state")) {
    const tool = name.split("__").pop() ?? name;
    return { category: "tool_call", formatted: `STATE ${tool}` };
  }

  // Browser
  if (name.includes("browser")) {
    const tool = name.split("__").pop() ?? name;
    const args = Object.entries(inp)
      .map(([k, v]) => `${k}=${String(v).slice(0, 60)}`)
      .join(" ");
    return { category: "tool_call", formatted: `BROWSER ${tool}(${args})` };
  }

  // Built-in Claude Code tools
  if (name === "Bash") {
    const cmd = String(inp.command ?? "");
    const desc = inp.description ? `(${inp.description}) ` : "";
    return { category: "command", formatted: `BASH ${desc}${cmd}` };
  }
  if (name === "Read")
    return { category: "tool_call", formatted: `READ ${inp.file_path ?? ""}` };
  if (name === "Write")
    return { category: "tool_call", formatted: `WRITE ${inp.file_path ?? ""}` };
  if (name === "Edit")
    return { category: "tool_call", formatted: `EDIT ${inp.file_path ?? ""}` };
  if (name === "Grep") {
    const pattern = inp.pattern ?? "";
    const path = inp.path ?? inp.glob ?? "";
    const suffix = path ? ` (in ${path})` : "";
    return { category: "tool_call", formatted: `GREP ${pattern}${suffix}` };
  }
  if (name === "Glob")
    return { category: "tool_call", formatted: `GLOB ${inp.pattern ?? ""}` };
  if (name === "Agent")
    return {
      category: "tool_call",
      formatted: `AGENT ${inp.description ?? ""}`,
    };

  return { category: "tool_call", formatted: `TOOL ${name}` };
}

/** Clean a tool result string for display. */
function cleanResult(raw: string): string {
  // Unwrap MCP JSON wrapper: {"result": "..."}
  if (raw.startsWith('{"result":')) {
    try {
      const obj = JSON.parse(raw);
      if (typeof obj.result === "string") raw = obj.result;
    } catch {}
  }
  // start_process response: extract key fields
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (obj.session_id) {
        const parts = [`session=${obj.session_id}`];
        if (obj.label) parts.push(obj.label);
        if (obj.message) parts.push(obj.message);
        return parts.join(" | ");
      }
    } catch {}
  }
  // Strip ANSI, normalize newlines, collapse blanks
  let clean = raw.replace(ANSI_RE, "");
  clean = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (clean.includes("\n\n\n")) {
    clean = clean.replace(/\n\n\n/g, "\n\n");
  }
  return clean.trim();
}

/**
 * Parse a single JSONL line into StreamEntry items.
 * Port of Python parse_line(). Mutates pending in-place.
 */
export function parseLine(
  line: string,
  pending: PendingTools,
  agentId: string,
  byteOffset: number
): StreamEntry[] {
  line = line.trim();
  if (!line) return [];

  let obj: any;
  try {
    obj = JSON.parse(line);
  } catch {
    return [];
  }

  const results: StreamEntry[] = [];
  const now = new Date();
  const msgType = obj.type;

  if (msgType === "assistant") {
    const content = obj.message?.content;
    if (!Array.isArray(content)) return [];

    for (const item of content) {
      if (typeof item !== "object" || item === null) continue;

      if (item.type === "text") {
        const text = (item.text ?? "").trim();
        if (text) {
          results.push({
            timestamp: now,
            category: "reasoning",
            formatted: text,
            raw_text: text,
            agent_id: agentId,
            byte_offset: byteOffset,
          });
        }
      } else if (item.type === "tool_use") {
        const name = item.name ?? "";
        const inp = item.input ?? {};
        const { category, formatted } = formatTool(name, inp);
        results.push({
          timestamp: now,
          category,
          formatted,
          tool_name: name,
          agent_id: agentId,
          byte_offset: byteOffset,
        });

        // Track tools whose output we display
        const toolId = item.id ?? "";
        if (toolId && SHOW_RESULT_TOOLS.has(name)) {
          pending.set(toolId, name);
        }
      }
    }
  } else if (msgType === "user") {
    const content = obj.message?.content;
    if (!Array.isArray(content)) return [];

    for (const item of content) {
      if (typeof item !== "object" || item === null) continue;

      if (item.type === "tool_result") {
        const tid = item.tool_use_id ?? "";
        if (pending.has(tid)) {
          pending.delete(tid);
          const rawContent = item.content ?? "";
          if (typeof rawContent === "string" && rawContent.trim()) {
            const cleaned = cleanResult(rawContent);
            if (cleaned) {
              results.push({
                timestamp: now,
                category: "tool_result",
                formatted: cleaned,
                agent_id: agentId,
                byte_offset: byteOffset,
              });
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Extract a label from the first line of a JSONL transcript.
 * Port of Python _extract_label().
 */
export function extractLabel(firstLine: string): string | null {
  try {
    const obj = JSON.parse(firstLine);
    if (obj.type === "user") {
      let content = "";
      const msg = obj.message;
      if (typeof msg === "string") {
        content = msg;
      } else if (msg && typeof msg === "object") {
        const c = msg.content;
        if (typeof c === "string") {
          content = c;
        } else if (Array.isArray(c)) {
          for (const block of c) {
            if (block?.type === "text") {
              content += (block.text ?? "") + " ";
            }
          }
        }
      }
      if (content) {
        // "Load skill '<name>'" pattern
        const m = content.match(/Load skill ['"]([^'"]+)['"]/);
        if (m) return m[1];

        const lower = content.trim().toLowerCase();
        if (
          ["plan", "design", "architect", "implementation"].some((kw) =>
            lower.includes(kw)
          )
        )
          return "Plan agent";
        if (
          ["explore", "search for", "find files", "find the", "look for", "codebase"].some(
            (kw) => lower.includes(kw)
          )
        )
          return "Explore agent";

        // Summarize first line
        let summary = content.trim().split("\n")[0];
        summary = summary.replace(/[*#`]/g, "").trim();
        if (summary.length > 30) summary = summary.slice(0, 27) + "...";
        if (summary) return summary;
      }
    }
  } catch {}
  return null;
}
