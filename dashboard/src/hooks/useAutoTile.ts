import { useMemo } from "react";

export interface TileLayout {
  cols: number;
  rows: number;
}

/**
 * Compute grid layout from pane count.
 * 1 → 1x1, 2 → 2x1, 3 → 3x1 or 2x2, 4 → 2x2, etc.
 */
export function useAutoTile(
  paneCount: number,
  containerWidth: number
): TileLayout {
  return useMemo(() => {
    if (paneCount <= 0) return { cols: 1, rows: 1 };
    if (paneCount === 1) return { cols: 1, rows: 1 };

    const isWide = containerWidth > 1200;

    if (paneCount === 2) return { cols: 2, rows: 1 };
    if (paneCount === 3) return isWide ? { cols: 3, rows: 1 } : { cols: 2, rows: 2 };
    if (paneCount === 4) return { cols: 2, rows: 2 };
    if (paneCount <= 6) return isWide ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
    if (paneCount <= 9) return { cols: 3, rows: 3 };

    const cols = Math.ceil(Math.sqrt(paneCount));
    const rows = Math.ceil(paneCount / cols);
    return { cols, rows };
  }, [paneCount, containerWidth]);
}
