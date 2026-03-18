import PositionsView from "@/components/PositionsView";

export default function PositionsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-white">Positions</h1>
        <p className="text-gray-500 text-xs mt-0.5">Live P&amp;L · Orders · Portfolio</p>
      </header>
      <div className="flex-1 px-6 py-6">
        <PositionsView />
      </div>
    </div>
  );
}
