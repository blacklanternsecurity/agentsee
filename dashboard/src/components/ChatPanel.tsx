import { useState, useRef, useEffect } from "react";
import type { CheckinData } from "../types";

interface ChatMessage {
  from: "agent" | "operator";
  text: string;
  question?: string;
  timestamp: Date;
}

interface Props {
  agentId: string;
  agentLabel: string;
  checkin: CheckinData | null;
  history: ChatMessage[];
  onRespond: (agentId: string, message: string, keepHeld: boolean, leash: number | null) => void;
  onClose: () => void;
}

export type { ChatMessage };

const MCP_TIMEOUT_MS = 300_000; // 5 minutes

export function ChatPanel({ agentId, agentLabel, checkin, history, onRespond, onClose }: Props) {
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [history.length, checkin]);

  const [keepHeld, setKeepHeld] = useState(false);
  const [leashDraft, setLeashDraft] = useState("");

  // MCP timeout countdown using the stable receivedAt from workspace state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (checkin) {
      const tick = () => {
        const remaining = Math.max(0, MCP_TIMEOUT_MS - (Date.now() - checkin.receivedAt));
        setTimeLeft(remaining);
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      setTimeLeft(null);
    }
  }, [checkin]);

  const send = () => {
    const msg = input.trim() || "Continue.";
    const leash = leashDraft.trim() ? parseInt(leashDraft, 10) : null;
    onRespond(agentId, msg, keepHeld, leash && leash > 0 ? leash : null);
    setInput("");
    setLeashDraft("");
  };

  const waiting = checkin !== null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontWeight: 600 }}>Operator Chat — {agentLabel}</span>
          <div style={s.headerRight}>
            {waiting && timeLeft !== null && (
              <span style={{
                ...s.waitingBadge,
                ...(timeLeft <= 60_000
                  ? { background: "#3a1a1a", color: "#f85149", borderColor: "#da3633" }
                  : timeLeft <= 120_000
                    ? { background: "#3a2a1a", color: "#d29922", borderColor: "#9e6a03" }
                    : {}),
              }}>
                {timeLeft <= 0
                  ? "TIMED OUT"
                  : `${Math.floor(timeLeft / 60_000)}:${String(Math.floor((timeLeft % 60_000) / 1000)).padStart(2, "0")} until timeout`}
              </span>
            )}
            <button style={s.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        <div ref={bodyRef} style={s.body}>
          {history.map((msg, i) => (
            <div key={i} style={s.message}>
              {msg.from === "agent" ? (
                <>
                  <div style={s.agentBubble}>
                    <div style={s.bubbleLabel}>Agent</div>
                    <div style={s.agentText}>{msg.text}</div>
                    {msg.question && (
                      <div style={s.questionText}>{msg.question}</div>
                    )}
                  </div>
                </>
              ) : (
                <div style={s.operatorBubble}>
                  <div style={s.bubbleLabel}>Operator</div>
                  <div style={s.operatorText}>{msg.text}</div>
                </div>
              )}
            </div>
          ))}

          {history.length === 0 && !waiting && (
            <div style={s.empty}>
              No check-ins yet. Hold the agent to trigger a checkpoint.
            </div>
          )}
        </div>

        <div style={s.inputArea}>
          <textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={waiting ? "Type your response (Enter to send)..." : "Agent is running..."}
            style={{
              ...s.textarea,
              ...(waiting ? {} : s.textareaDisabled),
            }}
            disabled={!waiting}
          />
          <div style={s.sendControls}>
            <button
              style={{
                ...s.sendBtn,
                ...(waiting ? {} : s.sendBtnDisabled),
                background: keepHeld ? "#1f6feb" : "#238636",
              }}
              onClick={send}
              disabled={!waiting}
            >
              {keepHeld ? "Send + Keep held" : "Send + Release"}
            </button>
            <div style={s.optionsRow}>
              <label style={s.toggleLabel}>
                <input
                  type="checkbox"
                  checked={keepHeld}
                  onChange={(e) => setKeepHeld(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ color: "#8b949e", fontSize: 11 }}>Request response</span>
              </label>
              <label style={s.toggleLabel}>
                <span style={{ color: "#8b949e", fontSize: 11 }}>Leash</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={leashDraft}
                  onChange={(e) => setLeashDraft(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="—"
                  style={s.leashInput}
                  title="Set leash on release (empty = no change)"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  panel: {
    width: 600,
    maxWidth: "90vw",
    height: "70vh",
    maxHeight: "80vh",
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid #21262d",
    fontSize: 13,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  waitingBadge: {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 3,
    background: "#1a2a3a",
    color: "#58a6ff",
    border: "1px solid #1f6feb",
    fontWeight: 600,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: 18,
    cursor: "pointer",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "12px 16px",
  },
  message: {
    marginBottom: 12,
  },
  agentBubble: {
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: "4px 12px 12px 12px",
    padding: "8px 12px",
    maxWidth: "90%",
  },
  operatorBubble: {
    background: "#0d2818",
    border: "1px solid #238636",
    borderRadius: "12px 4px 12px 12px",
    padding: "8px 12px",
    maxWidth: "90%",
    marginLeft: "auto",
  },
  bubbleLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#8b949e",
    letterSpacing: "0.5px",
    marginBottom: 4,
  },
  agentText: {
    color: "#c9d1d9",
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  questionText: {
    color: "#58a6ff",
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid #21262d",
  },
  operatorText: {
    color: "#3fb950",
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  empty: {
    color: "#484f58",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    padding: 40,
  },
  inputArea: {
    display: "flex",
    gap: 8,
    padding: "12px 16px",
    borderTop: "1px solid #21262d",
    background: "#0d1117",
  },
  textarea: {
    flex: 1,
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 6,
    color: "#c9d1d9",
    fontSize: 13,
    padding: "8px 12px",
    fontFamily: "inherit",
    resize: "none",
    minHeight: 50,
    outline: "none",
  },
  textareaDisabled: {
    opacity: 0.4,
    cursor: "default",
  },
  sendControls: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  optionsRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
    userSelect: "none",
  },
  leashInput: {
    width: 28,
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 3,
    color: "#c9d1d9",
    fontSize: 11,
    fontFamily: "inherit",
    textAlign: "center",
    padding: "1px 2px",
    outline: "none",
  },
  sendBtn: {
    background: "#238636",
    border: "none",
    color: "#fff",
    fontSize: 13,
    padding: "8px 20px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: "inherit",
    alignSelf: "flex-end",
  },
  sendBtnDisabled: {
    opacity: 0.4,
    cursor: "default",
  },
};
