"""Tests for AgentIdentity, AgentLifecycleConfig, and CompanyContext."""
from __future__ import annotations

import pytest

from agentflow_runtime import AgentNotFoundError, CompanyContext
from agentflow_runtime.identity import AgentIdentity, AgentLifecycleConfig


COMPANY_DICT = {
    "apiVersion": "agentflow.io/v1alpha1",
    "kind": "Company",
    "metadata": {"name": "acme-corp", "namespace": "production"},
    "spec": {
        "agents": [
            {
                "name": "alice",
                "role": "Lead Engineer",
                "persona": "You are a Lead Engineer at acme-corp. Senior Python engineer.",
                "model": {
                    "provider": "anthropic",
                    "id": "claude-sonnet-4-6",
                    "temperature": 0.5,
                    "maxTokens": 8192,
                },
                "budgetMonthlyUsd": 200.0,
                "capabilities": ["code_review", "architecture"],
                "reportsTo": "cto",
                "lifecycle": {
                    "onStart": "https://hooks.acme.com/start",
                    "onDone": "https://hooks.acme.com/done",
                    "onFail": "https://hooks.acme.com/fail",
                    "heartbeatIntervalSeconds": 60,
                    "heartbeatTimeoutSeconds": 300,
                    "onTimeout": "retry",
                },
            },
            {
                "name": "bob",
                "role": "QA Engineer",
                "persona": None,
                "model": {"provider": "openai", "id": "gpt-4o"},
            },
        ]
    },
}


class TestCompanyContextFromYaml:
    def test_builds_correct_agent_identities(self):
        ctx = CompanyContext.from_company_yaml(COMPANY_DICT)
        assert ctx.name == "acme-corp"
        assert ctx.namespace == "production"
        assert set(ctx.agents.keys()) == {"alice", "bob"}

    def test_alice_fields(self):
        ctx = CompanyContext.from_company_yaml(COMPANY_DICT)
        alice = ctx.agents["alice"]
        assert alice.name == "alice"
        assert alice.role == "Lead Engineer"
        assert "Senior Python engineer" in alice.persona
        assert alice.model_provider == "anthropic"
        assert alice.model_id == "claude-sonnet-4-6"
        assert alice.temperature == 0.5
        assert alice.max_tokens == 8192
        assert alice.budget_monthly_usd == 200.0
        assert alice.capabilities == ["code_review", "architecture"]
        assert alice.reports_to == "cto"

    def test_alice_lifecycle(self):
        ctx = CompanyContext.from_company_yaml(COMPANY_DICT)
        lc = ctx.agents["alice"].lifecycle
        assert lc is not None
        assert lc.on_start == "https://hooks.acme.com/start"
        assert lc.on_done == "https://hooks.acme.com/done"
        assert lc.on_fail == "https://hooks.acme.com/fail"
        assert lc.heartbeat_interval_seconds == 60
        assert lc.heartbeat_timeout_seconds == 300
        assert lc.on_timeout == "retry"

    def test_bob_optional_fields_use_defaults(self):
        ctx = CompanyContext.from_company_yaml(COMPANY_DICT)
        bob = ctx.agents["bob"]
        assert bob.persona is None
        assert bob.temperature == 0.7
        assert bob.max_tokens == 4096
        assert bob.budget_monthly_usd == 100.0
        assert bob.capabilities == []
        assert bob.reports_to is None
        assert bob.lifecycle is None

    def test_default_namespace(self):
        minimal = {
            "metadata": {"name": "mini-co"},
            "spec": {"agents": []},
        }
        ctx = CompanyContext.from_company_yaml(minimal)
        assert ctx.namespace == "default"
        assert ctx.agents == {}


class TestResolveAgent:
    def setup_method(self):
        self.ctx = CompanyContext.from_company_yaml(COMPANY_DICT)

    def test_resolve_existing_agent(self):
        alice = self.ctx.resolve_agent("alice")
        assert isinstance(alice, AgentIdentity)
        assert alice.name == "alice"

    def test_resolve_unknown_raises_agent_not_found_error(self):
        with pytest.raises(AgentNotFoundError) as exc_info:
            self.ctx.resolve_agent("unknown")
        assert "unknown" in str(exc_info.value)
        assert "acme-corp" in str(exc_info.value)


class TestAgentLifecycleConfigDefaults:
    def test_defaults(self):
        lc = AgentLifecycleConfig()
        assert lc.on_start is None
        assert lc.on_done is None
        assert lc.on_fail is None
        assert lc.heartbeat_interval_seconds == 30
        assert lc.heartbeat_timeout_seconds == 120
        assert lc.on_timeout == "fail"


class TestAgentNotFoundErrorImportable:
    def test_importable_from_package(self):
        from agentflow_runtime import AgentNotFoundError as Err
        assert issubclass(Err, Exception)
