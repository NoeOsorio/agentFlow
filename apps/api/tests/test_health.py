from agentflow_api.config import Settings


def test_settings_defaults():
    s = Settings(database_url="sqlite+aiosqlite:///test.db")
    assert s.agentflow_env == "development"
    assert s.redis_url == "redis://localhost:6379/0"
