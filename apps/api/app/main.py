from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routes import trade_cards, risk_config, watchlist
from app.routes.market import router as market_router
from app.routes.auto_watchlist import router as auto_watchlist_router
from app.routes.system import router as system_router, load_token_from_db
from app.routes.broker import router as broker_router
from app.routes.paper import router as paper_router

app = FastAPI(
    title="IRIS EDGE API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trade_cards.router, prefix="/api/v1/trade-cards", tags=["trade-cards"])
app.include_router(risk_config.router, prefix="/api/v1/risk-config", tags=["risk-config"])
app.include_router(watchlist.router, prefix="/api/v1/watchlist", tags=["watchlist"])
app.include_router(market_router, prefix="/api/v1/market", tags=["market"])
app.include_router(auto_watchlist_router, prefix="/api/v1/auto-watchlist", tags=["auto-watchlist"])
app.include_router(system_router, prefix="/api/v1/system", tags=["system"])
app.include_router(broker_router, prefix="/api/v1/broker", tags=["broker"])
app.include_router(paper_router, prefix="/api/v1/broker/paper", tags=["paper-trading"])


@app.on_event("startup")
def startup():
    init_db()
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        load_token_from_db(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
