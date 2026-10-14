# app/llm.py
# Thin wrapper around Gemini (google-genai) for manual function calling.
# The agent works with the small message types below, so tests can use a fake client.
#
# Only text is ever sent: the agent masks personal data first, and images never reach the LLM.

import logging
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Dict, List, Literal, Optional, Protocol

from app.config import get_settings

logger = logging.getLogger(__name__)

TEMPERATURE = 0.3
MAX_OUTPUT_TOKENS = 600
# After these errors Gemini is not called again for a while; guided mode answers instead.
# 429: quota used up; 403: key or project blocked; 404: model retired.
COOLDOWN_CODES = (403, 404, 429)
QUOTA_COOLDOWN_SECONDS = 60.0


class LlmUnavailable(Exception):
    """Gemini could not answer (no key, quota, timeout, network, bad response)."""


@dataclass
class ToolCall:
    name: str
    args: Dict[str, Any]
    id: Optional[str] = None


@dataclass
class ToolResult:
    name: str
    response: Dict[str, Any]
    id: Optional[str] = None


@dataclass
class Message:
    role: Literal["user", "model"]
    text: str = ""
    tool_calls: List[ToolCall] = field(default_factory=list)
    tool_results: List[ToolResult] = field(default_factory=list)
    # The provider's own message object, sent back unchanged so nothing is lost between rounds.
    raw: Any = None


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON schema


@dataclass
class LlmReply:
    text: str
    tool_calls: List[ToolCall]
    raw: Any = None


class LlmClient(Protocol):
    async def generate(
        self, system: str, messages: List[Message], tools: Optional[List[ToolSpec]], *, force_text: bool = False
    ) -> LlmReply: ...


class GeminiClient:
    def __init__(self, api_key: str, model: str, timeout_seconds: float) -> None:
        from google import genai
        from google.genai import types

        self._types = types
        self._model = model
        self._client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000))
        )
        self._unavailable_until = 0.0

    def _thinking(self):
        """As little thinking as the model allows: replies are short and the code decides the verdict."""
        if self._model.startswith("gemini-2"):
            return self._types.ThinkingConfig(thinking_budget=0)
        return self._types.ThinkingConfig(thinking_level="low")

    def _content(self, m: Message):
        t = self._types
        if m.raw is not None:
            return m.raw
        parts = []
        if m.text:
            parts.append(t.Part(text=m.text))
        for call in m.tool_calls:
            parts.append(t.Part(function_call=t.FunctionCall(name=call.name, args=call.args, id=call.id)))
        for result in m.tool_results:
            parts.append(
                t.Part(function_response=t.FunctionResponse(name=result.name, response=result.response, id=result.id))
            )
        return t.Content(role=m.role, parts=parts)

    async def generate(
        self, system: str, messages: List[Message], tools: Optional[List[ToolSpec]], *, force_text: bool = False
    ) -> LlmReply:
        """`force_text`: the tools stay declared (earlier calls are in the history) but may not be called."""
        if time.monotonic() < self._unavailable_until:
            raise LlmUnavailable("quota cooldown")
        t = self._types
        config = t.GenerateContentConfig(
            system_instruction=system,
            temperature=TEMPERATURE,
            max_output_tokens=MAX_OUTPUT_TOKENS,
            thinking_config=self._thinking(),
            automatic_function_calling=t.AutomaticFunctionCallingConfig(disable=True),
            tools=[
                t.Tool(
                    function_declarations=[
                        t.FunctionDeclaration(name=s.name, description=s.description, parameters_json_schema=s.parameters)
                        for s in tools
                    ]
                )
            ]
            if tools
            else None,
            tool_config=t.ToolConfig(function_calling_config=t.FunctionCallingConfig(mode="NONE"))
            if tools and force_text
            else None,
        )
        try:
            response = await self._client.aio.models.generate_content(
                model=self._model, contents=[self._content(m) for m in messages], config=config
            )
        except Exception as e:
            code = getattr(e, "code", None)
            if code in COOLDOWN_CODES:
                self._unavailable_until = time.monotonic() + QUOTA_COOLDOWN_SECONDS
            # Never log the request: it contains user messages.
            logger.warning("Gemini call failed: %s %s", type(e).__name__, code or "")
            raise LlmUnavailable(type(e).__name__) from e

        content = response.candidates[0].content if response.candidates else None
        if content is None or not content.parts:
            raise LlmUnavailable("empty response")
        text = "".join(p.text for p in content.parts if p.text and not p.thought).strip()
        calls = [
            ToolCall(name=p.function_call.name, args=dict(p.function_call.args or {}), id=p.function_call.id)
            for p in content.parts
            if p.function_call
        ]
        return LlmReply(text=text, tool_calls=calls, raw=content)


@lru_cache
def _gemini(api_key: str, model: str, timeout_seconds: float) -> GeminiClient:
    return GeminiClient(api_key, model, timeout_seconds)


def get_client() -> Optional[LlmClient]:
    """The configured LLM, or None when it is off (LLM_PROVIDER=none or no key): guided mode only."""
    s = get_settings()
    if not s.llm_configured:
        return None
    return _gemini(s.gemini_api_key, s.gemini_model, s.llm_timeout_seconds)
