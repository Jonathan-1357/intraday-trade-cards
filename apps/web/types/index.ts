export type Action = "buy" | "sell";

export type Confidence = "none" | "weak" | "valid" | "strong";

export type CardStatus =
  | "generated"
  | "valid"
  | "pre_open"
  | "waiting"
  | "triggered"
  | "active"
  | "invalidated"
  | "completed";

export interface TradeCard {
  id: string;
  symbol: string;
  action: Action;
  entry: number;
  stop_loss: number;
  target: number;
  quantity: number;
  confidence: Confidence;
  status: CardStatus;
  reasons: string[];
  risk_reward: number;
  capital_required: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskConfig {
  total_capital: number;
  risk_per_trade: number;
  risk_mode: "fixed" | "percent";
  max_concurrent_trades: number;
}
