"""LLM node executor — direct model call without requiring an AgentIdentity."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from langchain_core.messages import HumanMessage, SystemMessage

from agentflow_runtime.budget import estimate_cost
from agentflow_runtime.identity import AgentNotFoundError
from agentflow_runtime.nodes.base import NodeExecutionResult, NodeExecutor
from agentflow_runtime.variables import VariableResolver

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState

logger = logging.getLogger(__name__)

try:
    from langchain_core.exceptions import RateLimitError  # type: ignore[attr-defined]
except ImportError:
    class RateLimitError(Exception):  # type: ignore[no-redef]
        pass


def _build_llm_client(provider: str, model_id: str, temperature: float, max_tokens: int) -> Any:
    """Construct the appropriate LangChain LLM client."""
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


class LLMNodeExecutor(NodeExecutor):
    """Executes an llm node: optional agent context, prompt resolution, structured output."""

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        resolver = VariableResolver(state)

        # Determine system prefix and model config
        system_prefix: str = ""
        agent_ref = node_config.get("agent_ref") or node_config.get("agentRef")

        if agent_ref:
            agent_name = agent_ref.get("name", "")
            try:
                agent = company_context.resolve_agent(agent_name)
            except AgentNotFoundError as exc:
                return NodeExecutionResult(error=str(exc))
            system_prefix = f"You are a {agent.role} at {company_context.name}."
            if agent.persona:
                system_prefix += f" {agent.persona}"
            provider = agent.model_provider
            model_id = agent.model_id
            temperature = agent.temperature
            max_tokens = agent.max_tokens
        else:
            # Use model config from node_config directly
            model_cfg: dict = node_config.get("model", {})
            provider = model_cfg.get("provider", "anthropic")
            model_id = model_cfg.get("id", model_cfg.get("modelId", "claude-sonnet-4-6"))
            temperature = float(model_cfg.get("temperature", 0.7))
            max_tokens = int(model_cfg.get("maxTokens", model_cfg.get("max_tokens", 4096)))

        # Resolve prompt
        prompt_cfg: dict = node_config.get("prompt", {})
        raw_system = prompt_cfg.get("system", "")
        raw_user = prompt_cfg.get("user", "")
        system_text = resolver.resolve(raw_system)
        user_text = resolver.resolve(raw_user)

        # Combine system prefix (from agent) with any node-level system prompt
        full_system = system_prefix
        if system_text:
            full_system = (full_system + " " + str(system_text)).strip() if full_system else str(system_text)

        messages: list[Any] = []
        if full_system:
            messages.append(SystemMessage(content=full_system))
        messages.append(HumanMessage(content=str(user_text)))

        # Build client
        try:
            client: Any = _build_llm_client(provider, model_id, temperature, max_tokens)
        except ValueError as exc:
            return NodeExecutionResult(error=str(exc))

        # Structured output support
        output_schema = node_config.get("output_schema")
        invoke_client = client.with_structured_output(output_schema) if output_schema else client

        @retry(
            retry=retry_if_exception_type(RateLimitError),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            stop=stop_after_attempt(3),
        )
        async def _invoke() -> Any:
            return await invoke_client.ainvoke(messages)

        try:
            response = await _invoke()
        except RateLimitError as exc:
            return NodeExecutionResult(error=f"Rate limit exceeded after retries: {exc}")
        except Exception as exc:
            return NodeExecutionResult(error=str(exc))

        # Extract tokens
        tokens_used: int = 0
        usage = getattr(response, "usage_metadata", None)
        if usage is not None:
            tokens_used = getattr(usage, "total_tokens", 0) or 0

        cost = estimate_cost(tokens_used, model_id)

        # Build output
        if output_schema:
            output: dict[str, Any] = {
                "structured": response,
                "tokens_used": tokens_used,
                "model_id": model_id,
            }
        else:
            content = getattr(response, "content", str(response))
            output = {
                "text": content,
                "tokens_used": tokens_used,
                "model_id": model_id,
            }

        return NodeExecutionResult(output=output, tokens_used=tokens_used, cost_usd=cost)
