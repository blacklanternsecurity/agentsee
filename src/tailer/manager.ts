import { FileTailer, serializeEntry } from "./file-tailer.js";
import { discoverAgents, purgeAgent } from "./discovery.js";
import { readHistoryChunk } from "./history.js";
import { AgentStore } from "../state/agent-store.js";
import { broadcast } from "../dashboard/ws-events.js";
import { Router, Request, Response } from "express";
import { WebSocket, WebSocketServer } from "ws";

/**
 * Manages per-agent file tailers.
 *
 * Tailers are created either:
 * - Implicitly when an agent registers via hook (transcript_path in hook event)
 * - Explicitly via periodic discovery scan
 */
export class TailerManager {
  private tailers = new Map<string, FileTailer>();
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: AgentStore,
    private wss: WebSocketServer,
    private projectDir: string
  ) {}

  /** Start a tailer for an agent if we have a transcript path. */
  async ensureTailer(agentId: string, filePath: string): Promise<FileTailer> {
    let tailer = this.tailers.get(agentId);
    if (tailer) return tailer;

    tailer = new FileTailer(agentId, filePath);
    this.tailers.set(agentId, tailer);
    await tailer.start();
    return tailer;
  }

  /** Start periodic discovery of new agents. */
  startDiscovery(intervalMs = 5000): void {
    // Run once immediately
    this.runDiscovery().catch(() => {});

    this.discoveryTimer = setInterval(() => {
      this.runDiscovery().catch(() => {});
    }, intervalMs);
  }

  stopDiscovery(): void {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
  }

  private async runDiscovery(): Promise<void> {
    const agents = await discoverAgents(this.projectDir);
    for (const agent of agents) {
      if (this.tailers.has(agent.agentId)) continue;

      // Auto-register in state store if not already known
      this.store.getOrAutoRegister(
        agent.agentId,
        "",
        undefined,
        agent.filePath
      );

      const state = this.store.get(agent.agentId);
      if (state) {
        state.task_description = state.task_description || agent.label;
      }

      await this.ensureTailer(agent.agentId, agent.filePath);

      broadcast(this.wss, {
        type: "agent:registered",
        agent_id: agent.agentId,
        data: { label: agent.label, filePath: agent.filePath },
      });
    }
  }

  /** Subscribe a websocket client to an agent's stream. */
  subscribe(agentId: string, ws: WebSocket): void {
    const tailer = this.tailers.get(agentId);
    if (!tailer) return;

    tailer.subscribers.add(ws);

    // Send buffered entries
    const entries = tailer.getBufferedEntries();
    ws.send(
      JSON.stringify({
        type: "agent:history",
        agent_id: agentId,
        data: { entries: entries.map(serializeEntry) },
      })
    );
  }

  /** Unsubscribe a websocket client from an agent's stream. */
  unsubscribe(agentId: string, ws: WebSocket): void {
    const tailer = this.tailers.get(agentId);
    if (tailer) {
      tailer.subscribers.delete(ws);
    }
  }

  /** Unsubscribe a websocket from all agents (on disconnect). */
  unsubscribeAll(ws: WebSocket): void {
    for (const tailer of this.tailers.values()) {
      tailer.subscribers.delete(ws);
    }
  }

  /** Permanently remove an agent — stops tailer, deletes JSONL from disk, removes from state. */
  async removeAgent(agentId: string): Promise<void> {
    const tailer = this.tailers.get(agentId);
    if (tailer) {
      tailer.stop();
      await purgeAgent(tailer.filePath);
      this.tailers.delete(agentId);
    }
    this.store.remove(agentId);

    broadcast(this.wss, {
      type: "agent:removed",
      agent_id: agentId,
      data: {},
    });
  }

  getTailer(agentId: string): FileTailer | undefined {
    return this.tailers.get(agentId);
  }

  /** Stop all tailers. */
  stopAll(): void {
    this.stopDiscovery();
    for (const tailer of this.tailers.values()) {
      tailer.stop();
    }
    this.tailers.clear();
  }
}

/** Express router for history endpoint. */
export function createHistoryRouter(manager: TailerManager): Router {
  const router = Router();

  router.delete("/agent/:agent_id", async (req: Request, res: Response) => {
    const { agent_id } = req.params;
    await manager.removeAgent(agent_id);
    res.json({ ok: true });
  });

  router.get("/agent/:agent_id/history", async (req: Request, res: Response) => {
    const { agent_id } = req.params;
    const before = parseInt(String(req.query.before ?? "0"), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "500"), 10), 1000);

    const tailer = manager.getTailer(agent_id);
    if (!tailer) {
      res.status(404).json({ error: "agent not found" });
      return;
    }

    try {
      const { entries, earliestOffset } = await readHistoryChunk(
        tailer.filePath,
        agent_id,
        before,
        limit
      );
      res.json({
        entries: entries.map(serializeEntry),
        earliest_offset: earliestOffset,
      });
    } catch (err) {
      res.status(500).json({ error: "failed to read history" });
    }
  });

  return router;
}
