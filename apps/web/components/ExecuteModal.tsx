"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TradeCard } from "@/types";
import { usePaperMode } from "@/context/PaperModeContext";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface Funds {
  available_margin: number;
  used_margin: number;
  total_balance: number;
  mock: boolean;
}

interface Props {
  card: TradeCard;
  onClose: () => void;
}

const ORDER_TYPES = ["LIMIT", "MARKET", "SL", "SL-M"] as const;
type OrderType = typeof ORDER_TYPES[number];

export default function ExecuteModal({ card, onClose }: Props) {
  const { paper, refresh: refreshPaper } = usePaperMode();
  const isPaper = paper.enabled;

  const [mounted, setMounted] = useState(false);
  const [funds, setFunds] = useState<Funds | null>(null);
  const [loadingFunds, setLoadingFunds] = useState(true);

  const [price, setPrice] = useState(card.entry);
  const [slPrice, setSlPrice] = useState(card.stop_loss);
  const [qty, setQty] = useState(card.quantity);
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");

  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ order_id: string; mock: boolean; paper?: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
    if (isPaper) {
      // Use paper wallet balance as "funds"
      setFunds({
        available_margin: paper.balance,
        used_margin: paper.initial_balance - paper.balance,
        total_balance: paper.initial_balance,
        mock: false,
      });
      setLoadingFunds(false);
    } else {
      fetch(`${BASE}/broker/funds`)
        .then(r => { if (!r.ok) throw new Error("no_token"); return r.json(); })
        .then(setFunds)
        .catch(() => {})
        .finally(() => setLoadingFunds(false));
    }
  }, [isPaper, paper.balance, paper.initial_balance]);

  const estimatedCost = price * qty;
  const hasEnough = funds ? funds.available_margin >= estimatedCost : null;

  async function handlePlace() {
    setPlacing(true);
    setError("");
    try {
      const endpoint = isPaper ? `${BASE}/broker/paper/order` : `${BASE}/broker/order`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: card.symbol,
          action: card.action,
          order_type: orderType,
          price: orderType === "MARKET" ? 0 : price,
          trigger_price: ["SL", "SL-M"].includes(orderType) ? slPrice : 0,
          quantity: qty,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Order failed");
      }
      const data = await res.json();
      setResult({ order_id: data.order_id, mock: !!data.mock, paper: !!data.paper });
      if (isPaper) refreshPaper();
    } catch (e: any) {
      setError(e.message ?? "Order placement failed");
    } finally {
      setPlacing(false);
    }
  }

  if (!mounted) return null;

  const isBuy = card.action === "buy";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={!result ? onClose : undefined} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-800 flex items-center justify-between
          ${isBuy ? "bg-green-950/30" : "bg-red-950/30"}`}>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-widest
              ${isBuy ? "bg-green-700 text-white" : "bg-red-700 text-white"}`}>
              {card.action}
            </span>
            <div>
              <p className="text-white font-bold text-base">{card.symbol}</p>
              <p className="text-gray-500 text-xs">
                {isPaper ? (
                  <span className="text-indigo-400 font-medium">● Paper Trade</span>
                ) : "Order Confirmation"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          /* ── Success state ── */
          <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-base">Order Placed</p>
              <p className="text-gray-400 text-sm mt-1">
                {result.paper ? "Paper order" : "Live order"} · ID:{" "}
                <span className="font-mono text-blue-400">{result.order_id}</span>
              </p>
            </div>
            {result.paper && (
              <p className="text-indigo-400 text-xs bg-indigo-900/20 border border-indigo-800 rounded-lg px-3 py-2">
                Paper trade executed — no real money involved.
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Order form ── */
          <div className="px-5 py-4 space-y-4">

            {/* Funds bar */}
            <div className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2.5">
              {loadingFunds ? (
                <span className="text-gray-600 text-xs animate-pulse">Loading funds…</span>
              ) : funds ? (
                <>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider">Available Margin</p>
                    <p className="text-white font-mono text-sm font-semibold">
                      ₹{funds.available_margin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {isPaper && <span className="text-[10px] text-indigo-400 bg-indigo-900/30 border border-indigo-800 px-1.5 py-0.5 rounded">Paper</span>}
                </>
              ) : (
                <span className="text-amber-500 text-xs">Connect Upstox to check balance</span>
              )}
            </div>

            {/* Order type */}
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1.5">Order Type</label>
              <div className="flex gap-1">
                {ORDER_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors
                      ${orderType === t
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Price fields */}
            <div className="grid grid-cols-2 gap-3">
              {orderType !== "MARKET" && (
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">
                    {orderType === "SL" ? "Limit Price" : "Price"}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none transition-colors"
                  />
                </div>
              )}
              {["SL", "SL-M"].includes(orderType) && (
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Trigger Price</label>
                  <input
                    type="number"
                    step="0.05"
                    value={slPrice}
                    onChange={e => setSlPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={e => setQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none transition-colors"
                />
              </div>
            </div>

            {/* Reference levels */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: "Entry", value: `₹${card.entry.toFixed(2)}`, cls: "text-white" },
                { label: "Stop Loss", value: `₹${card.stop_loss.toFixed(2)}`, cls: "text-red-400" },
                { label: "Target", value: `₹${card.target.toFixed(2)}`, cls: "text-green-400" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-gray-800/50 rounded-lg p-2">
                  <p className="text-gray-600 text-[10px] uppercase">{label}</p>
                  <p className={`font-mono mt-0.5 ${cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Cost summary */}
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg
              ${hasEnough === false
                ? "bg-red-900/20 border border-red-800"
                : "bg-gray-800/40 border border-gray-800"
              }`}>
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">Estimated Cost</p>
                <p className={`font-mono text-sm font-semibold ${hasEnough === false ? "text-red-400" : "text-white"}`}>
                  ₹{estimatedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {hasEnough === false && (
                <p className="text-red-400 text-xs font-medium">Insufficient margin</p>
              )}
              {hasEnough === true && (
                <p className="text-green-400 text-xs font-medium">✓ Sufficient</p>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Place button */}
            <button
              onClick={handlePlace}
              disabled={placing || hasEnough === false}
              className={`w-full py-3 text-sm font-bold rounded-xl transition-colors disabled:opacity-40
                ${isBuy
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-red-600 hover:bg-red-500 text-white"
                }`}
            >
              {placing ? "Placing Order…" : `Place ${card.action.toUpperCase()} Order · ${qty} qty`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
