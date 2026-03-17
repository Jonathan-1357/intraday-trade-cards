import type { Action, CardStatus, Confidence } from "@/types";

export const ACTION_COLORS: Record<Action, string> = {
  buy: "bg-green-900/60 text-green-300 border border-green-700",
  sell: "bg-red-900/60 text-red-300 border border-red-700",
};

export const CONFIDENCE_COLORS: Record<Confidence, string> = {
  none: "text-gray-500",
  weak: "text-yellow-500",
  valid: "text-blue-400",
  strong: "text-green-400",
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  generated: "text-gray-400",
  valid: "text-green-400",
  waiting: "text-yellow-400",
  triggered: "text-orange-400",
  active: "text-blue-400",
  invalidated: "text-gray-500",
  completed: "text-purple-400",
};

export const STATUS_LABELS: Record<CardStatus, string> = {
  generated: "Generated",
  valid: "Valid",
  waiting: "Waiting",
  triggered: "Triggered",
  active: "Active",
  invalidated: "Invalidated",
  completed: "Completed",
};
