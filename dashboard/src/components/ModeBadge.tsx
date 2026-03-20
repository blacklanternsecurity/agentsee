interface Props {
  mode: "autonomous" | "supervised";
  status: string;
}

const styles: Record<string, React.CSSProperties> = {
  badge: {
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 3,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  autonomous: {
    background: "#1a3a2a",
    color: "#3fb950",
    border: "1px solid #238636",
  },
  supervised: {
    background: "#3a2a1a",
    color: "#d29922",
    border: "1px solid #9e6a03",
  },
  held: {
    background: "#3a1a1a",
    color: "#f85149",
    border: "1px solid #da3633",
  },
  checking_in: {
    background: "#1a2a3a",
    color: "#58a6ff",
    border: "1px solid #1f6feb",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  complete: {
    background: "#1a1a1a",
    color: "#484f58",
    border: "1px solid #30363d",
  },
};

export function ModeBadge({ mode, status }: Props) {
  const variant =
    status === "complete"
      ? "complete"
      : status === "held"
        ? "held"
        : status === "checking_in"
          ? "checking_in"
          : mode;

  const label =
    status === "complete"
      ? "DONE"
      : status === "held"
        ? "HELD"
        : status === "checking_in"
          ? "CHECKING IN"
          : mode === "supervised"
            ? "SUPERVISED"
            : "AUTO";

  return <span style={{ ...styles.badge, ...styles[variant] }}>{label}</span>;
}
