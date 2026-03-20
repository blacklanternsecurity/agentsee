#!/usr/bin/env node
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { AgentStore } from "./state/agent-store.js";
import { createHookRouter } from "./hooks/receiver.js";
import { createMcpRouter } from "./mcp/server.js";
import { setupWsHandlers } from "./dashboard/ws-events.js";
import { TailerManager, createHistoryRouter } from "./tailer/manager.js";

const PORT = parseInt(process.env.AGENTSEE_PORT ?? "4900", 10);
const PROJECT_DIR = process.env.AGENTSEE_PROJECT_DIR ?? "";

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const store = new AgentStore();
const tailerManager = new TailerManager(store, wss, PROJECT_DIR);

// Hook receiver + agent management API
const hookRouter = createHookRouter(store, wss);

// Extend hook receiver: when a hook provides transcript_path, start a tailer
app.use((req, _res, next) => {
  // After hook processing, check if we should start a tailer
  const origJson = _res.json.bind(_res);
  _res.json = function (body: any) {
    // Start tailer for agents with transcript paths (from hook events)
    if (req.path === "/hook/pre" || req.path === "/hook/post") {
      const agentId = req.body?.agent_id ?? req.body?.session_id;
      const transcriptPath = req.body?.transcript_path;
      if (agentId && transcriptPath) {
        tailerManager.ensureTailer(agentId, transcriptPath).catch(() => {});
      }
    }
    return origJson(body);
  };
  next();
});
app.use(hookRouter);

// MCP server (Streamable HTTP transport)
app.use("/mcp", createMcpRouter(store, wss));

// History endpoint for chunked backward loading
app.use(createHistoryRouter(tailerManager));

// WebSocket handlers for dashboard clients (with tailer subscribe/unsubscribe)
setupWsHandlers(wss, store, tailerManager);

// Start agent discovery
tailerManager.startDiscovery();

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, agents: store.all().length });
});

// Serve dashboard static files
const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDist = join(__dirname, "..", "dashboard", "dist");
if (existsSync(join(dashboardDist, "index.html"))) {
  app.use(express.static(dashboardDist));
  // SPA fallback — serve index.html for any unmatched GET
  app.get("*", (_req, res) => {
    res.sendFile(join(dashboardDist, "index.html"));
  });
  console.log(`  Dashboard:      http://localhost:${PORT}/ (${dashboardDist})`);
}

const HOST = process.env.AGENTSEE_HOST ?? "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`agentsee listening on ${HOST}:${PORT}`);
  console.log(`  Hook receiver:  http://localhost:${PORT}/hook/pre`);
  console.log(`  Agent status:   http://localhost:${PORT}/agent/status`);
  console.log(`  MCP server:     http://localhost:${PORT}/mcp`);
  console.log(`  History:        http://localhost:${PORT}/agent/:id/history`);
  console.log(`  WebSocket:      ws://localhost:${PORT}`);
  console.log(`  Project dir:    ${PROJECT_DIR || "(all projects)"}`);
});
