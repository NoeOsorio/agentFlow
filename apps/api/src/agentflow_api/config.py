from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agentflow"
    redis_url: str = "redis://localhost:6379/0"
    agentflow_env: str = "development"
    agentflow_secret_key: str = "change-me"

    # LLM keys (optional at startup)
    anthropic_api_key: str = ""
    openai_api_key: str = ""


settings = Settings()
