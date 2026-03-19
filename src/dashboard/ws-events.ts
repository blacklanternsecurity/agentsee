import { WebSocketServer, WebSocket } from "ws";
import { WsEvent } from "../types.js";
import { AgentStore } from "../state/agent-store.js";
import type { TailerManager } from "../tailer/manager.js";

export function broadcast(wss: WebSocketServer, event: WsEvent): void {
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function setupWsHandlers(
  wss: WebSocketServer,
  store: AgentStore,
  tailerManager?: TailerManager
): void {
  wss.on("connection", (ws) => {
    // Send current state on connect
    ws.send(
      JSON.stringify({
        type: "init",
        agent_id: "*",
        data: { agents: store.toJSON() },
      })
    );

    // Clean up subscriptions on disconnect
    ws.on("close", () => {
      tailerManager?.unsubscribeAll(ws);
    });

    ws.on("message", (raw) => {
      let msg: WsEvent;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      switch (msg.type) {
        case "agent:hold":
          if (store.hold(msg.agent_id)) {
            broadcast(wss, {
              type: "agent:status",
              agent_id: msg.agent_id,
              data: { status: "held" },
            });
          }
          break;

        case "agent:release":
          if (store.release(msg.agent_id)) {
            broadcast(wss, {
              type: "agent:status",
              agent_id: msg.agent_id,
              data: { status: "running" },
            });
          }
          break;

        case "agent:set_threshold": {
          const threshold = msg.data.threshold as number | null;
          if (store.setThreshold(msg.agent_id, threshold)) {
            const state = store.get(msg.agent_id)!;
            broadcast(wss, {
              type: "agent:status",
              agent_id: msg.agent_id,
              data: {
                mode: state.mode,
                turn_threshold: state.turn_threshold,
              },
            });
          }
          break;
        }

        case "agent:respond": {
          const state = store.get(msg.agent_id);
          if (state?.pending_checkin) {
            const response = String(msg.data.message ?? "Continue.");
            const release = msg.data.release !== false; // default: release
            state.pending_checkin.resolve(response);
            state.pending_checkin = null;
            state.status = release ? "running" : "held";
            store.resetTurnCount(msg.agent_id);
            broadcast(wss, {
              type: "agent:status",
              agent_id: msg.agent_id,
              data: { status: state.status },
            });
          }
          break;
        }

        case "agent:subscribe":
          tailerManager?.subscribe(msg.agent_id, ws);
          break;

        case "agent:unsubscribe":
          tailerManager?.unsubscribe(msg.agent_id, ws);
          break;

        case "agent:remove":
          tailerManager?.removeAgent(msg.agent_id);
          break;
      }
    });
  });
}
