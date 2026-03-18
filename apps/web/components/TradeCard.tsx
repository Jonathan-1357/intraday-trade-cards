"use client";

import { useState } from "react";
import CardDetailModal from "@/components/CardDetailModal";
import ExecuteModal from "@/components/ExecuteModal";
import {
  ACTION_COLORS,
  CONFIDENCE_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatRR } from "@/lib/utils";
import type { TradeCard } from "@/types";

interface Props {
  card: TradeCard;
  selected?: boolean;
  onToggle?: (id: string) => void;
}

export default function TradeCard({ card, selected = false, onToggle }: Props) {
  const [showExecute, setShowExecute] = useState(false);

  return (
    <div
      onClick={() => onToggle?.(card.id)}
      className={`relative bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-colors overflow-hidden
        ${onToggle ? "cursor-pointer" : ""}
        ${selected
          ? "border-blue-500 ring-1 ring-blue-500"
          : card.status === "pre_open"
            ? "border-amber-700 hover:border-amber-500"
            : "border-gray-800 hover:border-gray-600"
        }`}
    >

      {/* Pre-Open Banner */}
      {card.status === "pre_open" && (
        <div className="absolute top-0 left-0 right-0 bg-amber-500/10 border-b border-amber-500/30 rounded-t-xl px-3 py-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-medium tracking-wide uppercase">Pre-Opening Order</span>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between gap-2 pr-6 ${card.status === "pre_open" ? "mt-5" : ""}`}>
        <div>
          <p className="text-white font-semibold text-base tracking-wide">
            {card.symbol}
          </p>
          <p className={`text-xs mt-0.5 ${STATUS_COLORS[card.status]}`}>
            {STATUS_LABELS[card.status]}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${ACTION_COLORS[card.action]}`}
          >
            {card.action}
          </span>
          <span className={`text-xs font-medium ${CONFIDENCE_COLORS[card.confidence]}`}>
            {card.confidence}
          </span>
        </div>
      </div>

      {/* Prices */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Entry</p>
          <p className="text-white text-sm font-medium">{formatCurrency(card.entry)}</p>
        </div>
        <div className="bg-red-950/40 rounded-lg p-2">
          <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">SL</p>
          <p className="text-red-400 text-sm font-medium">{formatCurrency(card.stop_loss)}</p>
        </div>
        <div className="bg-green-950/40 rounded-lg p-2">
          <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Target</p>
          <p className="text-green-400 text-sm font-medium">{formatCurrency(card.target)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-400 border-t border-gray-800 pt-3">
        <span>
          <span className="text-gray-500">Qty </span>
          <span className="text-white font-medium">{card.quantity}</span>
        </span>
        <span>
          <span className="text-gray-500">R:R </span>
          <span className="text-white font-medium">{formatRR(card.risk_reward)}</span>
        </span>
        <span>
          <span className="text-gray-500">Cap </span>
          <span className="text-white font-medium">{formatCurrency(card.capital_required)}</span>
        </span>
      </div>

      {/* Reasons */}
      {card.reasons.length > 0 && (
        <ul className="text-xs text-gray-400 space-y-0.5">
          {card.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5">
              <span className="text-gray-600 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] text-gray-600">{formatDate(card.created_at)}</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowExecute(true)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors
              ${card.action === "buy"
                ? "bg-green-700/30 text-green-400 hover:bg-green-700/50"
                : "bg-red-700/30 text-red-400 hover:bg-red-700/50"
              }`}
          >
            Execute
          </button>
          <CardDetailModal card={card} />
        </div>
      </div>

      {showExecute && (
        <ExecuteModal card={card} onClose={() => setShowExecute(false)} />
      )}
    </div>
  );
}
