import { open, stat, FileHandle } from "fs/promises";
import { watch, FSWatcher } from "fs";
import { RingBuffer } from "./ring-buffer.js";
import { parseLine, PendingTools } from "./jsonl-parser.js";
import { StreamEntry } from "./types.js";
import { WebSocket, WebSocketServer } from "ws";

export class FileTailer {
  readonly agentId: string;
  readonly filePath: string;
  readonly buffer: RingBuffer<StreamEntry>;
  readonly subscribers = new Set<WebSocket>();

  private fileOffset = 0;
  private pending: PendingTools = new Map();
  private watcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private partial = ""; // incomplete line from last read
  private stopped = false;

  constructor(agentId: string, filePath: string, bufferSize = 500) {
    this.agentId = agentId;
    this.filePath = filePath;
    this.buffer = new RingBuffer(bufferSize);
  }

  /** Start tailing. Reads existing content then watches for changes. */
  async start(): Promise<void> {
    await this.readNewContent();

    // fs.watch for immediate notification
    try {
      this.watcher = watch(this.filePath, () => {
        if (!this.stopped) this.readNewContent().catch(() => {});
      });
      this.watcher.on("error", () => {});
    } catch {
      // File might not exist yet — poll instead
    }

    // Poll as backup (fs.watch can miss events on some systems)
    this.pollTimer = setInterval(() => {
      if (!this.stopped) this.readNewContent().catch(() => {});
    }, 500);
  }

  stop(): void {
    this.stopped = true;
    this.watcher?.close();
    this.watcher = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Read any new bytes from the file, parse lines, push to buffer + subscribers. */
  private async readNewContent(): Promise<void> {
    let fh: FileHandle | undefined;
    try {
      const st = await stat(this.filePath);
      if (st.size <= this.fileOffset) return;

      fh = await open(this.filePath, "r");
      const readSize = st.size - this.fileOffset;
      const buf = Buffer.alloc(readSize);
      await fh.read(buf, 0, readSize, this.fileOffset);

      const text = this.partial + buf.toString("utf-8");
      const lines = text.split("\n");

      // Last element is either empty (line ended with \n) or a partial line
      this.partial = lines.pop() ?? "";
      this.fileOffset = st.size - Buffer.byteLength(this.partial, "utf-8");

      for (const line of lines) {
        if (!line.trim()) continue;
        const lineOffset = this.fileOffset; // approximate
        const entries = parseLine(line, this.pending, this.agentId, lineOffset);
        for (const entry of entries) {
          this.buffer.push(entry);
          this.broadcastEntry(entry);
        }
      }
    } catch {
      // File not ready or deleted — ignore
    } finally {
      await fh?.close();
    }
  }

  private broadcastEntry(entry: StreamEntry): void {
    if (this.subscribers.size === 0) return;
    const data = JSON.stringify({
      type: "agent:stream",
      agent_id: this.agentId,
      data: serializeEntry(entry),
    });
    for (const ws of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /** Get current buffer contents (for new subscribers). */
  getBufferedEntries(): StreamEntry[] {
    return this.buffer.toArray();
  }
}

export function serializeEntry(
  entry: StreamEntry
): Record<string, unknown> {
  return {
    timestamp: entry.timestamp.toISOString(),
    category: entry.category,
    formatted: entry.formatted,
    raw_text: entry.raw_text,
    tool_name: entry.tool_name,
    agent_id: entry.agent_id,
    byte_offset: entry.byte_offset,
  };
}
