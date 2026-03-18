"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import PaperWalletModal from "@/components/PaperWalletModal";
import { PaperModeProvider, usePaperMode } from "@/context/PaperModeContext";

const NAV_ITEMS = [
  {
    href: "/",
    label: "IRIS IQ",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    href: "/positions",
    label: "Open Positions",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: "/config",
    label: "Risk Config",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
];

function PaperToggle() {
  const { paper, toggle } = usePaperMode();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Need mounted guard for portal
  if (typeof window !== "undefined" && !mounted) setMounted(true);

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${paper.enabled ? "bg-indigo-400" : "bg-gray-600"}`} />
          <span className={`text-xs font-medium ${paper.enabled ? "text-indigo-300" : "text-gray-500"}`}>
            {paper.enabled ? "Paper Mode" : "Paper Trade"}
          </span>
          {paper.enabled && paper.balance > 0 && (
            <span className="ml-auto text-[10px] font-mono text-indigo-400">
              ₹{(paper.balance / 1000).toFixed(0)}K
            </span>
          )}
        </button>
        {/* Toggle switch */}
        <button
          onClick={() => toggle(!paper.enabled)}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0
            ${paper.enabled ? "bg-indigo-600" : "bg-gray-700"}`}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform
            ${paper.enabled ? "translate-x-3.5" : "translate-x-0.5"}`}
          />
        </button>
      </div>

      {open && mounted && <PaperWalletModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NavInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-white">
      {/* Left Nav */}
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-800">
          <p className="text-white font-bold text-base tracking-widest uppercase">IRIS EDGE</p>
          <p className="text-gray-500 text-xs mt-0.5">Market Intelligence</p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-800 p-2 space-y-0.5">
          <PaperToggle />
          <ConnectionIndicator />
          <div className="px-3 py-1">
            <p className="text-gray-700 text-[10px]">NSE · 9:15 AM – 3:30 PM</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export default function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <PaperModeProvider>
      <NavInner>{children}</NavInner>
    </PaperModeProvider>
  );
}
