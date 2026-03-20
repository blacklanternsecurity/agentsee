import { useState, useEffect } from "react";
import { ModeBadge } from "./ModeBadge";
import { AgentStream } from "./AgentStream";
import type { AgentInfo, StreamEntry } from "../types";

const MCP_TIMEOUT_MS = 300_000; // 5 minutes

interface Props {
  agent: AgentInfo;
  entries: StreamEntry[];
  focused: boolean;
  onFocus: () => void;
  onDismiss: () => void;
  onMaximize: () => void;
  maximized: boolean;
  onHold: () => void;
  onRelease: () => void;
  onSetThreshold: (t: number | null) => void;
  onScrollTop: () => void;
  hasCheckin: boolean;
  checkinReceivedAt: number | null;
  hasChatHistory: boolean;
  onOpenChat: () => void;
}

function idleColor(ms: number): string {
  if (ms >= 120000) return "#f85149"; // red
  if (ms >= 60000) return "#d29922"; // orange
  if (ms >= 30000) return "#c09553"; // gold
  return "#8b949e";
}

function formatIdle(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

export function AgentPane({
  agent,
  entries,
  focused,
  onFocus,
  onDismiss,
  onMaximize,
  maximized,
  onHold,
  onRelease,
  onSetThreshold,
  onScrollTop,
  hasCheckin,
  checkinReceivedAt,
  hasChatHistory,
  onOpenChat,
}: Props) {
  const isComplete = agent.status === "complete";
  const idle = Date.now() - new Date(agent.last_activity).getTime();
  const isSpinning = !isComplete && idle >= 5_000 && idle < 300_000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (isComplete) return;
    // 150ms when spinner is visible for smooth animation, 1s otherwise
    const id = setInterval(() => setNow(Date.now()), isSpinning ? 150 : 1000);
    return () => clearInterval(id);
  }, [isComplete, isSpinning]);

  // Recompute with `now` to ensure reactivity
  const idleMs = now - new Date(agent.last_activity).getTime();

  // MCP timeout countdown using stable receivedAt from workspace state
  const [checkinTimeLeft, setCheckinTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (hasCheckin && checkinReceivedAt !== null) {
      const tick = () => {
        const remaining = Math.max(0, MCP_TIMEOUT_MS - (Date.now() - checkinReceivedAt));
        setCheckinTimeLeft(remaining);
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      setCheckinTimeLeft(null);
    }
  }, [hasCheckin, checkinReceivedAt]);

  return (
    <div
      style={{
        ...s.pane,
        borderColor: focused
          ? "#58a6ff"
          : hasCheckin
            ? "#1f6feb"
            : "#30363d",
        ...(hasCheckin ? { animation: "pulseBorder 1.5s ease-in-out infinite" } : {}),
      }}
      onClick={onFocus}
    >
      {/* Header */}
      <div style={s.header} onDoubleClick={onMaximize}>
        <div style={s.headerLeft}>
          <button
            style={s.expandBtn}
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            title={maximized ? "Restore panes" : "Maximize pane"}
          >
            {maximized ? "⤡" : "⤢"}
          </button>
          <span style={s.label}>
            {agent.task_description || agent.agent_type || agent.agent_id}
          </span>
          <ModeBadge mode={agent.mode} status={agent.status} />
        </div>
        <div style={s.headerRight}>
          <IdleIndicator idle={idleMs} complete={isComplete} />
          {checkinTimeLeft !== null && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "inherit",
              color: checkinTimeLeft <= 60_000
                ? "#f85149"
                : checkinTimeLeft <= 120_000
                  ? "#d29922"
                  : "#58a6ff",
            }}>
              {checkinTimeLeft <= 0
                ? "TIMED OUT"
                : `${Math.floor(checkinTimeLeft / 60_000)}:${String(Math.floor((checkinTimeLeft % 60_000) / 1000)).padStart(2, "0")}`}
            </span>
          )}
          {(hasCheckin || hasChatHistory) && (
            <button
              style={{ ...s.chatBtn, ...(hasCheckin ? s.chatBtnActive : {}) }}
              onClick={onOpenChat}
              title="Open chat"
            >
              💬
            </button>
          )}
          {agent.status === "held" ? (
            <button style={s.ctrlBtn} onClick={onRelease}>
              Resume
            </button>
          ) : (
            <button style={s.ctrlBtn} onClick={onHold}>
              Hold
            </button>
          )}
          <ThresholdControl
            value={agent.turn_threshold}
            turnCount={agent.turn_count}
            onChange={onSetThreshold}
          />
          <button style={s.dismissBtn} onClick={onDismiss}>
            ×
          </button>
        </div>
      </div>

      {/* Stream */}
      <AgentStream entries={entries} onScrollTop={onScrollTop} />
    </div>
  );
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function IdleIndicator({ idle, complete }: { idle: number; complete: boolean }) {
  if (complete || idle < 5_000) {
    return null;
  }

  const showSpinner = idle < 300_000; // up to 5min
  const frame = SPINNER_FRAMES[Math.floor(Date.now() / 100) % SPINNER_FRAMES.length];
  const color = idleColor(idle);

  return (
    <span style={{ color, fontSize: 10, fontFamily: "inherit" }}>
      {showSpinner && <span style={{ marginRight: 3 }}>{frame}</span>}
      {formatIdle(idle)}
    </span>
  );
}

