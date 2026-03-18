from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TradeCardSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    symbol: str
    action: str
    entry: float
    stop_loss: float
    target: float
    quantity: int
    confidence: str
    status: str
    reasons: list[str]
    risk_reward: float
    capital_required: float
    archived: bool
    created_at: datetime
    updated_at: datetime


class RiskConfigSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_capital: float
    risk_per_trade: float
    risk_mode: str
    max_concurrent_trades: int


class RiskConfigUpdateSchema(BaseModel):
    total_capital: float
    risk_per_trade: float
    risk_mode: str = "fixed"
    max_concurrent_trades: int = 5


class WatchlistSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    symbols: list[str]


class GenerateResponseSchema(BaseModel):
    generated: int
    cards: list[TradeCardSchema]
    market_open: bool = True


class DailyWatchlistEntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: str
    symbol: str
    score: int
    rank: int
    category: str
    action: str
    reason_tags: list[str]
    indicator_snapshot: dict
    dismissed: bool
    traded: bool
    created_at: datetime


class AutoWatchlistResponseSchema(BaseModel):
    generated: int
    date: str
    entries: list[DailyWatchlistEntrySchema]
