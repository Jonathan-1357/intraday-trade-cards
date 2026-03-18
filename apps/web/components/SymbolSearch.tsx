"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import SymbolDetailPanel from "@/components/SymbolDetailPanel";

interface SearchResult { symbol: string; name: string; }

interface Props {
  watchlist: string[];
  onWatchlistChange: (symbols: string[]) => void;
}

export default function SymbolSearch({ watchlist, onWatchlistChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.market.search(query);
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
    }, 300);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <div ref={wrapperRef} className="relative max-w-md">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search by name or symbol…"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30 max-h-72 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => { setSelected(r); setOpen(false); setQuery(""); }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors text-left"
              >
                <div>
                  <p className="text-white text-sm font-semibold">{r.symbol}</p>
                  <p className="text-gray-400 text-xs">{r.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  watchlist.includes(r.symbol)
                    ? "text-green-400 border-green-700 bg-green-900/30"
                    : "text-gray-500 border-gray-700"
                }`}>
                  {watchlist.includes(r.symbol) ? "Watching" : "Add"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <SymbolDetailPanel
          symbol={selected.symbol}
          name={selected.name}
          watchlist={watchlist}
          onClose={() => setSelected(null)}
          onWatchlistChange={(next) => { onWatchlistChange(next); }}
        />
      )}
    </>
  );
}
