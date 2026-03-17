"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";

interface Props {
  initial: string[];
}

export default function WatchlistEditor({ initial }: Props) {
  const router = useRouter();
  const [symbols, setSymbols] = useState<string[]>(initial);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function addSymbol() {
    const s = input.trim().toUpperCase();
    if (!s || symbols.includes(s)) return;
    setSymbols((prev) => [...prev, s]);
    setInput("");
    setMsg(null);
  }

  function removeSymbol(s: string) {
    setSymbols((prev) => prev.filter((x) => x !== s));
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.watchlist.update(symbols);
      setMsg({ ok: true, text: "Saved" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
        Watchlist
      </h2>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 min-h-8">
        {symbols.map((s) => (
          <span
            key={s}
            className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white"
          >
            {s}
            <button
              onClick={() => removeSymbol(s)}
              className="text-gray-500 hover:text-red-400 transition-colors leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSymbol()}
          placeholder="Add symbol…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={addSymbol}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      <div className="flex items-center gap-3">
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
