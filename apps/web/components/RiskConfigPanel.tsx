"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import type { RiskConfig } from "@/types";

interface Props {
  initial: RiskConfig;
}

export default function RiskConfigPanel({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<RiskConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
        <label className="block">
          <span className="text-xs text-gray-400">Total Capital (₹)</span>
          <input
            type="number"
            value={form.total_capital}
            onChange={(e) => set("total_capital", Number(e.target.value))}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
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
          disabled={saving}
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
