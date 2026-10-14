"""
Unit tests for the Gemini wrapper with the network call replaced: the request it builds
(real google-genai types), how replies are read, and the cooldown after quota/access errors.
"""

from __future__ import annotations

import asyncio

import pytest


@pytest.fixture
def llm():
    from tests.service_imports import import_module

    return import_module("assistant", "app.llm")


@pytest.fixture
def types():
    from google.genai import types

    return types


def _client(llm, monkeypatch, responses, model="gemini-3.8-flash"):
    client = llm.GeminiClient(api_key="test-key", model=model, timeout_seconds=5)
    sent = []

    async def fake_generate(*, model, contents, config):
        sent.append({"model": model, "contents": contents, "config": config})
        step = responses.pop(0)
        if isinstance(step, Exception):
            raise step
        return step

    monkeypatch.setattr(client._client.aio.models, "generate_content", fake_generate)
    return client, sent


def _response(types, *parts):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=list(parts)))]
    )


SPEC_ARGS = dict(
    name="check_job_post",
    description="Check a job post.",
    parameters={"type": "object", "properties": {"message_id": {"type": "string"}}, "required": ["message_id"]},
)


def test_tool_call_reply_is_parsed_and_request_is_built(llm, types, monkeypatch):
    call = types.Part(function_call=types.FunctionCall(name="check_job_post", args={"message_id": "m1"}, id="c1"))
    client, sent = _client(llm, monkeypatch, [_response(types, call)])
    tools = [llm.ToolSpec(**SPEC_ARGS)]

    reply = asyncio.run(client.generate("system text", [llm.Message(role="user", text="[m1] hi")], tools))

    assert reply.text == ""
    assert [(c.name, c.args, c.id) for c in reply.tool_calls] == [("check_job_post", {"message_id": "m1"}, "c1")]
    config = sent[0]["config"]
    assert sent[0]["model"] == "gemini-3.8-flash"
    assert config.system_instruction == "system text"
    assert config.automatic_function_calling.disable is True
    assert config.tools[0].function_declarations[0].name == "check_job_post"
    assert config.tool_config is None
    assert config.thinking_config.thinking_level == "LOW"
    assert sent[0]["contents"][0].parts[0].text == "[m1] hi"


def test_force_text_keeps_tools_but_forbids_calls(llm, types, monkeypatch):
    client, sent = _client(llm, monkeypatch, [_response(types, types.Part(text="Done."))])

    reply = asyncio.run(
        client.generate("s", [llm.Message(role="user", text="hi")], [llm.ToolSpec(**SPEC_ARGS)], force_text=True)
    )

    assert reply.text == "Done."
    assert sent[0]["config"].tools
    assert sent[0]["config"].tool_config.function_calling_config.mode == "NONE"


def test_temperature_can_be_overridden(llm, types, monkeypatch):
    client, sent = _client(llm, monkeypatch, [_response(types, types.Part(text="IN_SCOPE"))] * 2)

    asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))
    asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None, temperature=0.0))

    assert sent[0]["config"].temperature == llm.TEMPERATURE
    assert sent[1]["config"].temperature == 0.0


def test_no_tools_means_no_tool_config(llm, types, monkeypatch):
    client, sent = _client(llm, monkeypatch, [_response(types, types.Part(text="Hi"))])

    asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))

    assert sent[0]["config"].tools is None
    assert sent[0]["config"].tool_config is None


def test_gemini_2_models_turn_thinking_off(llm, types, monkeypatch):
    client, sent = _client(llm, monkeypatch, [_response(types, types.Part(text="Hi"))], model="gemini-2.5-flash")

    asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))

    assert sent[0]["config"].thinking_config.thinking_budget == 0


def test_thought_parts_are_not_shown_to_the_user(llm, types, monkeypatch):
    parts = [types.Part(text="secret reasoning", thought=True), types.Part(text="Visible answer.")]
    client, _ = _client(llm, monkeypatch, [_response(types, *parts)])

    reply = asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))

    assert reply.text == "Visible answer."


def test_model_message_with_raw_content_is_sent_back_unchanged(llm, types, monkeypatch):
    raw = types.Content(role="model", parts=[types.Part(text="x", thought_signature=b"sig")])
    client, sent = _client(llm, monkeypatch, [_response(types, types.Part(text="ok"))])
    messages = [
        llm.Message(role="user", text="hi"),
        llm.Message(role="model", text="x", raw=raw),
        llm.Message(role="user", tool_results=[llm.ToolResult(name="check_job_post", response={"risk": "high"}, id="c1")]),
    ]

    asyncio.run(client.generate("s", messages, None))

    contents = sent[0]["contents"]
    assert contents[1] is raw
    assert contents[2].parts[0].function_response.name == "check_job_post"
    assert contents[2].parts[0].function_response.response == {"risk": "high"}


def test_empty_response_is_unavailable(llm, types, monkeypatch):
    client, _ = _client(llm, monkeypatch, [types.GenerateContentResponse(candidates=[])])

    with pytest.raises(llm.LlmUnavailable):
        asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))


@pytest.mark.parametrize("code", [429, 401, 403, 404])
def test_quota_and_access_errors_pause_the_llm(llm, monkeypatch, code):
    from google.genai import errors

    error = errors.ClientError(code, {"error": {"code": code, "message": "nope", "status": "X"}})
    client, sent = _client(llm, monkeypatch, [error])

    with pytest.raises(llm.LlmUnavailable):
        asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))
    with pytest.raises(llm.LlmUnavailable, match="cooldown"):
        asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))
    assert len(sent) == 1


def test_other_errors_do_not_pause_the_llm(llm, types, monkeypatch):
    client, sent = _client(llm, monkeypatch, [TimeoutError(), _response(types, types.Part(text="ok"))])

    with pytest.raises(llm.LlmUnavailable):
        asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))
    reply = asyncio.run(client.generate("s", [llm.Message(role="user", text="hi")], None))

    assert reply.text == "ok"
    assert len(sent) == 2


def test_no_client_when_the_llm_is_off(llm, monkeypatch):
    from tests.service_imports import import_module

    config = import_module("assistant", "app.config")
    monkeypatch.setenv("LLM_PROVIDER", "none")
    config.get_settings.cache_clear()
    try:
        assert llm.get_client() is None
    finally:
        config.get_settings.cache_clear()
