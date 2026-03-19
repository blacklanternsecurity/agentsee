import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { Router, Request, Response } from "express";
import { AgentStore } from "../state/agent-store.js";
import { broadcast } from "../dashboard/ws-events.js";
import type { WebSocketServer } from "ws";

export function createMcpRouter(store: AgentStore, wss: WebSocketServer): Router {
  const router = Router();

  // Track transports by session ID so we can route POST messages
  const transports = new Map<string, StreamableHTTPServerTransport>();

  function createServer(): McpServer {
    const mcp = new McpServer(
      { name: "agentsee", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );

    mcp.tool(
      "operator_checkpoint",
      "Check in with the operator. Blocks until the operator responds. " +
        "Call this when instructed to by an OPERATOR CHECKPOINT REQUIRED " +
        "or OPERATOR INTERVENTION message, or whenever you want operator guidance.",
      {
        agent_id: z.string().describe("Your agent identifier"),
        summary: z.string().describe(
          "What you have done so far and what you intend to do next"
        ),
        question: z
          .string()
          .optional()
          .describe("Specific question for the operator, if any"),
      },
      async ({ agent_id, summary, question }) => {
        // Try exact match first, then normalized, then match by agent type
        let state = store.get(agent_id);
        let resolvedId = agent_id;

        if (!state) {
          const normalizedId = agent_id.startsWith("agent-") ? agent_id : `agent-${agent_id}`;
          state = store.get(normalizedId);
          if (state) resolvedId = normalizedId;
        }

        if (!state) {
          // Agent might have passed its type name instead of instance ID
          const byType = store.findByType(agent_id);
          if (byType) {
            state = byType;
            resolvedId = byType.agent_id;
          }
        }

        if (!state) {
          const normalizedId = agent_id.startsWith("agent-") ? agent_id : `agent-${agent_id}`;
          state = store.getOrAutoRegister(normalizedId, "", undefined, undefined);
          resolvedId = normalizedId;
        }

        state.status = "checking_in";

        broadcast(wss, {
          type: "agent:checkin",
          agent_id: resolvedId,
          data: { summary, question },
        });

        // Block until operator responds via dashboard
        const response = await new Promise<string>((resolve) => {
          state.pending_checkin = { summary, question, resolve };
        });

        // Operator responded — status was set by the ws-events respond handler
        // (either "running" if released, or "held" if kept held)
        state.turn_count = 0;
        state.pending_checkin = null;

        return {
          content: [{ type: "text" as const, text: response }],
        };
      }
    );

    mcp.tool(
      "operator_notify",
      "Send a non-blocking notification to the operator. Returns immediately.",
      {
        agent_id: z.string().describe("Your agent identifier"),
        message: z.string().describe("Status update, finding, or note"),
      },
      async ({ agent_id, message }) => {
        let state = store.get(agent_id);
        let resolvedId = agent_id;
        if (!state) {
          const n = agent_id.startsWith("agent-") ? agent_id : `agent-${agent_id}`;
          state = store.get(n);
          if (state) resolvedId = n;
        }
        if (!state) {
          const byType = store.findByType(agent_id);
          if (byType) { state = byType; resolvedId = byType.agent_id; }
        }
        if (state) state.last_activity = new Date();

        broadcast(wss, {
          type: "agent:notify",
          agent_id: resolvedId,
          data: { message },
        });

        return {
          content: [{ type: "text" as const, text: "Acknowledged" }],
        };
      }
    );

    return mcp;
  }

  // POST /mcp — handles JSON-RPC messages (including initialize, tool calls)
  router.post("/", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Existing session — route to its transport
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — create transport + server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const mcp = createServer();

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
  });

  // GET /mcp — SSE stream for server-to-client notifications
  router.get("/", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({ error: "Missing or invalid session ID" });
      return;
    }
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — close session
  router.delete("/", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.close();
      transports.delete(sessionId);
    }
    res.sendStatus(200);
  });

  return router;
}
