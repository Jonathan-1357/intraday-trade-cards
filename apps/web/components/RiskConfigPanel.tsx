"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { usePaperMode } from "@/context/PaperModeContext";
import type { RiskConfig } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface Props {
  initial: RiskConfig;
}

export default function RiskConfigPanel({ initial }: Props) {
  const router = useRouter();
  const { paper } = usePaperMode();
  const isPaper = paper.enabled;

  const [form, setForm] = useState<RiskConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Live mode: fetch real Upstox balance and populate capital field
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // In paper mode, seed capital from paper wallet balance
  useEffect(() => {
    if (isPaper && paper.balance > 0) {
      setForm(prev => ({ ...prev, total_capital: Math.floor(paper.balance) }));
    }
  }, [isPaper, paper.balance]);

  useEffect(() => {
    if (isPaper) {
      setLiveBalance(null);
      return;
    }
    setLoadingBalance(true);
    fetch(`${BASE}/broker/funds`)
      .then(r => r.json())
      .then(d => {
        const bal = d.total_balance ?? d.available_margin ?? null;
        setLiveBalance(bal);
        if (bal) setForm(prev => ({ ...prev, total_capital: Math.floor(bal) }));
      })
      .catch(() => {})
      .finally(() => setLoadingBalance(false));
  }, [isPaper]);

  function set(field: keyof RiskConfig, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMsg(null);
  }

  function validate(): string | null {
    if (form.total_capital <= 0) return "Capital must be positive";
    if (form.risk_per_trade <= 0) return "Risk per trade must be positive";
    if (form.risk_per_trade >= form.total_capital)
      return "Risk per trade must be less than total capital";
    if (form.max_concurrent_trades < 1) return "Min 1 concurrent trade";
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      setMsg({ ok: false, text: err });
      return;
    }
    setSaving(true);
    try {
      await api.riskConfig.update(form);
      setMsg({ ok: true, text: "Saved" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
        Risk Config
      </h2>

      <div className="space-y-3">
        {/* Capital field */}
        <label className="block">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Total Capital (₹)</span>
            {isPaper ? (
              <span className="text-[10px] text-indigo-400 font-medium">● Paper wallet</span>
            ) : loadingBalance ? (
              <span className="text-[10px] text-gray-600 animate-pulse">Fetching balance…</span>
            ) : liveBalance !== null ? (
              <span className="text-[10px] text-green-500">
                Live: ₹{liveBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            ) : null}
          </div>

          {isPaper ? (
            // Paper mode — editable, seeded from paper wallet
            <input
              type="number"
              value={form.total_capital}
              onChange={(e) => set("total_capital", Number(e.target.value))}
              className="w-full bg-gray-800 border border-indigo-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          ) : (
            // Live mode — read-only display of Upstox balance
            <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-mono text-white">
                {loadingBalance
                  ? "—"
                  : liveBalance !== null
                    ? `₹${liveBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : `₹${form.total_capital.toLocaleString("en-IN")}`
                }
              </span>
              {!loadingBalance && liveBalance !== null && (
                <span className="text-[10px] text-gray-500">from Upstox</span>
              )}
            </div>
          )}
        </label>

        <div>
          <span className="text-xs text-gray-400">Risk Per Trade</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              value={form.risk_per_trade}
              onChange={(e) => set("risk_per_trade", Number(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
              {(["fixed", "percent"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => set("risk_mode", mode)}
                  className={`px-3 py-2 transition-colors ${
                    form.risk_mode === mode
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {mode === "fixed" ? "₹" : "%"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-xs text-gray-400">Max Concurrent Trades</span>
          <input
            type="number"
            min={1}
            max={20}
            value={form.max_concurrent_trades}
            onChange={(e) => set("max_concurrent_trades", Number(e.target.value))}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || (!isPaper && liveBalance !== null && false)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
