import { open } from "fs/promises";
import { parseLine, PendingTools } from "./jsonl-parser.js";
import { StreamEntry } from "./types.js";

/**
 * Read a chunk of JSONL entries from disk before a given byte offset.
 * Stateless — each call is an independent file read.
 *
 * Reads backwards from `beforeOffset` (or end of file if 0),
 * parses up to `limit` JSONL lines, returns them oldest-first.
 */
export async function readHistoryChunk(
  filePath: string,
  agentId: string,
  beforeOffset: number,
  limit = 500
): Promise<{ entries: StreamEntry[]; earliestOffset: number }> {
  const fh = await open(filePath, "r");
  try {
    const st = await fh.stat();
    const endPos = beforeOffset > 0 ? Math.min(beforeOffset, st.size) : st.size;

    if (endPos === 0) {
      return { entries: [], earliestOffset: 0 };
    }

    // Read backwards in chunks to find enough lines
    const chunkSize = 64 * 1024; // 64KB chunks
    let collected: { line: string; offset: number }[] = [];
    let readEnd = endPos;
    let trailingPartial = "";

    while (collected.length < limit && readEnd > 0) {
      const readStart = Math.max(0, readEnd - chunkSize);
      const readLen = readEnd - readStart;
      const buf = Buffer.alloc(readLen);
      await fh.read(buf, 0, readLen, readStart);

      const text = buf.toString("utf-8") + trailingPartial;
      const lines = text.split("\n");

      // First element might be partial (split at chunk boundary)
      trailingPartial = lines.shift() ?? "";

      // Process lines in reverse (newest first within this chunk)
      for (let i = lines.length - 1; i >= 0 && collected.length < limit; i--) {
        const line = lines[i].trim();
        if (line) {
          collected.push({ line, offset: readStart });
        }
      }

      readEnd = readStart;
    }

    // Handle any remaining partial at the very start of file
    if (trailingPartial.trim() && collected.length < limit) {
      collected.push({ line: trailingPartial.trim(), offset: 0 });
    }

    // Reverse to oldest-first order
    collected.reverse();

    // Parse all collected lines
    const pending: PendingTools = new Map();
    const entries: StreamEntry[] = [];
    for (const { line, offset } of collected) {
      const parsed = parseLine(line, pending, agentId, offset);
      entries.push(...parsed);
    }

    const earliestOffset = collected.length > 0 ? collected[0].offset : 0;
    return { entries, earliestOffset };
  } finally {
    await fh.close();
  }
}
