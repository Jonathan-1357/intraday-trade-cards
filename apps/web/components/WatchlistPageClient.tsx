"use client";

import { useState } from "react";
import WatchlistManager from "@/components/WatchlistManager";
import AutoWatchlistPanel from "@/components/AutoWatchlistPanel";
import type { TradeCard } from "@/types";

type Tab = "my" | "auto";

export default function WatchlistPageClient({
  initialSymbols,
  cardBySymbol,
}: {
  initialSymbols: string[];
  cardBySymbol: Record<string, TradeCard>;
}) {
  const [tab, setTab] = useState<Tab>("my");
  const [symbols, setSymbols] = useState(initialSymbols);

  return (
    <div className="flex flex-col h-full">
      {/* Header + tabs */}
      <header className="px-6 py-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Watchlist</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {symbols.length} symbol{symbols.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setTab("my")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors
              ${tab === "my"
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
              }`}
          >
            My Watchlist
          </button>
          <button
            onClick={() => setTab("auto")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5
              ${tab === "auto"
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
              }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Auto-Scan
          </button>
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        {tab === "my" ? (
          <WatchlistManager
            symbols={symbols}
            cardBySymbol={cardBySymbol}
            onSymbolsChange={setSymbols}
          />
        ) : (
          <AutoWatchlistPanel
            watchlist={symbols}
            onWatchlistChange={setSymbols}
          />
        )}
      </div>
    </div>
  );
}
