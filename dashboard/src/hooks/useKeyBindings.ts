import { useEffect } from "react";

interface KeyBindingActions {
  switchTab: (index: number) => void;
  createTab: () => void;
  focusNext: () => void;
  focusPrev: () => void;
  maximize: () => void;
  dismiss: () => void;
  toggleBrowser: () => void;
  holdFocused: () => void;
  releaseFocused: () => void;
}

export function useKeyBindings(actions: KeyBindingActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // 1-9: switch tabs
      if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        actions.switchTab(parseInt(e.key) - 1);
        return;
      }

      // Ctrl+T: new tab
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        actions.createTab();
        return;
      }

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) actions.focusPrev();
          else actions.focusNext();
          break;
        case "f":
          actions.maximize();
          break;
        case "d":
          actions.dismiss();
          break;
        case "b":
          actions.toggleBrowser();
          break;
        case "h":
          actions.holdFocused();
          break;
        case "r":
          actions.releaseFocused();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