function ThresholdControl({
  value,
  turnCount,
  onChange,
}: {
  value: number | null;
  turnCount: number;
  onChange: (t: number | null) => void;
}) {
  const isAuto = value === null;
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const apply = () => {
    const n = parseInt(draft, 10);
    if (n > 0) {
      onChange(n);
    } else {
      setDraft(value === null ? "" : String(value));
    }
  };

  const remaining = value !== null ? Math.max(0, value - turnCount) : null;

  return (
    <div style={tc.wrapper}>
      <button
        style={{ ...tc.modeBtn, ...(isAuto ? tc.modeBtnActive : {}) }}
        onClick={() => onChange(null)}
        title="Autonomous — no automatic check-ins"
      >
        Auto
      </button>
      <div style={tc.leashGroup}>
        <span style={tc.leashLabel}>Leash</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={apply}
          onKeyDown={(e) => { if (e.key === "Enter") { apply(); (e.target as HTMLInputElement).blur(); } }}
          onFocus={(e) => e.target.select()}
          placeholder="#"
          style={tc.leashInput}
          title="Check in after this many tool calls (Enter to apply)"
        />
        {remaining !== null && (
          <span style={{
            ...tc.remaining,
            color: remaining === 0 ? "#f85149" : remaining <= 2 ? "#d29922" : "#8b949e",
          }}>
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
}

const tc: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  modeBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    color: "#8b949e",
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: "3px 0 0 3px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  modeBtnActive: {
    background: "#1a3a2a",
    color: "#3fb950",
    borderColor: "#238636",
  },
  leashGroup: {
    display: "flex",
    alignItems: "center",
    background: "#21262d",
    border: "1px solid #30363d",
    borderLeft: "none",
    borderRadius: "0 3px 3px 0",
    padding: "0 4px",
    gap: 3,
  },
  leashLabel: {
    fontSize: 10,
    color: "#484f58",
  },
  leashInput: {
    width: 20,
    background: "transparent",
    border: "none",
    color: "#c9d1d9",
    fontSize: 10,
    fontFamily: "inherit",
    outline: "none",
    textAlign: "center",
    padding: "2px 0",
  },
  remaining: {
    fontSize: 10,
    fontWeight: 600,
    fontFamily: "inherit",
    minWidth: 12,
    textAlign: "center",
  },
};

const s: Record<string, React.CSSProperties> = {
  pane: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid #30363d",
    borderRadius: 6,
    overflow: "hidden",
    background: "#0d1117",
    minHeight: 0,
    minWidth: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 8px",
    background: "#161b22",
    borderBottom: "1px solid #21262d",
    gap: 8,
    flexShrink: 0,
    cursor: "default",
    userSelect: "none",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    minWidth: 0,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  expandBtn: {
    background: "none",
    border: "none",
    color: "#484f58",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  label: {
    fontWeight: 600,
    fontSize: 12,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ctrlBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    color: "#c9d1d9",
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 3,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chatBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
    opacity: 0.5,
  },
  chatBtnActive: {
    opacity: 1,
  },
  dismissBtn: {
    background: "none",
    border: "none",
    color: "#484f58",
    fontSize: 16,
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
  },
};
