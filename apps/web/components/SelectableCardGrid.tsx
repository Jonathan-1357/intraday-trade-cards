"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import TradeCard from "@/components/TradeCard";
import { api } from "@/lib/api";
import type { TradeCard as TradeCardType } from "@/types";

interface Props {
  cards: TradeCardType[];
  status?: string;
}

export default function SelectableCardGrid({ cards, status }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState(false);

  const allSelected = cards.length > 0 && selected.size === cards.length;
  const someSelected = selected.size > 0;

  function toggleCard(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cards.map((c) => c.id)));
    }
  }

  async function handleArchive() {
    if (selected.size === 0) return;
    setArchiving(true);
    try {
      await api.tradeCards.archive(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      console.error("Archive failed:", err);
    } finally {
      setArchiving(false);
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 text-sm">
          No trade cards{status ? ` with status "${status}"` : ""}.
        </p>
        <p className="text-gray-600 text-xs mt-1">
          Click &ldquo;Generate Cards&rdquo; to run signal evaluation.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Selection toolbar */}
      <div className="flex items-center justify-between mb-3 min-h-8">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                ${allSelected
                  ? "bg-blue-500 border-blue-500"
                  : someSelected
                  ? "bg-blue-900 border-blue-500"
                  : "border-gray-600 bg-gray-800"
                }`}
            >
              {allSelected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {someSelected && !allSelected && (
                <div className="w-2 h-0.5 bg-blue-400 rounded" />
              )}
            </div>
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          {someSelected && (
            <span className="text-xs text-gray-500">
              {selected.size} of {cards.length} selected
            </span>
          )}
        </div>

        {someSelected && (
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
              <path
                d="M2 4h12v1.5a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm1.5 3.5h9l-.75 6H4.25l-.75-6z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M6 8.5v3M8 8.5v3M10 8.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {archiving ? "Archiving…" : `Archive ${selected.size}`}
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <TradeCard
            key={card.id}
            card={card}
            selected={selected.has(card.id)}
            onToggle={toggleCard}
          />
        ))}
      </div>
    </div>
  );
}
