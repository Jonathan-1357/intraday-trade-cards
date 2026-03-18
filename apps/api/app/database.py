from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import RiskConfigModel, WatchlistModel, PaperWalletModel, PaperPositionModel, PaperOrderModel  # noqa: F401 — registers tables

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if not db.query(RiskConfigModel).first():
            db.add(
                RiskConfigModel(
                    id=1,
                    total_capital=settings.default_capital,
                    risk_per_trade=settings.default_risk_per_trade,
                    risk_mode="fixed",
                    max_concurrent_trades=5,
                )
            )
        if not db.query(WatchlistModel).first():
            db.add(
                WatchlistModel(
                    id=1,
                    symbols=["ICICIBANK", "RELIANCE", "INFY", "HDFCBANK", "TCS"],
                )
            )
        db.commit()
    finally:
        db.close()
