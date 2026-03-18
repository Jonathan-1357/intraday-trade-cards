import RiskConfigFull from "@/components/RiskConfigFull";
import type { RiskConfig } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getRiskConfig(): Promise<RiskConfig | null> {
  try {
    const res = await fetch(`${BASE}/risk-config`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ConfigPage() {
  const config = await getRiskConfig();

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-white">Risk Configuration</h1>
          <p className="text-gray-500 text-xs mt-0.5">Controls quantity and exposure for all generated cards</p>
        </div>
      </header>

      <div className="flex-1 px-6 py-6 max-w-2xl">
        {config ? (
          <RiskConfigFull initial={config} />
        ) : (
          <p className="text-gray-500 text-sm">Could not load config — is the API running?</p>
        )}
      </div>
    </div>
  );
}
