from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routes import trade_cards, risk_config, watchlist

app = FastAPI(
    title="Intraday Trade Card API",
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


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
