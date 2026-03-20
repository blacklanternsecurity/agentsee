import { useRef, useState, useEffect } from "react";
import { useAutoTile } from "../hooks/useAutoTile";
import { AgentPane } from "./AgentPane";
import type { AgentInfo, StreamEntry } from "../types";

interface Props {
  agentIds: string[];
  agents: Record<string, AgentInfo>;
  streams: Record<string, StreamEntry[]>;
  checkins: Record<string, any>;
  focusedIndex: number;
  maximizedAgent: string | null;
  onFocus: (index: number) => void;
  onDismiss: (agentId: string) => void;
  onMaximize: (agentId: string | null) => void;
  onHold: (agentId: string) => void;
  onRelease: (agentId: string) => void;
  onSetThreshold: (agentId: string, t: number | null) => void;
  onScrollTop: (agentId: string) => void;
  onOpenChat: (agentId: string) => void;
  chatHistories: Record<string, any[]>;
}

export function PaneGrid({
  agentIds,
  agents,
  streams,
  checkins,
  focusedIndex,
  maximizedAgent,
  onFocus,
  onDismiss,
  onMaximize,
  onHold,
  onRelease,
  onSetThreshold,
  onScrollTop,
  chatHistories,
  onOpenChat,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const displayed = maximizedAgent
    ? [maximizedAgent]
    : agentIds
        .filter((id) => agents[id])
        .sort((a, b) => {
          const aTime = new Date(agents[a].registered_at).getTime();
          const bTime = new Date(agents[b].registered_at).getTime();
          return bTime - aTime; // newest first
        });

  const layout = useAutoTile(displayed.length, width);

  if (displayed.length === 0) {
    return (
      <div ref={containerRef} style={s.empty}>
        <div>No agents in this tab.</div>
        <div style={{ fontSize: 12, color: "#484f58", marginTop: 8 }}>
          Press <kbd style={s.kbd}>b</kbd> to open the agent browser and add agents.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        ...s.grid,
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
      }}
    >
      {displayed.map((agentId, i) => {
        const agent = agents[agentId];
        if (!agent) return null;
        return (
          <AgentPane
            key={agentId}
            agent={agent}
            entries={streams[agentId] ?? []}
            focused={i === focusedIndex}
            onFocus={() => onFocus(i)}
            onDismiss={() => onDismiss(agentId)}
            onMaximize={() =>
              onMaximize(maximizedAgent ? null : agentId)
            }
            maximized={maximizedAgent === agentId}
            onHold={() => onHold(agentId)}
            onRelease={() => onRelease(agentId)}
            onSetThreshold={(t) => onSetThreshold(agentId, t)}
            onScrollTop={() => onScrollTop(agentId)}
            hasCheckin={!!checkins[agentId]}
            checkinReceivedAt={checkins[agentId]?.receivedAt ?? null}
            hasChatHistory={(chatHistories[agentId]?.length ?? 0) > 0}
            onOpenChat={() => onOpenChat(agentId)}
          />
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gap: 4,
    padding: 4,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "#8b949e",
    fontSize: 14,
  },
  kbd: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 3,
    padding: "1px 5px",
    fontSize: 11,
  },
};
