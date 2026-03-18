"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PreOpenModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function PreOpenModal({ onConfirm, onCancel, loading }: PreOpenModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4 mx-auto">
          <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-white text-center mb-2">
          Market is Closed
        </h2>
        <p className="text-gray-400 text-sm text-center mb-1">
          NSE trading hours are 9:15 AM – 3:30 PM IST.
        </p>
        <p className="text-gray-300 text-sm text-center mb-6">
          Would you like to see <span className="text-amber-400 font-medium">pre-opening buy suggestions</span> based on yesterday&apos;s data?
          These can be placed as AMO (After Market Orders) or limit orders at market open.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 disabled:text-amber-600 rounded-lg transition-colors"
          >
            {loading ? "Generating…" : "Show Suggestions"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
