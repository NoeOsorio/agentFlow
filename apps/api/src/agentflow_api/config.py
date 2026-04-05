from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agentflow"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    agentflow_env: str = "development"
    agentflow_secret_key: str = "change-me"
    internal_secret: SecretStr = SecretStr("change-me")

    cors_origins: list[str] = ["http://localhost:3000"]

    # LLM keys (optional at startup)
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Optional integrations
    knowledge_base_url: str | None = None

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        if self.agentflow_env == "production":
            if self.agentflow_secret_key == "change-me":
                raise ValueError("AGENTFLOW_SECRET_KEY must be set in production")
            if self.internal_secret.get_secret_value() == "change-me":
                raise ValueError("INTERNAL_SECRET must be set in production")
        return self


settings = Settings()
