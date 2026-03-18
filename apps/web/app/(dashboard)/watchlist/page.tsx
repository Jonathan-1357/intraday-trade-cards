import WatchlistPageClient from "@/components/WatchlistPageClient";
import type { TradeCard } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getWatchlist(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/watchlist`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.symbols ?? [];
  } catch {
    return [];
  }
}

async function getActiveCards(): Promise<TradeCard[]> {
  try {
    const res = await fetch(`${BASE}/trade-cards`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function WatchlistPage() {
  const [symbols, cards] = await Promise.all([getWatchlist(), getActiveCards()]);

  const cardBySymbol: Record<string, TradeCard> = {};
  for (const card of cards) {
    if (!cardBySymbol[card.symbol]) cardBySymbol[card.symbol] = card;
  }

  return (
    <WatchlistPageClient
      initialSymbols={symbols}
      cardBySymbol={cardBySymbol}
    />
  );
}
