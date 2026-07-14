"""
test_integration.py
End-to-end tests for the Python SDK against a running SilkLLM server. Covers
every feature: text generate + stream, models (with modality/is_free), balance,
usage, free trial, BYOK provider keys (deposit/list/update/revoke), and
multimodal image/audio.

Run against a server started with SILK_MOCK_PROVIDER=1 (canned provider
responses), so no real provider keys are needed:

    export SILKLLM_API_KEY=silk_...          # a valid key on that server
    export SILKLLM_BASE_URL=http://127.0.0.1:8099
    python tests/test_integration.py         # or: pytest tests/test_integration.py
"""

# File: silkllm-sdks/packages/python/tests/test_integration.py

import os
import uuid
import silkllm

BASE = os.environ.get("SILKLLM_BASE_URL", "http://127.0.0.1:8099")
KEY = os.environ.get("SILKLLM_API_KEY", "")


def _client():
    return silkllm.Client(api_key=KEY, base_url=BASE)


def test_models_have_modality_and_free_flags():
    c = _client()
    res = c.models()
    assert res.total > 0
    m = res.models[0]
    assert m.modality in ("text", "image", "audio", "video")
    assert isinstance(m.is_free, bool)


def test_generate_text():
    c = _client()
    r = c.generate(messages=[{"role": "user", "content": "hi"}], model="gpt-4o")
    assert r.content and r.usage.total_tokens > 0
    assert r.cost_usd >= 0 and r.balance_after >= 0


def test_stream_text():
    c = _client()
    chunks = list(c.stream(messages=[{"role": "user", "content": "hi"}], model="gpt-4o"))
    assert "".join(chunks).strip() != ""


def test_balance_and_usage():
    c = _client()
    assert c.balance().balance_usd >= 0
    u = c.usage(page=1, page_size=5)
    assert u.page == 1


def test_trial_status():
    c = _client()
    t = c.trial_status()
    assert t.daily_limit_usd >= 0 and isinstance(t.active, bool)


def test_byok_lifecycle():
    c = _client()
    # Clean slate: revoke any existing keys so caps/labels never collide across runs.
    for k in c.list_provider_keys():
        c.revoke_provider_key(k.id)
    label = "sdk-int-" + uuid.uuid4().hex[:6]
    key = c.deposit_provider_key(
        provider_id="openai", api_key="sk-sdk-test-key-123456",
        label=label, is_public=True, declared_budget_usd=10,
    )
    assert key.id and key.is_public and key.status == "active"
    listed = c.list_provider_keys()
    assert any(k.id == key.id for k in listed)
    updated = c.update_provider_key(key.id, is_public=False, serve_owner_with_own_key=False)
    assert updated.is_public is False and updated.serve_owner_with_own_key is False
    c.revoke_provider_key(key.id)
    assert all(k.id != key.id for k in c.list_provider_keys())


def test_generate_image():
    c = _client()
    r = c.generate_image(prompt="a silk ribbon", model="dall-e-3", n=2)
    assert r.count == 2 and len(r.images) == 2 and r.cost_usd >= 0


def test_generate_audio():
    c = _client()
    r = c.generate_audio(prompt="hello world", model="tts-1")
    assert r.audio_b64 and r.format


def _run_all():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
            passed += 1
        except Exception as e:
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{passed}/{len(tests)} passed")
    return passed == len(tests)


if __name__ == "__main__":
    import sys
    if not KEY:
        print("Set SILKLLM_API_KEY to run.")
        sys.exit(2)
    sys.exit(0 if _run_all() else 1)

# EOF silkllm-sdks/packages/python/tests/test_integration.py
