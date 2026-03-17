from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RiskConfigModel
from app.schemas import RiskConfigSchema, RiskConfigUpdateSchema

router = APIRouter()


@router.get("/", response_model=RiskConfigSchema)
def get_risk_config(db: Session = Depends(get_db)):
    config = db.query(RiskConfigModel).first()
    if not config:
        raise HTTPException(status_code=404, detail="Risk config not found")
    return config


@router.put("/", response_model=RiskConfigSchema)
def update_risk_config(body: RiskConfigUpdateSchema, db: Session = Depends(get_db)):
    config = db.query(RiskConfigModel).first()
    if not config:
        raise HTTPException(status_code=404, detail="Risk config not found")

    config.total_capital = body.total_capital
    config.risk_per_trade = body.risk_per_trade
    config.risk_mode = body.risk_mode
    config.max_concurrent_trades = body.max_concurrent_trades
    db.commit()
    db.refresh(config)
    return config
