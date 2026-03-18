"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePaperMode } from "@/context/PaperModeContext";

interface Props {
  onClose: () => void;
}

const PRESETS = [10000, 25000, 50000, 100000, 250000];

export default function PaperWalletModal({ onClose }: Props) {
  const { paper, toggle, addFunds, refresh } = usePaperMode();
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const pnl = paper.balance - paper.initial_balance;
  const pnlPct = paper.initial_balance > 0 ? (pnl / paper.initial_balance) * 100 : 0;

  async function handleAdd(amount: number) {
    setSaving(true);
    try {
      if (!paper.enabled) await toggle(true);
      await addFunds(amount);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    setSaving(true);
    try { await toggle(false); } finally { setSaving(false); }
  }

  async function handleCustom() {
    const v = parseFloat(custom);
    if (!v || v <= 0) return;
    await handleAdd(v);
    setCustom("");
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 bg-indigo-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white uppercase tracking-widest">
              Paper
            </span>
            <div>
              <p className="text-white font-bold text-sm">Paper Wallet</p>
              <p className="text-gray-500 text-xs">Virtual trading mode</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Balance summary */}
          {paper.enabled && paper.initial_balance > 0 && (
            <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider">Available Balance</p>
                  <p className="text-white font-mono text-xl font-bold">
                    ₹{paper.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider">P&amp;L</p>
                  <p className={`font-mono text-sm font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnl >= 0 ? "+" : ""}₹{Math.abs(pnl).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-xs ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-2">
                <span>Initial capital: ₹{paper.initial_balance.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          {/* Add funds */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Add Paper Funds</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {PRESETS.slice(0, 3).map(p => (
                <button
                  key={p}
                  onClick={() => handleAdd(p)}
                  disabled={saving}
                  className="py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-indigo-600/30 text-gray-300 hover:text-white border border-gray-700 hover:border-indigo-500 transition-colors disabled:opacity-40"
                >
                  ₹{(p / 1000).toFixed(0)}K
                </button>
              ))}
              {PRESETS.slice(3).map(p => (
                <button
                  key={p}
                  onClick={() => handleAdd(p)}
                  disabled={saving}
                  className="py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-indigo-600/30 text-gray-300 hover:text-white border border-gray-700 hover:border-indigo-500 transition-colors disabled:opacity-40"
                >
                  ₹{(p / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Custom amount…"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-gray-600 outline-none transition-colors"
              />
              <button
                onClick={handleCustom}
                disabled={saving || !custom}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Disable */}
          {paper.enabled && (
            <button
              onClick={handleDisable}
              disabled={saving}
              className="w-full py-2 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40"
            >
              Disable Paper Mode
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
