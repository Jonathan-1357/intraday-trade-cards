import TradeCardComponent from "@/components/TradeCard";
import type { TradeCard } from "@/types";

interface Props {
  cards: TradeCard[];
  status?: string;
}

export default function CardGrid({ cards, status }: Props) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 text-sm">No trade cards{status ? ` with status "${status}"` : ""}.</p>
        <p className="text-gray-600 text-xs mt-1">
          Click &ldquo;Generate Cards&rdquo; to run signal evaluation.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map((card) => (
        <TradeCardComponent key={card.id} card={card} />
      ))}
    </div>
  );
}
