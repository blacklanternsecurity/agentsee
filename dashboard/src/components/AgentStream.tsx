import { useEffect, useRef, useState } from "react";
import type { StreamEntry } from "../types";

interface Props {
  entries: StreamEntry[];
  onScrollTop?: () => void;
}

const CATEGORY_STYLES: Record<string, React.CSSProperties> = {
  reasoning: { color: "#56d6d6" }, // cyan
  command: { color: "#e3b341", fontWeight: 600 }, // yellow bold
  tool_result: { color: "#3fb950" }, // green
  tool_call: { color: "#6e7681" }, // dim
};

export function AgentStream({ entries, onScrollTop }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const prevLenRef = useRef(0);

  // Auto-scroll on new entries
  useEffect(() => {
    if (autoFollow && containerRef.current && entries.length > prevLenRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLenRef.current = entries.length;
  }, [entries.length, autoFollow]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoFollow(atBottom);

    // Trigger history load when scrolled to top
    if (el.scrollTop === 0 && onScrollTop) {
      onScrollTop();
    }
  };

  return (
    <div style={s.wrapper}>
      <div ref={containerRef} style={s.container} onScroll={handleScroll}>
        {entries.map((entry, i) => (
          <div key={i} style={s.entry}>
            {entry.category === "command" && (
              <span style={{ color: "#e3b341" }}>▶ </span>
            )}
            <span style={CATEGORY_STYLES[entry.category] ?? {}}>
              {entry.formatted}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div style={s.empty}>Waiting for agent output...</div>
        )}
      </div>
      {!autoFollow && (
        <button
          style={s.jumpBtn}
          onClick={() => {
            setAutoFollow(true);
            if (containerRef.current) {
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            }
          }}
        >
          ↓ Jump to bottom
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  },
  container: {
    height: "100%",
    overflow: "auto",
    padding: "4px 8px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
    fontSize: 12,
  },
  entry: {
    padding: "1px 0",
  },
  empty: {
    color: "#484f58",
    fontStyle: "italic",
    padding: 20,
    textAlign: "center",
  },
  jumpBtn: {
    position: "absolute",
    bottom: 8,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1f6feb",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "4px 12px",
    fontSize: 11,
    cursor: "pointer",
    zIndex: 10,
  },
};
