import { formatCurrency } from "@/lib/utils";
import type { RiskConfig, TradeCard } from "@/types";

interface Props {
  cards: TradeCard[];
  riskConfig: RiskConfig | null;
}

export default function SummaryBar({ cards, riskConfig }: Props) {
  const byConfidence = {
    strong: cards.filter((c) => c.confidence === "strong").length,
    valid: cards.filter((c) => c.confidence === "valid").length,
    weak: cards.filter((c) => c.confidence === "weak").length,
  };

  const active = cards.filter((c) =>
    ["active", "triggered"].includes(c.status)
  );
  const capitalDeployed = active.reduce((sum, c) => sum + c.capital_required, 0);
  const availableSlots = riskConfig
    ? Math.max(0, riskConfig.max_concurrent_trades - active.length)
    : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Stat label="Total Cards" value={String(cards.length)} />
      <Stat
        label="Confidence"
        value={
          <span className="flex gap-2 text-xs flex-wrap">
            <span className="text-green-400">{byConfidence.strong} strong</span>
            <span className="text-blue-400">{byConfidence.valid} valid</span>
            <span className="text-yellow-400">{byConfidence.weak} weak</span>
          </span>
        }
      />
      <Stat label="Capital Deployed" value={formatCurrency(capitalDeployed)} />
      {availableSlots !== null && (
        <Stat label="Slots Available" value={String(availableSlots)} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <div className="text-white text-sm font-semibold">{value}</div>
    </div>
  );
}
