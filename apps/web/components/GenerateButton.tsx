"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import PreOpenModal from "@/components/PreOpenModal";

export default function GenerateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [showPreOpenModal, setShowPreOpenModal] = useState(false);
  const [preopenLoading, setPreopenLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setLastCount(null);
    try {
      const res = await api.tradeCards.generate();
      if (!res.market_open) {
        setShowPreOpenModal(true);
        return;
      }
      setLastCount(res.generated);
      router.refresh();
    } catch (err) {
      console.error("Generate failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreOpen() {
    setPreopenLoading(true);
    try {
      const res = await api.tradeCards.preopen();
      setLastCount(res.generated);
      setShowPreOpenModal(false);
      router.refresh();
    } catch (err) {
      console.error("Pre-open generate failed:", err);
    } finally {
      setPreopenLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Analysing…" : "AI Trade Insights"}
        </button>
        {lastCount !== null && (
          <span className="text-xs text-gray-400">
            {lastCount === 0
              ? "No new cards"
              : `+${lastCount} card${lastCount !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {showPreOpenModal && (
        <PreOpenModal
          onConfirm={handlePreOpen}
          onCancel={() => setShowPreOpenModal(false)}
          loading={preopenLoading}
        />
      )}
    </>
  );
}
