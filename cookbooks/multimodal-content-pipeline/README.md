# Multimodal content pipeline

A single script that chains all three generation modalities through one
SilkLLM key and one balance:

```
topic (text)
   │
   ▼
client.generate()        an LLM call turns a one-line topic into a detailed
                          visual scene description
   │
   ▼
client.generate_image()  renders that scene as an image
   │
   ▼
client.generate_video()  animates a short clip from the same scene
```

This is the pattern behind most "AI content agent" demos, and normally
means three different provider accounts, three API keys, and three
different response shapes to normalize. Here it's one client and one
`cost_usd` per step, summed at the end.

## Run it

```bash
pip install -e ../../packages/python
export SILKLLM_API_KEY=silk_your_key
python pipeline.py "a lantern floating over a quiet harbor at dusk"
```

## What to look at

- `client.generate()` is used for *planning*, not just chat - the topic
  becomes the prompt for a purpose-built scene description, which is what
  makes this a small pipeline rather than three unrelated calls.
- Every result object (`GenerateResponse`, `ImageResult`, `VideoResult`)
  carries its own `cost_usd`, so the script sums real, per-step cost rather
  than estimating it.
- `generate_video` depends on the current model's provider actually
  supporting video - see `client.models()` for what's enabled on your
  account right now.
