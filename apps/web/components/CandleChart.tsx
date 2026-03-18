"use client";
import { useEffect, useRef } from "react";

interface Candle {
  time: number;   // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  candles: Candle[];
  currentPrice?: number;
}

export default function CandleChart({ candles, currentPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  // Always-current ref so the async chart creation can read latest candles
  const candlesRef = useRef<Candle[]>(candles);
  candlesRef.current = candles;

  // Create chart once on mount, clean up on unmount
  useEffect(() => {
    if (!containerRef.current) return;
    let ro: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, ColorType, CandlestickSeries }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 380,
        layout: {
          background: { type: ColorType.Solid, color: "#030712" },
          textColor: "#6b7280",
        },
        grid: {
          vertLines: { color: "#111827" },
          horzLines: { color: "#111827" },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "#1f2937" },
        timeScale: { borderColor: "#1f2937", timeVisible: true },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderUpColor: "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      });

      chartRef.current = chart;
      seriesRef.current = candleSeries;

      // If candles already arrived before chart finished loading, set them now
      if (candlesRef.current.length > 0) {
        candleSeries.setData(candlesRef.current);
        chart.timeScale().fitContent();
      }

      ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);
    });

    return () => {
      ro?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []); // mount only

  // Update chart data when candles change
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Update last candle with live price
  useEffect(() => {
    if (!seriesRef.current || !currentPrice || candles.length === 0) return;
    const last = candles[candles.length - 1];
    seriesRef.current.update({
      time: last.time,
      open: last.open,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
      close: currentPrice,
    });
  }, [currentPrice, candles]);

  return (
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height: 380 }} />
  );
}
