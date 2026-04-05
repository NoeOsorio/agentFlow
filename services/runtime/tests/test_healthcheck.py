from agentflow_runtime.healthcheck import health


def test_health_returns_status():
    result = health()
    assert "status" in result
    assert "service" in result
    assert result["service"] == "agentflow-runtime"
