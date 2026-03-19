export interface AgentState {
  agent_id: string;
  session_id: string;
  agent_type: string;
  task_description: string;
  mode: "autonomous" | "supervised";
  status: "running" | "held" | "checking_in" | "complete";
  turn_count: number;
  turn_threshold: number | null;
  transcript_path: string | null;
  pending_checkin: PendingCheckin | null;
  registered_at: Date;
  last_activity: Date;
}

export interface PendingCheckin {
  summary: string;
  question?: string;
  resolve: (response: string) => void;
}

export interface HookPreRequest {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  agent_id?: string;
  agent_type?: string;
}

export interface HookPostRequest {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
  tool_use_id: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  agent_id?: string;
  agent_type?: string;
}

export interface HookPreResponse {
  allow: boolean;
  reason?: string;
}

export interface AgentRegisterRequest {
  agent_id: string;
  session_id: string;
  agent_type?: string;
  task_description?: string;
  mode?: "autonomous" | "supervised";
  turn_threshold?: number | null;
  transcript_path?: string;
}

export interface AgentStatusResponse {
  agents: Record<string, Omit<AgentState, "pending_checkin"> & {
    has_pending_checkin: boolean;
  }>;
}

export interface WsEvent {
  type: string;
  agent_id: string;
  data: Record<string, unknown>;
}
