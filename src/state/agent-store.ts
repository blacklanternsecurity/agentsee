import { AgentState, AgentRegisterRequest } from "../types.js";

export class AgentStore {
  private agents = new Map<string, AgentState>();

  register(req: AgentRegisterRequest): AgentState {
    const threshold =
      req.turn_threshold !== undefined
        ? req.turn_threshold
        : req.mode === "supervised"
          ? 1
          : null;

    const existing = this.agents.get(req.agent_id);
    if (existing) {
      existing.session_id = req.session_id;
      if (req.task_description) existing.task_description = req.task_description;
      if (req.agent_type) existing.agent_type = req.agent_type;
      if (req.transcript_path) existing.transcript_path = req.transcript_path;
      existing.last_activity = new Date();
      return existing;
    }

    const state: AgentState = {
      agent_id: req.agent_id,
      session_id: req.session_id,
      agent_type: req.agent_type ?? "unknown",
      task_description: req.task_description ?? "",
      mode: threshold === null ? "autonomous" : "supervised",
      status: "running",
      turn_count: 0,
      turn_threshold: threshold,
      transcript_path: req.transcript_path ?? null,
      pending_checkin: null,
      registered_at: new Date(),
      last_activity: new Date(),
    };

    this.agents.set(req.agent_id, state);
    return state;
  }

  get(agent_id: string): AgentState | undefined {
    return this.agents.get(agent_id);
  }

  getOrAutoRegister(
    agent_id: string,
    session_id: string,
    agent_type?: string,
    transcript_path?: string
  ): AgentState {
    let state = this.agents.get(agent_id);
    if (!state) {
      state = this.register({
        agent_id,
        session_id,
        agent_type,
        transcript_path,
        mode: "autonomous",
      });
    } else {
      if (transcript_path && !state.transcript_path) {
        state.transcript_path = transcript_path;
      }
      if (agent_type && state.agent_type === "unknown") {
        state.agent_type = agent_type;
      }
    }
    return state;
  }

  hold(agent_id: string): boolean {
    const state = this.agents.get(agent_id);
    if (!state) return false;
    state.status = "held";
    return true;
  }

  remove(agent_id: string): boolean {
    return this.agents.delete(agent_id);
  }

  release(agent_id: string): boolean {
    const state = this.agents.get(agent_id);
    if (!state) return false;
    if (state.status === "held") {
      state.status = "running";
    }
    return true;
  }

  setThreshold(agent_id: string, threshold: number | null): boolean {
    const state = this.agents.get(agent_id);
    if (!state) return false;
    state.turn_threshold = threshold;
    state.turn_count = 0;
    state.mode = threshold === null ? "autonomous" : "supervised";
    return true;
  }

  setComplete(agent_id: string): boolean {
    const state = this.agents.get(agent_id);
    if (!state) return false;
    state.status = "complete";
    return true;
  }

  resetTurnCount(agent_id: string): void {
    const state = this.agents.get(agent_id);
    if (state) {
      state.turn_count = 0;
    }
  }

  incrementTurnCount(agent_id: string): number {
    const state = this.agents.get(agent_id);
    if (!state) return 0;
    state.turn_count++;
    state.last_activity = new Date();
    return state.turn_count;
  }

  /** Find an agent by type name (e.g. "ad-discovery-agent"). Returns the most recently active match. */
  findByType(agentType: string): AgentState | undefined {
    let best: AgentState | undefined;
    for (const state of this.agents.values()) {
      if (state.agent_type === agentType) {
        if (!best || state.last_activity > best.last_activity) {
          best = state;
        }
      }
    }
    return best;
  }

  all(): AgentState[] {
    return Array.from(this.agents.values());
  }

  allIds(): string[] {
    return Array.from(this.agents.keys());
  }

  toJSON(): Record<
    string,
    Omit<AgentState, "pending_checkin"> & { has_pending_checkin: boolean }
  > {
    const result: Record<string, any> = {};
    for (const [id, state] of this.agents) {
      const { pending_checkin, ...rest } = state;
      result[id] = {
        ...rest,
        has_pending_checkin: pending_checkin !== null,
      };
    }
    return result;
  }
}
