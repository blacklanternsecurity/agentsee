import { useState } from "react";
import type { Tab } from "../types";

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onClose: (id: string) => void;
  onToggleBrowser: () => void;
  agentCount: number;
}

export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onCreate,
  onRename,
  onClose,
  onToggleBrowser,
  agentCount,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div style={s.bar}>
      {tabs.map((tab, i) => {
        const active = tab.id === activeTabId;
        const editing = editingId === tab.id;

        return (
          <div
            key={tab.id}
            style={{ ...s.tab, ...(active ? s.active : {}) }}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => {
              setEditingId(tab.id);
              setEditValue(tab.name);
            }}
          >
            {editing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => {
                  if (editValue.trim()) onRename(tab.id, editValue.trim());
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (editValue.trim()) onRename(tab.id, editValue.trim());
                    setEditingId(null);
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                style={s.input}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span style={s.num}>{i + 1}</span>
                <span>{tab.name}</span>
                <span style={s.count}>{tab.agentIds.length}</span>
                {tabs.length > 1 && (
                  <button
                    style={s.close}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      <button style={s.addBtn} onClick={onCreate}>
        +
      </button>
      <div style={s.spacer} />
      <button style={s.agentsBtn} onClick={onToggleBrowser}>
        <span style={s.shortcut}>b</span>
        Agents
        <span style={s.count}>{agentCount}</span>
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    alignItems: "center",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    padding: "0 4px",
    height: 32,
    gap: 2,
    flexShrink: 0,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: "6px 6px 0 0",
    cursor: "pointer",
    color: "#8b949e",
    fontSize: 12,
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  active: {
    background: "#0d1117",
    color: "#c9d1d9",
    borderTop: "2px solid #58a6ff",
  },
  num: {
    color: "#484f58",
    fontSize: 10,
  },
  count: {
    background: "#21262d",
    color: "#8b949e",
    padding: "0 5px",
    borderRadius: 10,
    fontSize: 10,
  },
  close: {
    background: "none",
    border: "none",
    color: "#484f58",
    cursor: "pointer",
    fontSize: 14,
    padding: "0 2px",
    lineHeight: 1,
  },
  addBtn: {
    background: "none",
    border: "1px solid #30363d",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 8px",
    borderRadius: 4,
    marginLeft: 4,
  },
  spacer: {
    flex: 1,
  },
  shortcut: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 3,
    padding: "0 4px",
    fontSize: 10,
    color: "#484f58",
    lineHeight: "16px",
  },
  agentsBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "1px solid #30363d",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 12,
    padding: "2px 10px",
    borderRadius: 4,
    fontFamily: "inherit",
    marginRight: 4,
  },
  input: {
    background: "#0d1117",
    border: "1px solid #58a6ff",
    color: "#c9d1d9",
    fontSize: 12,
    padding: "1px 4px",
    borderRadius: 3,
    outline: "none",
    width: 100,
    fontFamily: "inherit",
  },
};
