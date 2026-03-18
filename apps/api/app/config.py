from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./trade_cards.db"
    cors_origins: list[str] = ["http://localhost:3000"]
    default_capital: float = 100000.0
    default_risk_per_trade: float = 1000.0
    upstox_access_token: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
