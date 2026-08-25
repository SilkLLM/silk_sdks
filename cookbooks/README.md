# SilkLLM Cookbooks

Production-shaped scripts, not snippets. Each cookbook is a real, runnable
example built against the actual Python SDK in `packages/python` - every
method call here exists in `silkllm/client.py` with this exact signature.

| Cookbook | What it shows |
|---|---|
| [`multimodal-content-pipeline`](./multimodal-content-pipeline) | One agent, three modalities: a text call plans a scene, an image call renders it, a video call animates it - one key, one balance, one cost report. |
| [`metered-agent-key`](./metered-agent-key) | Give an autonomous agent a SilkLLM key that can't overspend: a spend cap, a rate limit, a model allowlist, and what the agent does when it hits its limit. |

## Setup

```bash
pip install -e ../packages/python
export SILKLLM_API_KEY=silk_your_key
```

Get a key at [getsilkllm.com](https://getsilkllm.com) - new accounts start
with free trial credits, no card required.
