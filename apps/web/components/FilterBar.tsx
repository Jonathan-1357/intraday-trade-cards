"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Valid", value: "valid" },
  { label: "Waiting", value: "waiting" },
  { label: "Triggered", value: "triggered" },
  { label: "Active", value: "active" },
  { label: "Invalidated", value: "invalidated" },
  { label: "Completed", value: "completed" },
] as const;

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "";

  function select(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {FILTERS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => select(value)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            current === value
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
