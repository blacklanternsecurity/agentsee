import { useState, useCallback, useMemo } from "react";
import { useWorkspace } from "./store/workspace";
import { useWebSocket } from "./hooks/useWebSocket";
import { useKeyBindings } from "./hooks/useKeyBindings";
import { useChunkedHistory } from "./hooks/useChunkedHistory";
import { TabBar } from "./components/TabBar";
import { PaneGrid } from "./components/PaneGrid";
import { AgentBrowser } from "./components/AgentBrowser";
import { ChatPanel } from "./components/ChatPanel";
import type { AgentInfo } from "./types";

export function App() {
  const ws = useWorkspace();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const { loadMore } = useChunkedHistory(ws.prependStreamHistory);

  const { send } = useWebSocket({
    onInit: (agents) => {
      // Clean stale agent IDs from tabs (leftover from previous sessions)
      const validIds = new Set(Object.keys(agents));
      ws.cleanStaleTabs(validIds);

      for (const agent of Object.values(agents)) {
        ws.registerAgent(agent);
      }
      for (const id of Object.keys(agents)) {
        send({
          type: "agent:subscribe",
          agent_id: id,
          data: {},
        });
      }
    },
    onAgentRegistered: (agentId, data) => {
      const agent: AgentInfo = {
        agent_id: agentId,
        session_id: data.session_id ?? "",
        agent_type: data.agent_type ?? "unknown",
        task_description: data.task_description ?? data.label ?? "",
        mode: data.mode ?? "autonomous",
        status: "running",
        turn_count: 0,
        turn_threshold: data.turn_threshold ?? null,
        transcript_path: data.transcript_path ?? data.filePath ?? null,
        has_pending_checkin: false,
        registered_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      };
      ws.registerAgent(agent);
      send({ type: "agent:subscribe", agent_id: agentId, data: {} });
    },
    onAgentStatus: (agentId, data) => {
      ws.updateAgent(agentId, data as Partial<AgentInfo>);
      if (data.status !== "checking_in") {
        ws.setCheckin(agentId, null);
      }
    },
    onStream: (agentId, entry) => {
      ws.appendStream(agentId, entry);
      // Update last_activity
      ws.updateAgent(agentId, {
        last_activity: new Date().toISOString(),
      });
    },
    onHistory: (agentId, entries) => {
      ws.setStreamHistory(agentId, entries);
    },
    onCheckin: (agentId, data) => {
      ws.setCheckin(agentId, data);
      ws.updateAgent(agentId, { status: "checking_in", has_pending_checkin: true });
      // Record agent message in chat history
      ws.addChatMessage(agentId, {
        from: "agent",
        text: data.summary,
        question: data.question,
        timestamp: new Date(),
      });
      // Auto-open chat
      setChatAgentId(agentId);
    },
    onNotify: (_agentId, _message) => {
      // Could show a toast notification here
    },
    onRemoved: (agentId) => {
      ws.removeAgent(agentId);
    },
  });

  const handleRespond = useCallback(
    (agentId: string, message: string, keepHeld: boolean, leash: number | null) => {
      ws.addChatMessage(agentId, {
        from: "operator",
        text: message,
        timestamp: new Date(),
      });

      const appendedMessage = keepHeld
        ? message + "\n\n[After completing this, check in again with operator_checkpoint before proceeding further.]"
        : message;

      send({
        type: "agent:respond",
        agent_id: agentId,
        data: { message: appendedMessage, release: !keepHeld },
      });

      // Set leash if specified
      if (leash !== null) {
        send({
          type: "agent:set_threshold",
          agent_id: agentId,
          data: { threshold: leash },
        });
      }

      ws.setCheckin(agentId, null);
      if (!keepHeld) setChatAgentId(null);
    },
    [send, ws]
  );

  const handleHold = useCallback(
    (agentId: string) => {
      send({ type: "agent:hold", agent_id: agentId, data: {} });
    },
    [send]
  );

  const handleRelease = useCallback(
    (agentId: string) => {
      send({ type: "agent:release", agent_id: agentId, data: {} });
    },
    [send]
  );

  const handleSetThreshold = useCallback(
    (agentId: string, threshold: number | null) => {
      send({
        type: "agent:set_threshold",
        agent_id: agentId,
        data: { threshold },
      });
    },
    [send]
  );

  const handleScrollTop = useCallback(
    (agentId: string) => {
      const entries = ws.streams[agentId];
      const earliest = entries?.[0]?.byte_offset ?? 0;
      if (earliest > 0) {
        loadMore(agentId, earliest);
      }
    },
    [ws.streams, loadMore]
  );

  const activeAgentIds = ws.activeTab.agentIds;

  const keyActions = useMemo(
    () => ({
      switchTab: (i: number) => {
        if (ws.tabs[i]) ws.setActiveTabId(ws.tabs[i].id);
      },
      createTab: () => ws.createTab(),
      focusNext: () =>
        setFocusedIndex((prev) => (prev + 1) % Math.max(1, activeAgentIds.length)),
      focusPrev: () =>
        setFocusedIndex(
          (prev) => (prev - 1 + Math.max(1, activeAgentIds.length)) % Math.max(1, activeAgentIds.length)
        ),
      maximize: () => {
        const id = activeAgentIds[focusedIndex];
        if (id) ws.setMaximizedAgent(ws.maximizedAgent ? null : id);
      },
      dismiss: () => {
        const id = activeAgentIds[focusedIndex];
        if (id) ws.removeAgentFromTab(ws.activeTab.id, id);
      },
      toggleBrowser: () => setBrowserOpen((v) => !v),
      holdFocused: () => {
        const id = activeAgentIds[focusedIndex];
        if (id) handleHold(id);
      },
      releaseFocused: () => {
        const id = activeAgentIds[focusedIndex];
        if (id) handleRelease(id);
      },
    }),
    [ws, activeAgentIds, focusedIndex, handleHold, handleRelease]
  );

  useKeyBindings(keyActions);


  return (
    <div style={s.root}>
      <TabBar
        tabs={ws.tabs}
        activeTabId={ws.activeTabId}
        onSelect={ws.setActiveTabId}
        onCreate={() => ws.createTab()}
        onRename={ws.renameTab}
        onClose={ws.closeTab}
        onToggleBrowser={() => setBrowserOpen((v) => !v)}
        agentCount={Object.keys(ws.agents).length}
      />

      <PaneGrid
        agentIds={ws.activeTab.agentIds}
        agents={ws.agents}
        streams={ws.streams}
        checkins={ws.checkins}
        focusedIndex={focusedIndex}
        maximizedAgent={ws.maximizedAgent}
        onFocus={setFocusedIndex}
        onDismiss={(id) => ws.removeAgentFromTab(ws.activeTab.id, id)}
        onMaximize={ws.setMaximizedAgent}
        onHold={handleHold}
        onRelease={handleRelease}
        onSetThreshold={handleSetThreshold}
        onScrollTop={handleScrollTop}
        onOpenChat={setChatAgentId}
        chatHistories={ws.chatHistories}
      />

      {browserOpen && (
        <AgentBrowser
          agents={ws.agents}
          currentTabAgents={ws.activeTab.agentIds}
          onToggle={(id) => {
            if (ws.activeTab.agentIds.includes(id)) {
              ws.removeAgentFromTab(ws.activeTab.id, id);
            } else {
              ws.addAgentToTab(ws.activeTab.id, id);
            }
          }}
          onRemove={(id) => {
            send({ type: "agent:remove", agent_id: id, data: {} });
          }}
          onClose={() => setBrowserOpen(false)}
        />
      )}

      {chatAgentId && (
        <ChatPanel
          agentId={chatAgentId}
          checkin={ws.checkins[chatAgentId] ?? null}
          history={ws.chatHistories[chatAgentId] ?? []}
          onRespond={handleRespond}
          onClose={() => setChatAgentId(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
};
