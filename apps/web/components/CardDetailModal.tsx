"use client";

import { useState } from "react";

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
}

export default function CardDetailModal({ card }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-500 hover:text-blue-400 transition-colors mt-1 text-right w-full"
      >
        Details →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{card.symbol}</h2>
                <p className={`text-xs mt-0.5 ${STATUS_COLORS[card.status]}`}>
                  {STATUS_LABELS[card.status]}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${ACTION_COLORS[card.action]}`}>
                  {card.action}
                </span>
                <span className={`text-xs ${CONFIDENCE_COLORS[card.confidence]}`}>
                  {card.confidence}
                </span>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Entry", value: card.entry, cls: "text-white" },
                { label: "Stop Loss", value: card.stop_loss, cls: "text-red-400" },
                { label: "Target", value: card.target, cls: "text-green-400" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</p>
                  <p className={`text-sm font-semibold mt-1 ${cls}`}>{formatCurrency(value)}</p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Quantity", value: String(card.quantity) },
                { label: "R:R", value: formatRR(card.risk_reward) },
                { label: "Capital", value: formatCurrency(card.capital_required) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</p>
                  <p className="text-white text-sm font-medium mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Reasons */}
            {card.reasons.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reasons</p>
                <ul className="space-y-1">
                  {card.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-blue-500 mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-xs text-gray-600 flex justify-between border-t border-gray-800 pt-3">
              <span>Created {formatDate(card.created_at)}</span>
              <span>Updated {formatDate(card.updated_at)}</span>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
