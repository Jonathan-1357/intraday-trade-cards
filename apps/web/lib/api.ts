import type { RiskConfig, TradeCard } from "@/types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  tradeCards: {
    list: (status?: string): Promise<TradeCard[]> => {
      const qs = status ? `?status=${status}` : "";
      return apiFetch<TradeCard[]>(`/trade-cards${qs}`, { cache: "no-store" });
    },
    get: (id: string): Promise<TradeCard> =>
      apiFetch<TradeCard>(`/trade-cards/${id}`),
    generate: (): Promise<{ generated: number; cards: TradeCard[] }> =>
      apiFetch(`/trade-cards/generate`, { method: "POST" }),
    refresh: (): Promise<{ updated: number }> =>
      apiFetch(`/trade-cards/refresh`, { method: "POST" }),
    archive: (ids: string[]): Promise<{ archived: number }> =>
      apiFetch(`/trade-cards/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
  },
  riskConfig: {
    get: (): Promise<RiskConfig> =>
      apiFetch<RiskConfig>(`/risk-config`, { cache: "no-store" }),
    update: (config: RiskConfig): Promise<RiskConfig> =>
      apiFetch<RiskConfig>(`/risk-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }),
  },
  watchlist: {
    get: (): Promise<{ symbols: string[] }> =>
      apiFetch<{ symbols: string[] }>(`/watchlist`, { cache: "no-store" }),
    update: (symbols: string[]): Promise<{ symbols: string[] }> =>
      apiFetch<{ symbols: string[] }>(`/watchlist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
      }),
  },
};
