import { useState, useCallback } from "react";
import type { Tab, AgentInfo, StreamEntry, CheckinData } from "../types";
import type { ChatMessage } from "../components/ChatPanel";

const STORAGE_KEY = "agentsee-workspace";

function loadTabs(): Tab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [{ id: "all", name: "All", agentIds: [] }];
}

function saveTabs(tabs: Tab[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

let nextTabId = 1;

export function useWorkspace() {
  const [tabs, setTabs] = useState<Tab[]>(loadTabs);
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "all");
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({});
  const [streams, setStreams] = useState<Record<string, StreamEntry[]>>({});
  const [checkins, setCheckins] = useState<Record<string, CheckinData>>({});
  const [maximizedAgent, setMaximizedAgent] = useState<string | null>(null);

  const updateTabs = useCallback((fn: (prev: Tab[]) => Tab[]) => {
    setTabs((prev) => {
      const next = fn(prev);
      saveTabs(next);
      return next;
    });
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Remove agent IDs from tabs that no longer exist on the server
  const cleanStaleTabs = useCallback(
    (validIds: Set<string>) => {
      updateTabs((tabs) =>
        tabs.map((t) => ({
          ...t,
          agentIds: t.agentIds.filter((id) => validIds.has(id)),
        }))
      );
    },
    [updateTabs]
  );

  // Agent management
  const updateAgent = useCallback((id: string, patch: Partial<AgentInfo>) => {
    setAgents((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }, []);

  const registerAgent = useCallback(
    (agent: AgentInfo) => {
      setAgents((prev) => ({ ...prev, [agent.agent_id]: agent }));
      // Auto-add to first tab if not in any tab
      updateTabs((tabs) => {
        const inAnyTab = tabs.some((t) => t.agentIds.includes(agent.agent_id));
        if (inAnyTab) return tabs;
        // Add to first tab
        return tabs.map((t, i) =>
          i === 0
            ? { ...t, agentIds: [...t.agentIds, agent.agent_id] }
            : t
        );
      });
    },
    [updateTabs]
  );

  const removeAgent = useCallback(
    (agentId: string) => {
      setAgents((prev) => {
        const { [agentId]: _, ...rest } = prev;
        return rest;
      });
      setStreams((prev) => {
        const { [agentId]: _, ...rest } = prev;
        return rest;
      });
      // Remove from all tabs
      updateTabs((tabs) =>
        tabs.map((t) => ({
          ...t,
          agentIds: t.agentIds.filter((id) => id !== agentId),
        }))
      );
      if (maximizedAgent === agentId) setMaximizedAgent(null);
    },
    [updateTabs, maximizedAgent]
  );

  // Tab management
  const createTab = useCallback(
    (name?: string) => {
      const id = `tab-${Date.now()}-${nextTabId++}`;
      const tab: Tab = { id, name: name ?? `Tab ${tabs.length + 1}`, agentIds: [] };
      updateTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
      return id;
    },
    [tabs.length, updateTabs]
  );

  const renameTab = useCallback(
    (id: string, name: string) => {
      updateTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    },
    [updateTabs]
  );

  const closeTab = useCallback(
    (id: string) => {
      updateTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        if (filtered.length === 0)
          filtered.push({ id: "all", name: "All", agentIds: [] });
        return filtered;
      });
      if (activeTabId === id) {
        setTabs((prev) => {
          setActiveTabId(prev[0]?.id ?? "all");
          return prev;
        });
      }
    },
    [activeTabId, updateTabs]
  );

  const addAgentToTab = useCallback(
    (tabId: string, agentId: string) => {
      updateTabs((prev) =>
        prev.map((t) =>
          t.id === tabId && !t.agentIds.includes(agentId)
            ? { ...t, agentIds: [...t.agentIds, agentId] }
            : t
        )
      );
    },
    [updateTabs]
  );

  const removeAgentFromTab = useCallback(
    (tabId: string, agentId: string) => {
      updateTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, agentIds: t.agentIds.filter((id) => id !== agentId) }
            : t
        )
      );
      if (maximizedAgent === agentId) setMaximizedAgent(null);
    },
    [updateTabs, maximizedAgent]
  );

  // Stream management
  const appendStream = useCallback(
    (agentId: string, entry: StreamEntry) => {
      setStreams((prev) => {
        const existing = prev[agentId] ?? [];
        // Cap at 2000 entries in browser memory
        const next =
          existing.length >= 2000
            ? [...existing.slice(-1500), entry]
            : [...existing, entry];
        return { ...prev, [agentId]: next };
      });
    },
    []
  );

  const setStreamHistory = useCallback(
    (agentId: string, entries: StreamEntry[]) => {
      setStreams((prev) => ({
        ...prev,
        [agentId]: entries,
      }));
    },
    []
  );

  const prependStreamHistory = useCallback(
    (agentId: string, entries: StreamEntry[]) => {
      setStreams((prev) => ({
        ...prev,
        [agentId]: [...entries, ...(prev[agentId] ?? [])],
      }));
    },
    []
  );

  // Checkin + chat history management
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

  const setCheckin = useCallback(
    (agentId: string, data: CheckinData | null) => {
      setCheckins((prev) => {
        if (data === null) {
          const { [agentId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [agentId]: data };
      });
    },
    []
  );

  const addChatMessage = useCallback(
    (agentId: string, msg: ChatMessage) => {
      setChatHistories((prev) => ({
        ...prev,
        [agentId]: [...(prev[agentId] ?? []), msg],
      }));
    },
    []
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    createTab,
    renameTab,
    closeTab,
    addAgentToTab,
    removeAgentFromTab,
    agents,
    registerAgent,
    updateAgent,
    removeAgent,
    cleanStaleTabs,
    streams,
    appendStream,
    setStreamHistory,
    prependStreamHistory,
    checkins,
    setCheckin,
    chatHistories,
    addChatMessage,
    maximizedAgent,
    setMaximizedAgent,
  };
}
