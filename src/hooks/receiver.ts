import { Router, Request, Response } from "express";
import { AgentStore } from "../state/agent-store.js";
import {
  HookPreRequest,
  HookPreResponse,
  HookPostRequest,
  AgentRegisterRequest,
} from "../types.js";
import { broadcast } from "../dashboard/ws-events.js";
import type { WebSocketServer } from "ws";

const CHECKPOINT_TOOLS = new Set([
  "operator_checkpoint",
  "operator_notify",
  "mcp__agentsee__operator_checkpoint",
  "mcp__agentsee__operator_notify",
]);

export function createHookRouter(store: AgentStore, wss: WebSocketServer): Router {
  const router = Router();

  router.post("/hook/pre", (req: Request, res: Response) => {
    const body = req.body as HookPreRequest;
    const agent_id = normalizeAgentId(body.agent_id, body.session_id);
    const state = store.getOrAutoRegister(
      agent_id,
      body.session_id,
      body.agent_type,
      body.transcript_path
    );

    // Never block checkpoint/notify tools
    if (CHECKPOINT_TOOLS.has(body.tool_name)) {
      const resp: HookPreResponse = { allow: true };
      res.json(resp);
      return;
    }

    // Agent is held — deny with intervention message
    if (state.status === "held") {
      const resp: HookPreResponse = {
        allow: false,
        reason:
          "OPERATOR INTERVENTION: You have been held by the operator. " +
          "Call the mcp__agentsee__operator_checkpoint tool immediately with your agent_id, " +
          "a summary of your progress, and intended next steps. Do not attempt other tools first.",
      };
      broadcast(wss, {
        type: "agent:blocked",
        agent_id,
        data: { tool_name: body.tool_name, reason: "held" },
      });
      res.json(resp);
      return;
    }

    // Turn threshold enforcement
    if (
      state.turn_threshold !== null &&
      state.turn_count >= state.turn_threshold
    ) {
      const resp: HookPreResponse = {
        allow: false,
        reason:
          "OPERATOR CHECKPOINT REQUIRED: You have reached your tool call limit. " +
          "Call the mcp__agentsee__operator_checkpoint tool immediately with your agent_id, " +
          "a summary of your progress, and intended next steps. Do not attempt other tools first.",
      };
      broadcast(wss, {
        type: "agent:blocked",
        agent_id,
        data: { tool_name: body.tool_name, reason: "threshold" },
      });
      res.json(resp);
      return;
    }

    // Allow — increment turn count
    store.incrementTurnCount(agent_id);

    broadcast(wss, {
      type: "agent:tool_start",
      agent_id,
      data: {
        tool_name: body.tool_name,
        tool_input_summary: summarizeToolInput(body.tool_name, body.tool_input),
        turn_count: state.turn_count,
      },
    });

    const resp: HookPreResponse = { allow: true };
    res.json(resp);
  });

  router.post("/hook/post", (req: Request, res: Response) => {
    const body = req.body as HookPostRequest;
    const agent_id = normalizeAgentId(body.agent_id, body.session_id);

    // Touch last_activity
    const state = store.getOrAutoRegister(
      agent_id,
      body.session_id,
      body.agent_type,
      body.transcript_path
    );
    state.last_activity = new Date();

    broadcast(wss, {
      type: "agent:tool_done",
      agent_id,
      data: {
        tool_name: body.tool_name,
        tool_input_summary: summarizeToolInput(body.tool_name, body.tool_input),
      },
    });

    res.sendStatus(200);
  });

  router.post("/agent/register", (req: Request, res: Response) => {
    const body = req.body as AgentRegisterRequest;
    const state = store.register(body);

    broadcast(wss, {
      type: "agent:registered",
      agent_id: state.agent_id,
      data: {
        agent_type: state.agent_type,
        mode: state.mode,
        task_description: state.task_description,
      },
    });

    res.json({ ok: true, agent: serializeAgent(state) });
  });

  router.get("/agent/status", (_req: Request, res: Response) => {
    res.json({ agents: store.toJSON() });
  });

  router.post("/agent/:agent_id/hold", (req: Request, res: Response) => {
    const { agent_id } = req.params;
    if (store.hold(agent_id)) {
      broadcast(wss, {
        type: "agent:status",
        agent_id,
        data: { status: "held" },
      });
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "agent not found" });
    }
  });

  router.post("/agent/:agent_id/release", (req: Request, res: Response) => {
    const { agent_id } = req.params;
    if (store.release(agent_id)) {
      broadcast(wss, {
        type: "agent:status",
        agent_id,
        data: { status: "running" },
      });
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "agent not found" });
    }
  });

  router.post("/agent/:agent_id/threshold", (req: Request, res: Response) => {
    const { agent_id } = req.params;
    const { threshold } = req.body as { threshold: number | null };
    if (store.setThreshold(agent_id, threshold)) {
      const state = store.get(agent_id)!;
      broadcast(wss, {
        type: "agent:status",
        agent_id,
        data: { mode: state.mode, turn_threshold: state.turn_threshold },
      });
      res.json({ ok: true, mode: state.mode, turn_threshold: state.turn_threshold });
    } else {
      res.status(404).json({ error: "agent not found" });
    }
  });

  return router;
}

/**
 * Normalize agent ID to match JSONL filename format.
 * Hook events send bare IDs like "a3c83ab8eab186dce" but
 * JSONL filenames are "agent-a3c83ab8eab186dce.jsonl".
 * Discovery registers agents with the "agent-" prefix.
 */
function normalizeAgentId(agentId?: string, sessionId?: string): string {
  const raw = agentId ?? sessionId ?? "unknown";
  if (raw.startsWith("agent-")) return raw;
  return `agent-${raw}`;
}

function summarizeToolInput(
  tool_name: string,
  input: Record<string, unknown>
): string {
  switch (tool_name) {
    case "Bash":
      return String(input.command ?? "").slice(0, 200);
    case "Read":
      return String(input.file_path ?? "");
    case "Write":
      return String(input.file_path ?? "");
    case "Edit":
      return String(input.file_path ?? "");
    case "Grep":
      return `${input.pattern ?? ""} ${input.path ?? ""}`.trim();
    case "Glob":
      return String(input.pattern ?? "");
    case "Agent":
      return String(input.description ?? "").slice(0, 200);
    default:
      return "";
  }
}

function serializeAgent(state: any) {
  const { pending_checkin, ...rest } = state;
  return { ...rest, has_pending_checkin: pending_checkin !== null };
}
