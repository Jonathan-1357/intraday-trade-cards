"use client";

import { useEffect, useRef, useState } from "react";
import { usePaperMode } from "@/context/PaperModeContext";
import PositionChartModal from "@/components/PositionChartModal";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface Position {
  symbol: string;
  action: string;
  quantity: number;
  average_price: number;
  last_price: number;
  stop_loss: number | null;
  target: number | null;
  pnl: number;
  pnl_pct: number;
  product: string;
  exchange: string;
}

interface Order {
  order_id: string;
  symbol: string;
  action: string;
  order_type: string;
  quantity: number;
  price: number;
  status: string;
  placed_at: string;
  mock?: boolean;
}

interface DayTrade {
  symbol: string;
  action: string;
  order_type: string;
  quantity: number;
  executed_price: number;
  realized_pnl: number;
  time: string;
}

interface DayPnl {
  date: string;
  total_pnl: number;
  trades: DayTrade[];
}

export default function PositionsView() {
  const { paper } = usePaperMode();
  const isPaper = paper.enabled;

  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dailyPnl, setDailyPnl] = useState<DayPnl[]>([]);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closedSymbol, setClosedSymbol] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const [chartPos, setChartPos] = useState<Position | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    setNoToken(false);
    try {
      const posUrl = isPaper ? `${BASE}/broker/paper/positions` : `${BASE}/broker/positions`;
      const ordUrl = isPaper ? `${BASE}/broker/paper/orders` : `${BASE}/broker/orders`;
      const fetches: Promise<Response>[] = [fetch(posUrl), fetch(ordUrl)];
      if (isPaper) fetches.push(fetch(`${BASE}/broker/paper/daily-pnl`));
      const [posRes, ordRes, pnlRes] = await Promise.all(fetches);
      if (posRes.status === 403) { setNoToken(true); setLoading(false); return; }
      if (posRes.ok) {
        const data = await posRes.json();
        setPositions(Array.isArray(data) ? data : (data.positions ?? []));
        setLastUpdated(new Date());
      }
      if (ordRes.ok) {
        const data = await ordRes.json();
        setOrders(Array.isArray(data) ? data : (data.orders ?? []));
      }
      if (pnlRes?.ok) {
        const data = await pnlRes.json();
        setDailyPnl(data.days ?? []);
      }
    } catch { /* api not ready */ }
    setLoading(false);
  }

  async function refreshPrices() {
    try {
      const posUrl = isPaper ? `${BASE}/broker/paper/positions` : `${BASE}/broker/positions`;
      const res = await fetch(posUrl);
      if (res.ok) {
        const data = await res.json();
        setPositions(Array.isArray(data) ? data : (data.positions ?? []));
        setLastUpdated(new Date());
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(refreshPrices, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isPaper]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClose(pos: Position) {
    setClosingId(pos.symbol);
    setCloseError(null);
    setClosedSymbol(null);
    try {
      const url = isPaper ? `${BASE}/broker/paper/close` : `${BASE}/broker/close`;
      const closingAction = pos.action === "buy" ? "sell" : "buy";
      const body: Record<string, unknown> = { symbol: pos.symbol, quantity: pos.quantity, action: closingAction };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCloseError(err.detail ?? "Failed to close position");
      } else {
        setClosedSymbol(pos.symbol);
        // Optimistically remove from list immediately, then reload
        setPositions(prev => prev.filter(p => p.symbol !== pos.symbol));
        load();
      }
    } catch {
      setCloseError("Network error — could not place close order");
    } finally {
      setClosingId(null);
    }
  }

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalInvested = positions.reduce((s, p) => s + p.average_price * Math.abs(p.quantity), 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-gray-500 text-sm animate-pulse">Loading positions…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isPaper && (
        <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          <span className="text-indigo-300 text-xs font-medium">
            Paper Mode — virtual trades only · Balance: ₹{paper.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
      {noToken && !isPaper && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-5 py-8 flex flex-col items-center gap-3 text-center">
          <span className="w-3 h-3 rounded-full bg-gray-600" />
          <p className="text-white font-medium text-sm">Not connected to Upstox</p>
          <p className="text-gray-500 text-xs max-w-xs">
            Connect your Upstox account using the indicator at the bottom of the sidebar to view live positions and orders.
          </p>
        </div>
      )}

      {/* P&L Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total P&amp;L</p>
          <p className={`text-xl font-bold font-mono ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className={`text-xs mt-0.5 ${totalPnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>
            {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Open Positions</p>
          <p className="text-xl font-bold text-white">{positions.length}</p>
          <p className="text-xs text-gray-600 mt-0.5">active trades</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Capital Deployed</p>
          <p className="text-xl font-bold font-mono text-white">
            ₹{totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">at avg price</p>
        </div>
      </div>

      {closeError && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-red-400 text-xs">{closeError}</span>
          <button onClick={() => setCloseError(null)} className="text-red-600 hover:text-red-400 text-xs">✕</button>
        </div>
      )}
      {closedSymbol && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-green-400 text-xs">{closedSymbol} closed successfully</span>
          <button onClick={() => setClosedSymbol(null)} className="text-green-600 hover:text-green-400 text-xs">✕</button>
        </div>
      )}

      {/* Positions Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Open Positions</h2>
            <span className="flex items-center gap-1 text-[10px] text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live · {lastUpdated ? lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
            </span>
          </div>
          <button
            onClick={load}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {positions.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">No open positions</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-800">
                <th className="px-4 py-2.5 text-left">Symbol</th>
                <th className="px-4 py-2.5 text-right">Qty</th>
                <th className="px-4 py-2.5 text-right">Avg Price</th>
                <th className="px-4 py-2.5 text-right">LTP</th>
                <th className="px-4 py-2.5 text-right">SL</th>
                <th className="px-4 py-2.5 text-right">Target</th>
                <th className="px-4 py-2.5 text-right">P&amp;L</th>
                <th className="px-4 py-2.5 text-right">P&amp;L %</th>
                <th className="px-4 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{pos.symbol}</p>
                    <p className="text-[10px] text-gray-600">{pos.product} · {pos.exchange}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{pos.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    ₹{pos.average_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white font-medium">
                    ₹{pos.last_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-400 text-xs">
                    {pos.stop_loss ? `₹${pos.stop_loss.toFixed(2)}` : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-400 text-xs">
                    {pos.target ? `₹${pos.target.toFixed(2)}` : <span className="text-gray-700">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pos.pnl >= 0 ? "+" : ""}₹{pos.pnl.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs font-medium ${pos.pnl_pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {pos.pnl_pct >= 0 ? "+" : ""}{pos.pnl_pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setChartPos(pos)}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => handleClose(pos)}
                        disabled={closingId === pos.symbol}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-red-800 text-red-400 hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                      >
                        {closingId === pos.symbol ? "Closing…" : "Close"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Today&apos;s Orders</h2>
        </div>

        {orders.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">No orders today</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-800">
                <th className="px-4 py-2.5 text-left">Symbol</th>
                <th className="px-4 py-2.5 text-left">Side</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-right">Qty</th>
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord) => (
                <tr key={ord.order_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{ord.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase
                      ${ord.action === "buy" ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                      {ord.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{ord.order_type}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{ord.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {ord.price > 0 ? `₹${ord.price.toFixed(2)}` : "MKT"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${
                      ord.status === "complete" ? "text-green-400" :
                      ord.status === "rejected" ? "text-red-400" :
                      "text-amber-400"
                    }`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ord.placed_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily P&L Accordion — paper mode only */}
      {chartPos && (
        <PositionChartModal
          symbol={chartPos.symbol}
          action={chartPos.action}
          average_price={chartPos.average_price}
          stop_loss={chartPos.stop_loss}
          target={chartPos.target}
          onClose={() => setChartPos(null)}
        />
      )}

      {isPaper && dailyPnl.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Realised P&amp;L History</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {dailyPnl.map((day) => {
              const isOpen = openDays.has(day.date);
              const toggle = () => setOpenDays(prev => {
                const next = new Set(prev);
                isOpen ? next.delete(day.date) : next.add(day.date);
                return next;
              });
              return (
                <div key={day.date}>
                  <button
                    onClick={toggle}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                      <span className="text-sm text-white font-medium">{day.date}</span>
                      <span className="text-xs text-gray-500">{day.trades.length} trade{day.trades.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className={`font-mono text-sm font-semibold ${day.total_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {day.total_pnl >= 0 ? "+" : ""}₹{day.total_pnl.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </button>
                  {isOpen && (
                    <table className="w-full text-xs border-t border-gray-800/50">
                      <thead>
                        <tr className="text-gray-600 text-[11px] uppercase tracking-wider bg-gray-800/20">
                          <th className="px-6 py-2 text-left">Symbol</th>
                          <th className="px-4 py-2 text-left">Side</th>
                          <th className="px-4 py-2 text-left">Type</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Exit Price</th>
                          <th className="px-4 py-2 text-right">Realised P&amp;L</th>
                          <th className="px-4 py-2 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.trades.map((t, i) => (
                          <tr key={i} className="border-t border-gray-800/30 hover:bg-gray-800/20">
                            <td className="px-6 py-2 font-medium text-white">{t.symbol}</td>
                            <td className="px-4 py-2">
                              <span className={`px-1.5 py-0.5 rounded uppercase font-semibold ${t.action === "buy" ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                                {t.action}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-500">{t.order_type}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-300">{t.quantity}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-300">₹{t.executed_price.toFixed(2)}</td>
                            <td className={`px-4 py-2 text-right font-mono font-semibold ${t.realized_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {t.realized_pnl >= 0 ? "+" : ""}₹{t.realized_pnl.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500">{t.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
