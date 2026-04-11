"""Agent identity and company context — loaded from Company YAML at runtime."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class AgentLifecycleConfig:
    """Paperclip-style lifecycle hooks and heartbeat configuration."""
    on_start: str | None = None           # webhook URL
    on_done: str | None = None
    on_fail: str | None = None
    heartbeat_interval_seconds: int = 30
    heartbeat_timeout_seconds: int = 120
    on_timeout: str = "fail"              # "continue" | "fail" | "retry"


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
            lifecycle = AgentLifecycleConfig(
                on_start=lc_spec.get("onStart"),
                on_done=lc_spec.get("onDone"),
                on_fail=lc_spec.get("onFail"),
                heartbeat_interval_seconds=lc_spec.get("heartbeatIntervalSeconds", 30),
                heartbeat_timeout_seconds=lc_spec.get("heartbeatTimeoutSeconds", 120),
                on_timeout=lc_spec.get("onTimeout", "fail"),
            )

        model = agent_spec.get("model", {})

        return cls(
            name=agent_spec["name"],
            role=agent_spec.get("role", ""),
            persona=agent_spec.get("persona"),
            model_provider=model.get("provider", "anthropic"),
            model_id=model.get("id", "claude-sonnet-4-6"),
            temperature=model.get("temperature", 0.7),
            max_tokens=model.get("maxTokens", 4096),
            budget_monthly_usd=agent_spec.get("budgetMonthlyUsd", 100.0),
            capabilities=agent_spec.get("capabilities", []),
            reports_to=agent_spec.get("reportsTo"),
            lifecycle=lifecycle,
        )


class AgentNotFoundError(Exception):
    """Raised when an agent name cannot be resolved in CompanyContext."""


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
