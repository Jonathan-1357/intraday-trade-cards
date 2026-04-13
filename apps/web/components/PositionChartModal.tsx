"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createChart, CandlestickSeries, ColorType, LineStyle, type UTCTimestamp } from "lightweight-charts";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface Props {
  symbol: string;
  action: string;
  average_price: number;
  stop_loss: number | null;
  target: number | null;
  onClose: () => void;
}

interface Candle { time: number; open: number; high: number; low: number; close: number; }

export default function PositionChartModal({ symbol, action, average_price, stop_loss, target, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    // Wait for DOM to paint before measuring container
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const w = containerRef.current.clientWidth || 800;
      const h = containerRef.current.clientHeight || 500;

      const chart = createChart(containerRef.current, {
        width: w,
        height: h,
        layout: {
          background: { type: ColorType.Solid, color: "#111827" },
          textColor: "#9ca3af",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "#374151" },
        timeScale: {
          borderColor: "#374151",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      fetch(`${BASE}/market/candles/${symbol}?interval=1minute&days=3&last_n=300`)
        .then(r => {
          if (!r.ok) throw new Error("Could not load candles — Upstox not connected");
          return r.json();
        })
        .then((candles: Candle[]) => {
          series.setData(
            candles.map(c => ({
              time: c.time as UTCTimestamp,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );

          series.createPriceLine({
            price: average_price,
            color: "#3b82f6",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `Entry ₹${average_price.toFixed(2)}`,
          });

          if (stop_loss) {
            series.createPriceLine({
              price: stop_loss,
              color: "#ef4444",
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `SL ₹${stop_loss.toFixed(2)}`,
            });
          }

          if (target) {
            series.createPriceLine({
              price: target,
              color: "#22c55e",
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `Target ₹${target.toFixed(2)}`,
            });
          }

          chart.timeScale().fitContent();
          setLoading(false);
        })
        .catch(e => {
          setError(e.message);
          setLoading(false);
        });

      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      if (containerRef.current) ro.observe(containerRef.current);

      return () => { ro.disconnect(); chart.remove(); };
    }, 50);

    return () => clearTimeout(timer);
  }, [mounted, symbol, average_price, stop_loss, target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ height: "600px" }}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-widest ${action === "buy" ? "bg-green-700 text-white" : "bg-red-700 text-white"}`}>
              {action}
            </span>
            <span className="text-white font-bold text-sm">{symbol}</span>
            <span className="text-gray-500 text-xs">1 min · Intraday</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="inline-block w-5 border-t-2 border-blue-400" />
              Entry ₹{average_price.toFixed(2)}
            </span>
            {stop_loss && (
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="inline-block w-5 border-t-2 border-red-400 border-dashed" />
                SL ₹{stop_loss.toFixed(2)}
              </span>
            )}
            {target && (
              <span className="flex items-center gap-1.5 text-green-400">
                <span className="inline-block w-5 border-t-2 border-green-400 border-dashed" />
                Target ₹{target.toFixed(2)}
              </span>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="text-gray-500 text-sm animate-pulse">Loading chart…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="text-red-400 text-sm text-center px-8">{error}</span>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>
    </div>,
    document.body
  );
}
