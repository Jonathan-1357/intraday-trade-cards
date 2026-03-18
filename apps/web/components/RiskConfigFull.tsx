"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { usePaperMode } from "@/context/PaperModeContext";
import type { RiskConfig } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function RiskConfigFull({ initial }: { initial: RiskConfig }) {
  const router = useRouter();
  const { paper } = usePaperMode();
  const isPaper = paper.enabled;

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState(false);

  // Paper mode: seed capital from paper wallet whenever balance changes
  useEffect(() => {
    if (isPaper && paper.balance > 0) {
      setForm(prev => ({ ...prev, total_capital: Math.floor(paper.balance) }));
    }
  }, [isPaper, paper.balance]);

  // Live mode: fetch once on mount (not tied to isPaper to avoid re-run races)
  async function fetchLiveBalance() {
    setLoadingBalance(true);
    setBalanceError(false);
    try {
      const r = await fetch(`${BASE}/broker/funds`);
      if (!r.ok) throw new Error("not ok");
      const d = await r.json();
      const bal = d.total_balance ?? d.available_margin ?? null;
      if (bal != null) {
        setLiveBalance(bal);
        setForm(prev => ({ ...prev, total_capital: Math.floor(bal) }));
      } else {
        setBalanceError(true);
      }
    } catch {
      setBalanceError(true);
    } finally {
      setLoadingBalance(false);
    }
  }

  useEffect(() => {
    fetchLiveBalance();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: keyof RiskConfig, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
    setError("");
  }

  async function handleSave() {
    if (form.risk_per_trade <= 0) { setError("Risk per trade must be positive"); return; }
    if (form.total_capital <= 0) { setError("Capital must be positive"); return; }
    if (form.risk_mode === "fixed" && form.risk_per_trade >= form.total_capital) {
      setError("Risk per trade must be less than total capital"); return;
    }
    if (form.risk_mode === "percent" && form.risk_per_trade > 100) {
      setError("Percentage cannot exceed 100"); return;
    }

    setSaving(true);
    try {
      await api.riskConfig.update(form);
      // In paper mode, sync the capital value to the paper wallet balance
      if (isPaper) {
        await fetch(`${BASE}/broker/paper/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ set_balance: form.total_capital }),
        });
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Failed to save — is the API running?");
    } finally {
      setSaving(false);
    }
  }

  const effectiveRisk = form.risk_mode === "percent"
    ? (form.risk_per_trade / 100) * form.total_capital
    : form.risk_per_trade;

  const maxExposure = effectiveRisk * form.max_concurrent_trades;
  const exposurePct = form.total_capital > 0
    ? ((maxExposure / form.total_capital) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-8">
      {/* Capital */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Capital</h2>
          {isPaper ? (
            <span className="text-[10px] font-medium text-indigo-400 bg-indigo-900/30 border border-indigo-800 px-2 py-0.5 rounded">
              ● Paper wallet
            </span>
          ) : loadingBalance ? (
            <span className="text-[10px] text-gray-500 animate-pulse">Fetching balance…</span>
          ) : liveBalance !== null ? (
            <button onClick={fetchLiveBalance} className="text-[10px] text-green-500 bg-green-900/20 border border-green-900 px-2 py-0.5 rounded hover:bg-green-900/40 transition-colors">
              ● Live · ₹{liveBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ↻
            </button>
          ) : balanceError ? (
            <button onClick={fetchLiveBalance} className="text-[10px] text-amber-500 hover:text-amber-300 transition-colors">
              Could not fetch · Retry ↻
            </button>
          ) : null}
        </div>

        {isPaper ? (
          // Paper mode — editable input seeded from paper wallet
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Total Paper Capital (₹)</label>
            <input
              type="number"
              value={form.total_capital}
              onChange={(e) => set("total_capital", parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-800 border border-indigo-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-gray-600 text-xs mt-1.5">
              Synced from your paper wallet · edit to override
            </p>
          </div>
        ) : (
          // Live mode — read-only Upstox balance
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Total Trading Capital (₹)</label>
            <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between">
              <span className="text-white text-sm font-mono">
                {loadingBalance
                  ? "—"
                  : liveBalance !== null
                    ? `₹${liveBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : `₹${form.total_capital.toLocaleString("en-IN")}`
                }
              </span>
              <span className="text-[10px] text-gray-500">
                {loadingBalance ? "loading…" : liveBalance !== null ? "from Upstox" : balanceError ? "fetch failed" : "saved value"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Risk per trade */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Risk Per Trade</h2>

        <div className="flex gap-2">
          {(["fixed", "percent"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => set("risk_mode", mode)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors
                ${form.risk_mode === mode
                  ? "bg-blue-600/20 border-blue-500/60 text-blue-400"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
            >
              {mode === "fixed" ? "₹ Fixed Amount" : "% Percentage"}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">
            {form.risk_mode === "fixed" ? "Amount per trade (₹)" : "Percentage of capital (%)"}
          </label>
          <input
            type="number"
            value={form.risk_per_trade}
            onChange={(e) => set("risk_per_trade", parseFloat(e.target.value) || 0)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          {form.risk_mode === "percent" && (
            <p className="text-gray-500 text-xs mt-1.5">
              = ₹{effectiveRisk.toLocaleString("en-IN", { maximumFractionDigits: 0 })} per trade
            </p>
          )}
        </div>
      </section>

      {/* Max concurrent trades */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Position Limits</h2>
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Max Concurrent Trades</label>
          <input
            type="number"
            min={1}
            max={20}
            value={form.max_concurrent_trades}
            onChange={(e) => set("max_concurrent_trades", parseInt(e.target.value) || 1)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </section>

      {/* Exposure summary */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Exposure Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Risk per trade</p>
            <p className="text-white font-semibold">
              ₹{effectiveRisk.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Max total risk</p>
            <p className="text-orange-400 font-semibold">
              ₹{maxExposure.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">% of capital at risk</p>
            <p className={`font-semibold ${parseFloat(exposurePct) > 10 ? "text-red-400" : "text-green-400"}`}>
              {exposurePct}%
            </p>
          </div>
        </div>
      </section>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save Configuration"}
      </button>
    </div>
  );
}
