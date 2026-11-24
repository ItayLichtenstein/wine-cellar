"use client";

import { useSyncExternalStore } from "react";
import type { FridgeViewMode } from "@/components/fridge-preview";

const KEY = "fridge-view";
const CHANGED = "fridge-view-changed"; // same-tab notification (the "storage" event fires only in other tabs)

function read(): FridgeViewMode {
  try {
    return localStorage.getItem(KEY) === "dots" ? "dots" : "labels";
  } catch {
    return "labels"; // storage blocked (e.g. private mode) – use the default
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * Labels or dots, remembered per device. Labels is the default (spec).
 *
 * useSyncExternalStore is React's tool for values that live outside React
 * (here: the browser's localStorage). The server always renders "labels";
 * after hydration React reads the saved choice and re-renders if needed –
 * no hydration mismatch, and it also follows changes made in other tabs.
 */
export function useFridgeView(): [FridgeViewMode, (v: FridgeViewMode) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "labels" as const);

  function change(v: FridgeViewMode) {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // storage unavailable – nothing to remember
    }
    window.dispatchEvent(new Event(CHANGED));
  }

  return [view, change];
}
