import { useState } from "react";
import { ModeBadge } from "./ModeBadge";
import type { AgentInfo } from "../types";

interface Props {
  agents: Record<string, AgentInfo>;
  currentTabAgents: string[];
  onToggle: (agentId: string) => void;
  onRemove: (agentId: string) => void;
  onClose: () => void;
}

export function AgentBrowser({
  agents,
  currentTabAgents,
  onToggle,
  onRemove,
  onClose,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sorted = Object.values(agents).sort(
    (a, b) =>
      new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime()
  );

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontWeight: 600 }}>Agent Browser</span>
          <button style={s.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={s.list}>
          {sorted.length === 0 && (
            <div style={s.empty}>No agents discovered yet.</div>
          )}
          {sorted.map((agent) => {
            const inTab = currentTabAgents.includes(agent.agent_id);
            const idle = Date.now() - new Date(agent.last_activity).getTime();
            const idleStr =
              idle < 60000
                ? `${Math.floor(idle / 1000)}s`
                : `${Math.floor(idle / 60000)}m`;
            const confirming = confirmId === agent.agent_id;

            return (
              <div key={agent.agent_id}>
                <div
                  style={{
                    ...s.item,
                    ...(inTab ? s.itemActive : {}),
                  }}
                  onClick={() => onToggle(agent.agent_id)}
                >
                  <div style={s.itemLeft}>
                    <input
                      type="checkbox"
                      checked={inTab}
                      readOnly
                      style={{ cursor: "pointer" }}
                    />
                    <span style={s.itemLabel}>
                      {agent.task_description || agent.agent_type || agent.agent_id}
                    </span>
                  </div>
                  <div style={s.itemRight}>
                    <ModeBadge mode={agent.mode} status={agent.status} />
                    <span style={s.idle}>{idleStr}</span>
                    <button
                      style={s.purgeBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(confirming ? null : agent.agent_id);
                      }}
                      title="Delete agent transcript"
                    >
                      Purge
                    </button>
                  </div>
                </div>
                {confirming && (
                  <div style={s.confirm}>
                    <span style={s.confirmText}>
                      Delete transcript from disk. Not recoverable.
                    </span>
                    <div style={s.confirmBtns}>
                      <button
                        style={s.confirmNo}
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        style={s.confirmYes}
                        onClick={() => {
                          onRemove(agent.agent_id);
                          setConfirmId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={s.footer}>
          Press <kbd style={s.kbd}>b</kbd> or <kbd style={s.kbd}>Esc</kbd> to
          close
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  panel: {
    width: 380,
    maxWidth: "90vw",
    background: "#161b22",
    borderLeft: "1px solid #30363d",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "1px solid #21262d",
    fontSize: 13,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: 18,
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflow: "auto",
    padding: "4px 0",
  },
  empty: {
    color: "#484f58",
    textAlign: "center",
    padding: 20,
    fontStyle: "italic",
    fontSize: 12,
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #21262d",
  },
  itemActive: {
    background: "#1a2332",
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    minWidth: 0,
  },
  itemLabel: {
    fontSize: 12,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  idle: {
    fontSize: 10,
    color: "#484f58",
    width: 30,
    textAlign: "right",
  },
  purgeBtn: {
    background: "none",
    border: "1px solid #30363d",
    color: "#484f58",
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 3,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  confirm: {
    background: "#1c1210",
    border: "1px solid #da3633",
    borderTop: "none",
    padding: "6px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  confirmText: {
    color: "#f85149",
    fontSize: 11,
    lineHeight: 1.4,
  },
  confirmBtns: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },
  confirmYes: {
    background: "#da3633",
    border: "none",
    color: "#fff",
    fontSize: 11,
    padding: "3px 12px",
    borderRadius: 3,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
  },
  confirmNo: {
    background: "#21262d",
    border: "1px solid #30363d",
    color: "#c9d1d9",
    fontSize: 11,
    padding: "3px 12px",
    borderRadius: 3,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  footer: {
    padding: "6px 12px",
    borderTop: "1px solid #21262d",
    fontSize: 11,
    color: "#484f58",
    textAlign: "center",
  },
  kbd: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 3,
    padding: "0px 4px",
    fontSize: 10,
  },
};
