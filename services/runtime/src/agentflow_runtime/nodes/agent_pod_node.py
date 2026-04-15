"""AgentPod node executor — runs an identified agent with persona + LLM call."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from langchain_core.exceptions import OutputParserException
from langchain_core.messages import HumanMessage, SystemMessage

from agentflow_runtime.budget import BudgetExceededError, check_agent_budget, estimate_cost
from agentflow_runtime.identity import AgentNotFoundError
from agentflow_runtime.lifecycle import execute_with_lifecycle
from agentflow_runtime.nodes.base import NodeExecutionResult, NodeExecutor
from agentflow_runtime.variables import VariableResolver

if TYPE_CHECKING:
    from agentflow_runtime.identity import AgentIdentity, CompanyContext
    from agentflow_runtime.state import PipelineState

logger = logging.getLogger(__name__)

# Import RateLimitError — langchain_core uses this name
try:
    from langchain_core.exceptions import RateLimitError  # type: ignore[attr-defined]
except ImportError:
    # Fallback: define a local placeholder so retry decorator still works
    class RateLimitError(Exception):  # type: ignore[no-redef]
        pass


def _build_llm_client(provider: str, model_id: str, temperature: float, max_tokens: int) -> Any:
    """Construct the appropriate LangChain LLM client for the given provider."""
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model_id, temperature=temperature, max_tokens=max_tokens)
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model_id, temperature=temperature, max_tokens=max_tokens)
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model_id, temperature=temperature, max_tokens=max_tokens)
    else:
        raise ValueError(f"Unsupported LLM provider: '{provider}'")


class AgentPodNodeExecutor(NodeExecutor):
    """Executes an agent_pod node by resolving agent identity, building prompts, and calling LLM."""

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        # 1. Resolve agent_ref (accept both snake_case and camelCase)
        agent_ref = node_config.get("agent_ref") or node_config.get("agentRef") or {}
        agent_name = agent_ref.get("name", "")

        try:
            agent = company_context.resolve_agent(agent_name)
        except AgentNotFoundError as exc:
            return NodeExecutionResult(error=str(exc))

        # 2. Build persona-injected system prompt
        persona_prefix = f"You are a {agent.role} at {company_context.name}."
        if agent.persona:
            persona_prefix += f" {agent.persona}"

        # 3. Resolve instruction and inputs via VariableResolver
        resolver = VariableResolver(state)
        raw_instruction = node_config.get("instruction", "")
        inputs: dict[str, Any] = {
            k: resolver.resolve(v) for k, v in node_config.get("inputs", {}).items()
        }
        instruction = resolver.resolve(raw_instruction)

        # 4. Build LLM client
        client = _build_llm_client(
            provider=agent.model_provider,
            model_id=agent.model_id,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
        )

        messages = [
            SystemMessage(content=persona_prefix),
            HumanMessage(content=str(instruction)),
        ]

        # 5. Define inner coroutine (invoked via execute_with_lifecycle)
        @retry(
            retry=retry_if_exception_type(RateLimitError),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            stop=stop_after_attempt(3),
        )
        async def _invoke() -> Any:
            return await client.ainvoke(messages)

        # 6. Execute wrapped in lifecycle hooks
        try:
            response = await execute_with_lifecycle(agent, state.run_id, _invoke(), None)
        except RateLimitError as exc:
            return NodeExecutionResult(error=f"Rate limit exceeded after retries: {exc}")
        except Exception as exc:
            return NodeExecutionResult(error=str(exc))

        # 7. Extract tokens and estimate cost
        tokens_used: int = 0
        usage = getattr(response, "usage_metadata", None)
        if usage is not None:
            tokens_used = getattr(usage, "total_tokens", 0) or 0

        cost = estimate_cost(tokens_used, agent.model_id)

        # 8. Budget enforcement
        cost_so_far = state.agent_costs.get(agent_name, 0.0)
        try:
            check_agent_budget(agent, cost_so_far, cost)
        except BudgetExceededError as exc:
            return NodeExecutionResult(error=str(exc))

        content = getattr(response, "content", str(response))

        return NodeExecutionResult(
            output={
                "response": content,
                "agent_name": agent_name,
                "agent_role": agent.role,
                "inputs": inputs,
            },
            tokens_used=tokens_used,
            cost_usd=cost,
        )
