export interface StreamEntry {
  timestamp: Date;
  category: "reasoning" | "command" | "tool_call" | "tool_result";
  formatted: string;
  raw_text?: string;
  tool_name?: string;
  agent_id: string;
  byte_offset: number;
}
