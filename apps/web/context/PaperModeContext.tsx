"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface PaperStatus {
  enabled: boolean;
  balance: number;
  initial_balance: number;
}

interface PaperModeContextValue {
  paper: PaperStatus;
  refresh: () => Promise<void>;
  toggle: (on: boolean) => Promise<void>;
  addFunds: (amount: number) => Promise<void>;
}

const defaultStatus: PaperStatus = { enabled: false, balance: 0, initial_balance: 0 };

const PaperModeContext = createContext<PaperModeContextValue>({
  paper: defaultStatus,
  refresh: async () => {},
  toggle: async () => {},
  addFunds: async () => {},
});

export function PaperModeProvider({ children }: { children: React.ReactNode }) {
  const [paper, setPaper] = useState<PaperStatus>(defaultStatus);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/broker/paper/status`);
      if (res.ok) setPaper(await res.json());
    } catch { /* api not ready */ }
  }, []);

  const toggle = useCallback(async (on: boolean) => {
    const res = await fetch(`${BASE}/broker/paper/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: on }),
    });
    if (res.ok) setPaper(await res.json());
  }, []);

  const addFunds = useCallback(async (amount: number) => {
    const res = await fetch(`${BASE}/broker/paper/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_funds: amount }),
    });
    if (res.ok) setPaper(await res.json());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <PaperModeContext.Provider value={{ paper, refresh, toggle, addFunds }}>
      {children}
    </PaperModeContext.Provider>
  );
}

export function usePaperMode() {
  return useContext(PaperModeContext);
}
