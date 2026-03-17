from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class TradeCardModel(Base):
    __tablename__ = "trade_cards"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # buy | sell
    entry: Mapped[float] = mapped_column(Float, nullable=False)
    stop_loss: Mapped[float] = mapped_column(Float, nullable=False)
    target: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[str] = mapped_column(String, nullable=False)  # none|weak|valid|strong
    status: Mapped[str] = mapped_column(String, nullable=False, default="generated")
    reasons: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    risk_reward: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    capital_required: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_trade_cards_status", "status"),
        Index("ix_trade_cards_created_at", "created_at"),
    )


class RiskConfigModel(Base):
    __tablename__ = "risk_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    total_capital: Mapped[float] = mapped_column(Float, nullable=False, default=100000.0)
    risk_per_trade: Mapped[float] = mapped_column(Float, nullable=False, default=1000.0)
    risk_mode: Mapped[str] = mapped_column(String, nullable=False, default="fixed")
    max_concurrent_trades: Mapped[int] = mapped_column(Integer, nullable=False, default=5)


class WatchlistModel(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    symbols: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
