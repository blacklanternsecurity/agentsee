import { useEffect, useRef, useCallback } from "react";
import type { AgentInfo, StreamEntry, WsMessage } from "../types";

interface UseWebSocketOptions {
  onInit: (agents: Record<string, AgentInfo>) => void;
  onAgentRegistered: (agentId: string, data: Record<string, any>) => void;
  onAgentStatus: (agentId: string, data: Record<string, any>) => void;
  onStream: (agentId: string, entry: StreamEntry) => void;
  onHistory: (agentId: string, entries: StreamEntry[]) => void;
  onCheckin: (agentId: string, data: { summary: string; question?: string }) => void;
  onNotify: (agentId: string, message: string) => void;
  onRemoved: (agentId: string) => void;
}

export function useWebSocket(opts: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      const o = optsRef.current;
      switch (msg.type) {
        case "init":
          o.onInit(msg.data.agents as Record<string, AgentInfo>);
          break;
        case "agent:registered":
          o.onAgentRegistered(msg.agent_id, msg.data);
          break;
        case "agent:status":
        case "agent:tool_start":
        case "agent:tool_done":
        case "agent:blocked":
          o.onAgentStatus(msg.agent_id, msg.data);
          break;
        case "agent:stream":
          o.onStream(msg.agent_id, msg.data as unknown as StreamEntry);
          break;
        case "agent:history":
          o.onHistory(msg.agent_id, msg.data.entries as StreamEntry[]);
          break;
        case "agent:checkin":
          o.onCheckin(msg.agent_id, msg.data as any);
          break;
        case "agent:notify":
          o.onNotify(msg.agent_id, msg.data.message as string);
          break;
        case "agent:removed":
          o.onRemoved(msg.agent_id);
          break;
      }
    };

    ws.onclose = () => {
      // Reconnect after 2s
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 2000);
    };

    return () => {
      ws.close();
    };
  }, []);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}
