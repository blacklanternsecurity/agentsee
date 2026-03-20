export interface AgentInfo {
  agent_id: string;
  session_id: string;
  agent_type: string;
  task_description: string;
  mode: "autonomous" | "supervised";
  status: "running" | "held" | "checking_in" | "complete";
  turn_count: number;
  turn_threshold: number | null;
  transcript_path: string | null;
  has_pending_checkin: boolean;
  registered_at: string;
  last_activity: string;
}

export interface StreamEntry {
  timestamp: string;
  category: "reasoning" | "command" | "tool_call" | "tool_result";
  formatted: string;
  raw_text?: string;
  tool_name?: string;
  agent_id: string;
  byte_offset: number;
}

export interface CheckinData {
  summary: string;
  question?: string;
  /** Timestamp (ms) when this checkin was received. Used for MCP timeout countdown. */
  receivedAt: number;
}

export interface Tab {
  id: string;
  name: string;
  agentIds: string[];
}

export interface WsMessage {
  type: string;
  agent_id: string;
  data: Record<string, any>;
}
