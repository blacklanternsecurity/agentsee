import { useCallback, useRef } from "react";
import type { StreamEntry } from "../types";

export function useChunkedHistory(
  prependHistory: (agentId: string, entries: StreamEntry[]) => void
) {
  const loading = useRef<Set<string>>(new Set());

  const loadMore = useCallback(
    async (agentId: string, beforeOffset: number) => {
      if (loading.current.has(agentId)) return;
      loading.current.add(agentId);

      try {
        const res = await fetch(
          `/agent/${agentId}/history?before=${beforeOffset}&limit=500`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.entries?.length > 0) {
          prependHistory(agentId, data.entries);
        }
      } finally {
        loading.current.delete(agentId);
      }
    },
    [prependHistory]
  );

  const isLoading = useCallback(
    (agentId: string) => loading.current.has(agentId),
    []
  );

  return { loadMore, isLoading };
}
