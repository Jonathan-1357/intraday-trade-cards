"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import CandleChart from "@/components/CandleChart";

interface Candle { time: number; open: number; high: number; low: number; close: number; }

const RANGES = [
  { label: "1H",  interval: "1minute",   days: 5,   last_n: 60  },
  { label: "1D",  interval: "1minute",   days: 5,   last_n: 375 },
  { label: "1W",  interval: "15minute",  days: 7,   last_n: undefined },
  { label: "1M",  interval: "30minute",  days: 30,  last_n: undefined },
  { label: "3M",  interval: "60minute",  days: 90,  last_n: undefined },
  { label: "6M",  interval: "120minute", days: 180, last_n: undefined },
  { label: "1Y",  interval: "day",       days: 365, last_n: undefined },
] as const;

type RangeLabel = typeof RANGES[number]["label"];

interface Props {
  symbol: string;
  name: string;
  watchlist: string[];
  onClose: () => void;
  onWatchlistChange: (symbols: string[]) => void;
}

export default function SymbolDetailPanel({ symbol, name, watchlist, onClose, onWatchlistChange }: Props) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<RangeLabel>("3M");
  const [loadingChart, setLoadingChart] = useState(false);
  const [intradayUnavailable, setIntradayUnavailable] = useState(false);
  const isInWatchlist = watchlist.includes(symbol);

  // Fetch candles when symbol or range changes
  useEffect(() => {
    const r = RANGES.find((x) => x.label === range)!;
    setLoadingChart(true);
    setCandles([]);
    setIntradayUnavailable(false);
    api.market.candles(symbol, {
      interval: r.interval,
      days: r.days,
      last_n: r.last_n,
    }).then((data) => {
      if (data.length === 0 && r.interval !== "day") {
        // Intraday unavailable outside market hours — fall back to daily
        setIntradayUnavailable(true);
        return api.market.candles(symbol, { interval: "day", days: 30 });
      }
      return data;
    }).then(setCandles).catch(() => {}).finally(() => setLoadingChart(false));
  }, [symbol, range]);

  // Poll price every 5s
  const fetchQuote = useCallback(() => {
    api.market.quote(symbol).then(setQuote).catch(() => {});
  }, [symbol]);

  useEffect(() => {
    fetchQuote();
    const id = setInterval(fetchQuote, 5000);
    return () => clearInterval(id);
  }, [fetchQuote]);

  async function toggleWatchlist() {
    setSaving(true);
    const next = isInWatchlist
      ? watchlist.filter((s) => s !== symbol)
      : [...watchlist, symbol];
    try {
      await api.watchlist.update(next);
      onWatchlistChange(next);
    } finally {
      setSaving(false);
    }
  }

  const price = quote?.price ?? 0;
  const change = quote?.change ?? 0;
  const changePct = quote?.change_pct ?? 0;
  const isUp = change >= 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800">
          <div>
            <p className="text-white font-bold text-xl tracking-wide">{symbol}</p>
            <p className="text-gray-400 text-sm mt-0.5">{name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Live price */}
        <div className="px-6 py-4 border-b border-gray-800">
          {price > 0 ? (
            <div className="flex items-end gap-4">
              <p className="text-white text-4xl font-bold font-mono">
                ₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className={`flex items-center gap-1 pb-1 text-sm font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                <span>{isUp ? "▲" : "▼"}</span>
                <span>{Math.abs(change).toFixed(2)}</span>
                <span>({Math.abs(changePct).toFixed(2)}%)</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-600 text-sm">Loading price…</div>
          )}

          {/* OHLV */}
          {quote && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                { label: "Open", value: quote.open },
                { label: "High", value: quote.high },
                { label: "Low", value: quote.low },
                { label: "Volume", value: null, raw: quote.volume?.toLocaleString("en-IN") },
              ].map(({ label, value, raw }) => (
                <div key={label} className="bg-gray-900 rounded-lg p-2.5 text-center">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-white text-sm font-mono font-medium">
                    {raw ?? (value != null ? `₹${value.toFixed(2)}` : "—")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="px-6 py-4 flex-1">
          {/* Range selector */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRange(r.label)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                    ${range === r.label
                      ? "bg-blue-600 text-white"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {intradayUnavailable && (
              <span className="text-gray-600 text-xs">Intraday unavailable · showing 1M</span>
            )}
          </div>

          {loadingChart ? (
            <div className="h-96 flex items-center justify-center text-gray-600 text-sm animate-pulse">
              Loading chart…
            </div>
          ) : candles.length > 0 ? (
            <CandleChart candles={candles} currentPrice={price > 0 ? price : undefined} />
          ) : (
            <div className="h-96 flex items-center justify-center text-gray-600 text-sm">
              No data available
            </div>
          )}
        </div>

        {/* Add/Remove watchlist */}
        <div className="px-6 py-4 border-t border-gray-800">
          <button
            onClick={toggleWatchlist}
            disabled={saving}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors
              ${isInWatchlist
                ? "border border-red-700 text-red-400 hover:bg-red-900/20"
                : "bg-amber-600 hover:bg-amber-500 text-white"
              } disabled:opacity-50`}
          >
            {saving ? "Saving…" : isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
