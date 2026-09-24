"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface DashboardContextValue {
  composeOpen: boolean;
  openCompose: () => void;
  closeCompose: () => void;
  refreshSignal: number;
  triggerRefresh: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const openCompose = useCallback(() => setComposeOpen(true), []);
  const closeCompose = useCallback(() => setComposeOpen(false), []);
  const triggerRefresh = useCallback(() => setRefreshSignal((n) => n + 1), []);

  return (
    <DashboardContext.Provider value={{ composeOpen, openCompose, closeCompose, refreshSignal, triggerRefresh }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
