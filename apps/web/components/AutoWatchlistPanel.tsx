"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface WatchlistEntry {
  id: string;
  symbol: string;
  score: number;
  rank: number;
  category: string;
  action: "buy" | "sell";
  reason_tags: string[];
  indicator_snapshot: Record<string, number | string | null>;
  dismissed: boolean;
  traded: boolean;
}

interface TodayResponse {
  date: string;
  total: number;
  categories: Record<string, WatchlistEntry[]>;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Gap Up Momentum": "🚀",
  "Gap Down Reversal": "🔄",
  "Breakout Candidate": "📈",
  "High Volume Mover": "🔥",
  "Strong Momentum": "⚡",
};

const TAG_COLORS: Record<string, string> = {
  "Gap Up": "bg-green-900/60 text-green-300 border-green-700",
  "Gap Down": "bg-red-900/60 text-red-300 border-red-700",
  "Volume Spike": "bg-blue-900/60 text-blue-300 border-blue-700",
  "High Volume": "bg-blue-900/40 text-blue-400 border-blue-800",
  "RSI Bullish": "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  "RSI Reversal Zone": "bg-amber-900/60 text-amber-300 border-amber-700",
  "Bullish EMA Stack": "bg-green-900/40 text-green-400 border-green-800",
  "Bearish EMA Stack": "bg-red-900/40 text-red-400 border-red-800",
  "MACD Positive": "bg-teal-900/60 text-teal-300 border-teal-700",
  "Strong Sector": "bg-purple-900/60 text-purple-300 border-purple-700",
  "High ATR": "bg-orange-900/60 text-orange-300 border-orange-700",
  "OR Breakout ↑": "bg-green-900/60 text-green-300 border-green-700",
  "OR Breakdown ↓": "bg-red-900/60 text-red-300 border-red-700",
  "Nifty Aligned": "bg-indigo-900/60 text-indigo-300 border-indigo-700",
  "Low Liquidity": "bg-gray-800 text-gray-500 border-gray-700",
  "Near Circuit Limit": "bg-red-950 text-red-400 border-red-800",
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 80) * 100);
  const color = score >= 50 ? "bg-green-500" : score >= 30 ? "bg-amber-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-6 text-right">{score}</span>
    </div>
  );
}

