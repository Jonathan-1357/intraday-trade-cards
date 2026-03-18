"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import SymbolSearch from "@/components/SymbolSearch";
import SymbolDetailPanel from "@/components/SymbolDetailPanel";
import type { TradeCard } from "@/types";

interface Props {
  symbols: string[];
  cardBySymbol: Record<string, TradeCard>;
  onSymbolsChange?: (symbols: string[]) => void;
}

interface PriceInfo {
  price: number;
  change_pct: number;
  name: string;
}

export default function WatchlistManager({ symbols: initialSymbols, cardBySymbol, onSymbolsChange }: Props) {
  const router = useRouter();
  const [list, setList] = useState(initialSymbols);
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [selected, setSelected] = useState<{symbol: string; name: string} | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Fetch all prices
  const fetchPrices = useCallback(async () => {
    if (list.length === 0) return;
    const results = await Promise.allSettled(list.map((s) => api.market.quote(s)));
    const next: Record<string, PriceInfo> = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.price > 0) {
        next[list[i]] = {
          price: r.value.price,
          change_pct: r.value.change_pct,
          name: r.value.name,
        };
      }
    });
    setPrices((prev) => ({ ...prev, ...next }));
  }, [list]);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 5000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  async function handleWatchlistChange(next: string[]) {
    setList(next);
    onSymbolsChange?.(next);
    await api.watchlist.update(next);
    router.refresh();
  }

  async function removeSymbol(sym: string) {
    setRemoving(sym);
    const next = list.filter((s) => s !== sym);
    await handleWatchlistChange(next);
    setRemoving(null);
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <SymbolSearch watchlist={list} onWatchlistChange={handleWatchlistChange} />

      {/* Symbol cards */}
      {list.length === 0 ? (
        <p className="text-gray-500 text-sm">No symbols in watchlist. Search above to add one.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((sym) => {
            const card = cardBySymbol[sym];
            const priceInfo = prices[sym];
            const isUp = (priceInfo?.change_pct ?? 0) >= 0;

            return (
              <div
                key={sym}
                onClick={() => setSelected({ symbol: sym, name: priceInfo?.name ?? sym })}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-colors"
              >
                {/* Symbol + remove */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold text-base tracking-wide">{sym}</p>
                    {priceInfo?.name && priceInfo.name !== sym && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[140px]">{priceInfo.name}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSymbol(sym); }}
                    disabled={removing === sym}
                    className="text-gray-600 hover:text-red-400 transition-colors p-0.5 shrink-0"
                    title="Remove from watchlist"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Live price */}
                {priceInfo ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-xl font-bold font-mono">
                      ₹{priceInfo.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                      {isUp ? "▲" : "▼"} {Math.abs(priceInfo.change_pct).toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <div className="text-gray-600 text-sm animate-pulse">Loading…</div>
                )}

                {/* Trade card info */}
                {card ? (
                  <div className="space-y-1.5 border-t border-gray-800 pt-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide
                        ${card.action === "buy"
                          ? "bg-green-900/60 text-green-300 border border-green-700"
                          : "bg-red-900/60 text-red-300 border border-red-700"}`}>
                        {card.action}
                      </span>
                      <span className={`text-xs font-medium ${STATUS_COLORS[card.status]}`}>
                        {STATUS_LABELS[card.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                      <div className="bg-gray-800/60 rounded p-1.5">
                        <p className="text-gray-500 text-[10px]">Entry</p>
                        <p className="text-white font-mono">₹{card.entry}</p>
                      </div>
                      <div className="bg-gray-800/60 rounded p-1.5">
                        <p className="text-gray-500 text-[10px]">SL</p>
                        <p className="text-red-400 font-mono">₹{card.stop_loss}</p>
                      </div>
                      <div className="bg-gray-800/60 rounded p-1.5">
                        <p className="text-gray-500 text-[10px]">Target</p>
                        <p className="text-green-400 font-mono">₹{card.target}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 text-xs border-t border-gray-800 pt-2">No active card</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <SymbolDetailPanel
          symbol={selected.symbol}
          name={selected.name}
          watchlist={list}
          onClose={() => setSelected(null)}
          onWatchlistChange={handleWatchlistChange}
        />
      )}
    </div>
  );
}
