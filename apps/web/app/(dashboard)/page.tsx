import FilterBar from "@/components/FilterBar";
import GenerateButton from "@/components/GenerateButton";
import SelectableCardGrid from "@/components/SelectableCardGrid";
import SummaryBar from "@/components/SummaryBar";
import type { RiskConfig, TradeCard } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

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

export default async function TradeCardsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const activeFilter = searchParams.status;
  const [filteredCards, allCards, riskConfig] = await Promise.all([
    getCards(activeFilter),
    getAllCards(),
    getRiskConfig(),
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-white">IRIS IQ</h1>
          <p className="text-gray-500 text-xs mt-0.5">Signal-evaluated intraday setups</p>
        </div>
        <GenerateButton />
      </header>

      {/* KPI bar */}
      <div className="px-6 py-4 border-b border-gray-800">
        <SummaryBar cards={allCards} riskConfig={riskConfig} />
      </div>

      {/* Filters + Grid */}
      <div className="flex-1 flex flex-col px-6 py-4 gap-4">
        <FilterBar />
        <SelectableCardGrid cards={filteredCards} status={activeFilter} />
      </div>
    </div>
  );
}