function EntryCard({
  entry,
  watchlist,
  onDismiss,
  onTraded,
  onAddToWatchlist,
}: {
  entry: WatchlistEntry;
  watchlist: string[];
  onDismiss: (id: string) => void;
  onTraded: (id: string) => void;
  onAddToWatchlist: (symbol: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const snap = entry.indicator_snapshot;
  const isInWatchlist = watchlist.includes(entry.symbol);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold text-base tracking-wide">{entry.symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide border
            ${entry.action === "buy"
              ? "bg-green-900/60 text-green-300 border-green-700"
              : "bg-red-900/60 text-red-300 border-red-700"
            }`}>
            {entry.action}
          </span>
          {entry.traded && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800 uppercase font-semibold">Traded</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-gray-600 text-xs font-mono">#{entry.rank}</span>
        </div>
      </div>

      {/* Score bar */}
      <ScoreBar score={entry.score} />

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {entry.reason_tags.filter(t => t !== "Low Liquidity" && t !== "Near Circuit Limit").map((tag) => (
          <span
            key={tag}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TAG_COLORS[tag] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}
          >
            {tag}
          </span>
        ))}
        {entry.reason_tags.filter(t => t === "Low Liquidity" || t === "Near Circuit Limit").map((tag) => (
          <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TAG_COLORS[tag]}`}>{tag}</span>
        ))}
      </div>

      {/* Expandable indicators */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="text-xs text-gray-600 hover:text-gray-400 text-left transition-colors"
      >
        {expanded ? "▲ Hide details" : "▼ Why this stock?"}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-1.5 text-xs border-t border-gray-800 pt-3">
          {[
            { label: "Price", value: snap.price != null ? `₹${Number(snap.price).toFixed(2)}` : "—" },
            { label: "RSI", value: snap.rsi != null ? Number(snap.rsi).toFixed(1) : "—" },
            { label: "Vol Ratio", value: snap.volume_ratio != null ? `${Number(snap.volume_ratio).toFixed(2)}×` : "—" },
            { label: "Gap", value: snap.gap_pct != null ? `${(Number(snap.gap_pct) * 100).toFixed(2)}%` : "—" },
            { label: "EMA21", value: snap.ema21 != null ? `₹${Number(snap.ema21).toFixed(2)}` : "—" },
            { label: "EMA50", value: snap.ema50 != null ? `₹${Number(snap.ema50).toFixed(2)}` : "—" },
            { label: "ATR", value: snap.atr != null ? `₹${Number(snap.atr).toFixed(2)}` : "—" },
            { label: "MACD", value: snap.macd_histogram != null ? Number(snap.macd_histogram).toFixed(2) : "—" },
            { label: "Sector", value: String(snap.sector_direction ?? "—") },
            { label: "OR", value: String(snap.or_breakout ?? "—") },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800/60 rounded p-2">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</p>
              <p className="text-white font-mono mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {!isInWatchlist && (
          <button
            onClick={() => onAddToWatchlist(entry.symbol)}
            className="flex-1 py-1.5 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            + Watchlist
          </button>
        )}
        {!entry.traded && (
          <button
            onClick={() => onTraded(entry.id)}
            className="flex-1 py-1.5 text-xs font-semibold rounded border border-blue-700 text-blue-400 hover:bg-blue-900/20 transition-colors"
          >
            Mark Traded
          </button>
        )}
        <button
          onClick={() => onDismiss(entry.id)}
          className="py-1.5 px-3 text-xs font-semibold rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function AutoWatchlistPanel({
  watchlist,
  onWatchlistChange,
}: {
  watchlist: string[];
  onWatchlistChange: (symbols: string[]) => void;
}) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auto-watchlist/today`
      );
      if (res.ok) setData(await res.json());
    } catch { /* empty on first load */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auto-watchlist/generate`,
        { method: "POST" }
      );
      if (res.ok) await fetchToday();
    } finally {
      setGenerating(false);
    }
  }

  async function handleDismiss(id: string) {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auto-watchlist/${id}/dismiss`,
      { method: "POST" }
    );
    await fetchToday();
  }

  async function handleTraded(id: string) {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auto-watchlist/${id}/traded`,
      { method: "POST" }
    );
    await fetchToday();
  }

  async function handleAddToWatchlist(symbol: string) {
    const next = [...new Set([...watchlist, symbol])];
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/watchlist`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: next }),
      }
    );
    onWatchlistChange(next);
  }

  const hasData = data && data.total > 0;
  const categories = data?.categories ?? {};

  return (
    <div className="space-y-6">
      {/* Header + Generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Auto-Scan Watchlist</h2>
          {hasData && (
            <p className="text-gray-500 text-xs mt-0.5">
              {data.total} stocks · {data.date}
            </p>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {generating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.384a3.07 3.07 0 00-.766 2.016v.05a2.25 2.25 0 004.5 0v-.05a3.07 3.07 0 00-.766-2.016l-.347-.384" />
              </svg>
              Auto-Scan Market
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-gray-600 text-sm animate-pulse">Loading…</div>
      ) : !hasData ? (
        <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">No scan results for today.</p>
          <p className="text-gray-600 text-xs mt-1">Click "Auto-Scan Market" to analyse {">"}80 stocks and surface top opportunities.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(categories).map(([category, entries]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{CATEGORY_ICONS[category] ?? "📊"}</span>
                <h3 className="text-white font-semibold text-sm">{category}</h3>
                <span className="text-gray-600 text-xs">({entries.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    watchlist={watchlist}
                    onDismiss={handleDismiss}
                    onTraded={handleTraded}
                    onAddToWatchlist={handleAddToWatchlist}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
