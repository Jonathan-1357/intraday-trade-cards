import FilterBar from "@/components/FilterBar";
import SelectableCardGrid from "@/components/SelectableCardGrid";
import GenerateButton from "@/components/GenerateButton";
import RiskConfigPanel from "@/components/RiskConfigPanel";
import SummaryBar from "@/components/SummaryBar";
import WatchlistEditor from "@/components/WatchlistEditor";
import type { RiskConfig, TradeCard } from "@/types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getCards(status?: string): Promise<TradeCard[]> {
  const qs = status ? `?status=${status}` : "";
  try {
    const res = await fetch(`${BASE}/trade-cards${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getAllCards(): Promise<TradeCard[]> {
  try {
    const res = await fetch(`${BASE}/trade-cards`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getRiskConfig(): Promise<RiskConfig | null> {
  try {
    const res = await fetch(`${BASE}/risk-config`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const activeFilter = searchParams.status;

  const [filteredCards, allCards, riskConfig, watchlistSymbols] =
    await Promise.all([
      getCards(activeFilter),
      getAllCards(),
      getRiskConfig(),
      getWatchlist(),
    ]);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trade Cards</h1>
            <p className="text-gray-400 text-sm mt-0.5">Intraday Trade Card System</p>
          </div>
          <GenerateButton />
        </header>

        {/* Summary */}
        <SummaryBar cards={allCards} riskConfig={riskConfig} />

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 shrink-0 space-y-4">
            {riskConfig && <RiskConfigPanel initial={riskConfig} />}
            <WatchlistEditor initial={watchlistSymbols} />
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <FilterBar />
            </div>
            <SelectableCardGrid cards={filteredCards} status={activeFilter} />
          </div>
        </div>
      </div>
    </main>
  );
}
