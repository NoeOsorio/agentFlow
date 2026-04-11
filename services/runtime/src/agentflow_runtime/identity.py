"""Agent identity and company context — loaded from Company YAML at runtime."""
from __future__ import annotations

from dataclasses import dataclass, field


class AgentNotFoundError(Exception):
    """Raised when an agent name cannot be resolved in CompanyContext."""


@dataclass
class AgentLifecycleConfig:
    """Paperclip-style lifecycle hooks and heartbeat configuration."""
    on_start: str | None = None           # webhook URL
    on_done: str | None = None
    on_fail: str | None = None
    heartbeat_interval_seconds: int = 30
    heartbeat_timeout_seconds: int = 120
    on_timeout: str = "fail"              # "continue" | "fail" | "retry"

    @classmethod
    def from_spec(cls, spec: dict) -> "AgentLifecycleConfig":
        return cls(
            on_start=spec.get("onStart", spec.get("on_start")),
            on_done=spec.get("onDone", spec.get("on_done")),
            on_fail=spec.get("onFail", spec.get("on_fail")),
            heartbeat_interval_seconds=spec.get("heartbeatIntervalSeconds", spec.get("heartbeat_interval_seconds", 30)),
            heartbeat_timeout_seconds=spec.get("heartbeatTimeoutSeconds", spec.get("heartbeat_timeout_seconds", 120)),
            on_timeout=spec.get("onTimeout", spec.get("on_timeout", "fail")),
        )


@dataclass
class AgentIdentity:
    """Full identity of an agent as defined in Company YAML."""
    name: str
    role: str
    persona: str | None
    model_provider: str                   # "anthropic", "openai", "google"
    model_id: str
    temperature: float = 0.7
    max_tokens: int = 4096
    budget_monthly_usd: float = 100.0
    capabilities: list[str] = field(default_factory=list)
    reports_to: str | None = None
    lifecycle: AgentLifecycleConfig | None = None

    @classmethod
    def from_company_spec(cls, agent_spec: dict) -> "AgentIdentity":
        """Parse AgentIdentity from Company.spec.agents[] entry."""
        lifecycle: AgentLifecycleConfig | None = None
        lc_spec = agent_spec.get("lifecycle")
        if lc_spec:
            lifecycle = AgentLifecycleConfig.from_spec(lc_spec)

        model = agent_spec.get("model", {})

        return cls(
            name=agent_spec["name"],
            role=agent_spec.get("role", ""),
            persona=agent_spec.get("persona"),
            model_provider=model.get("provider", "anthropic"),
            model_id=model.get("id", "claude-sonnet-4-6"),
            temperature=model.get("temperature", 0.7),
            max_tokens=model.get("maxTokens", model.get("max_tokens", 4096)),
            budget_monthly_usd=agent_spec.get("budgetMonthlyUsd", agent_spec.get("budget_monthly_usd", 100.0)),
            capabilities=agent_spec.get("capabilities", []),
            reports_to=agent_spec.get("reportsTo", agent_spec.get("reports_to")),
            lifecycle=lifecycle,
        )


@dataclass
class CompanyContext:
    """All agents belonging to a Company, keyed by agent name."""
    name: str
    namespace: str
    agents: dict[str, AgentIdentity]      # keyed by agent name

    @classmethod
    def from_company_yaml(cls, company_dict: dict) -> "CompanyContext":
        """Build CompanyContext from a parsed Company YAML dict."""
        agents = {
            a["name"]: AgentIdentity.from_company_spec(a)
            for a in company_dict.get("spec", {}).get("agents", [])
        }
        return cls(
            name=company_dict["metadata"]["name"],
            namespace=company_dict["metadata"].get("namespace", "default"),
            agents=agents,
        )

    def resolve_agent(self, agent_name: str) -> AgentIdentity:
        """Lookup agent by name; raise AgentNotFoundError if missing."""
        if agent_name not in self.agents:
            raise AgentNotFoundError(
                f"Agent '{agent_name}' not found in company '{self.name}'"
            )
        return self.agents[agent_name]
