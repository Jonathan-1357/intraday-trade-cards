"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface ConnectionStatus {
  connected: boolean;
  has_token: boolean;
  token_preview: string | null;
}

function ConfigModal({
  status,
  onClose,
  onSaved,
}: {
  status: ConnectionStatus | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSave() {
    if (!token.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/system/connection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save token. Check the API is reachable.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await fetch(`${BASE}/system/connection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "" }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base">Live Data Connection</h2>
            <p className="text-gray-500 text-xs mt-0.5">Connect to Upstox for real-time market data</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current status */}
        {status?.has_token && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs font-medium
            ${status.connected
              ? "bg-green-900/30 border border-green-800 text-green-400"
              : "bg-amber-900/30 border border-amber-800 text-amber-400"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${status.connected ? "bg-green-400" : "bg-amber-400"}`} />
            {status.connected
              ? `Connected · ${status.token_preview}`
              : `Token saved but not responding · ${status.token_preview}`
            }
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
          <p className="text-gray-300 font-medium mb-1.5">How to get your Upstox access token:</p>
          <p>1. Log in to your Upstox developer account</p>
          <p>2. Go to <span className="text-blue-400">My Apps → API key</span></p>
          <p>3. Complete OAuth login and copy the access token (JWT)</p>
          <p className="text-gray-500 pt-1">Token starts with <code className="bg-gray-700 px-1 rounded">eyJ…</code></p>
        </div>

        {/* Token input */}
        <label className="block text-xs text-gray-400 font-medium mb-1.5">
          Upstox Access Token
        </label>
        <textarea
          ref={inputRef}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your JWT access token here…"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-gray-600 resize-none outline-none transition-colors"
        />

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
          >
            {saving ? "Saving…" : "Connect"}
          </button>
          {status?.has_token && (
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ConnectionIndicator() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
    // Re-check every 60s
    const id = setInterval(fetchStatus, 60_000);
    return () => clearInterval(id);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${BASE}/system/connection`);
      if (res.ok) setStatus(await res.json());
    } catch { /* api not ready yet */ }
  }

  if (!mounted) return null;

  const isConnected = status?.connected;
  const hasToken = status?.has_token;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors
          ${isConnected
            ? "hover:bg-gray-800"
            : "hover:bg-gray-800"
          }`}
      >
        {/* Status dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2
            ${isConnected ? "bg-green-400" : hasToken ? "bg-amber-400" : "bg-gray-600"}`}
          />
        </span>

        <span className={`text-xs font-medium truncate
          ${isConnected ? "text-green-400" : hasToken ? "text-amber-400" : "text-gray-500"}`}
        >
          {isConnected ? "Live · Connected" : hasToken ? "Token invalid" : "Click to connect"}
        </span>

        <svg className="w-3 h-3 text-gray-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <ConfigModal
          status={status}
          onClose={() => setOpen(false)}
          onSaved={fetchStatus}
        />
      )}
    </>
  );
}
